#!/usr/bin/env bash
# Creates the AWS pieces for the single-server deployment with the AWS CLI and writes what it made to
# deploy/.secrets/server.json (used by aws-deploy.sh and aws-destroy.sh).
#
#   AWS_PROFILE=avshesh-deploy bash deploy/aws-provision.sh
#
# Creates (all named avshesh-*): a key pair, a security group (80 and 443 for everyone, 22 only for your IP), an IAM role
# that lets the server call Amazon Bedrock (no access keys on the server), one EC2 server and an Elastic IP.
# This costs money while it exists: see deploy/README.md. aws-destroy.sh removes everything.
set -euo pipefail
cd "$(dirname "$0")"

export AWS_PROFILE="${AWS_PROFILE:-avshesh-deploy}"
REGION="${REGION:-ap-south-1}"          # Mumbai: close to Bhubaneswar
TYPE="${TYPE:-t3.medium}"               # 2 vCPU, 4 GB
SECRETS=".secrets"
mkdir -p "$SECRETS"
[ -f "$SECRETS/server.json" ] && { echo "already provisioned: see $SECRETS/server.json (run aws-destroy.sh first to start over)"; exit 1; }

aws() { command aws --region "$REGION" "$@"; }

echo "== who am I"
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "account $ACCOUNT, region $REGION, profile $AWS_PROFILE"

echo "== key pair"
aws ec2 create-key-pair --key-name avshesh-key --query KeyMaterial --output text > "$SECRETS/avshesh-key.pem"
chmod 600 "$SECRETS/avshesh-key.pem"

echo "== security group"
VPC=$(aws ec2 describe-vpcs --filters Name=isDefault,Values=true --query 'Vpcs[0].VpcId' --output text)
SG=$(aws ec2 create-security-group --group-name avshesh-sg --description "Avshesh web and ssh" --vpc-id "$VPC" --query GroupId --output text)
MYIP=$(curl -s https://checkip.amazonaws.com | tr -d '\n')
aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
  "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]" \
  "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]" \
  "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=${MYIP}/32,Description=my-ip}]" >/dev/null
echo "ssh allowed from $MYIP only"

echo "== IAM role for the server (Bedrock only)"
cat > "$SECRETS/trust.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}
JSON
cat > "$SECRETS/bedrock.json" <<'JSON'
{"Version":"2012-10-17","Statement":[{"Sid":"ReadPhotosWithBedrock","Effect":"Allow","Action":["bedrock:InvokeModel","bedrock:Converse"],"Resource":"*"}]}
JSON
aws iam create-role --role-name avshesh-ec2-role --assume-role-policy-document "file://$SECRETS/trust.json" >/dev/null
aws iam put-role-policy --role-name avshesh-ec2-role --policy-name bedrock --policy-document "file://$SECRETS/bedrock.json"
aws iam create-instance-profile --instance-profile-name avshesh-ec2-profile >/dev/null
aws iam add-role-to-instance-profile --instance-profile-name avshesh-ec2-profile --role-name avshesh-ec2-role
echo "waiting for the role to become usable..."; sleep 15

echo "== server"
AMI=$(aws ssm get-parameter --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 --query Parameter.Value --output text)
INSTANCE=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$TYPE" --key-name avshesh-key \
  --security-group-ids "$SG" --iam-instance-profile Name=avshesh-ec2-profile \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=30,VolumeType=gp3,DeleteOnTermination=true}' \
  --metadata-options 'HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled' \
  --user-data "file://server-setup.sh" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=avshesh}]' \
  --query 'Instances[0].InstanceId' --output text)
aws ec2 wait instance-running --instance-ids "$INSTANCE"

echo "== Elastic IP (a fixed address that survives restarts)"
ALLOC=$(aws ec2 allocate-address --domain vpc --query AllocationId --output text)
aws ec2 associate-address --instance-id "$INSTANCE" --allocation-id "$ALLOC" >/dev/null
IP=$(aws ec2 describe-addresses --allocation-ids "$ALLOC" --query 'Addresses[0].PublicIp' --output text)

cat > "$SECRETS/server.json" <<JSON
{"region":"$REGION","profile":"$AWS_PROFILE","account":"$ACCOUNT","instance":"$INSTANCE","allocation":"$ALLOC","ip":"$IP","securityGroup":"$SG","key":"avshesh-key"}
JSON
rm -f "$SECRETS/trust.json" "$SECRETS/bedrock.json"
echo
echo "server $INSTANCE is up at $IP. Setup of Docker takes about 2 minutes. Next: bash deploy/aws-deploy.sh"
