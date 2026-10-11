#!/usr/bin/env bash
# Deletes everything aws-provision.sh created, so that nothing is billed any more. The database on the server is lost
# with it: take a backup first (ssh in and copy ~/backups) if you want to keep the data.
set -euo pipefail
cd "$(dirname "$0")"
SECRETS=.secrets
[ -f "$SECRETS/server.json" ] || { echo "nothing to delete"; exit 0; }
json() { node -e "console.log(JSON.parse(require('fs').readFileSync('$SECRETS/server.json','utf8'))['$1'])"; }
export AWS_PROFILE="$(json profile)"
aws() { command aws --region "$(json region)" "$@"; }

read -r -p "This deletes the server and all its data. Type 'delete' to continue: " answer
[ "$answer" = "delete" ] || { echo "cancelled"; exit 1; }

aws ec2 terminate-instances --instance-ids "$(json instance)" >/dev/null
aws ec2 wait instance-terminated --instance-ids "$(json instance)"
aws ec2 release-address --allocation-id "$(json allocation)"
aws ec2 delete-security-group --group-id "$(json securityGroup)"
aws ec2 delete-key-pair --key-name "$(json key)"
aws iam remove-role-from-instance-profile --instance-profile-name avshesh-ec2-profile --role-name avshesh-ec2-role
aws iam delete-instance-profile --instance-profile-name avshesh-ec2-profile
aws iam delete-role-policy --role-name avshesh-ec2-role --policy-name bedrock
aws iam delete-role --role-name avshesh-ec2-role
rm -f "$SECRETS/server.json" "$SECRETS/avshesh-key.pem"
echo "everything is deleted"
