# Deploying to AWS: one server, HTTPS

The whole app (database, Redis, backend, frontend) runs with Docker Compose on **one EC2 server**. Caddy in front gets
the HTTPS certificate by itself. Amazon Bedrock reads the photos with the server's IAM role: no AWS access keys are
stored on the server.

## What it costs (while it exists)

| Item | About |
|---|---|
| EC2 `t3.medium` (2 vCPU, 4 GB), Mumbai | $0.0448 per hour, about $33 a month |
| 30 GB gp3 disk | about $3 a month |
| Elastic IP attached to a running server | free (an unattached one is billed) |
| Bedrock (Nova Lite) | a fraction of a cent per photo |

`bash deploy/aws-destroy.sh` removes everything and stops the billing. Prices change: check the AWS pricing page.

## One time: a deploy user with limited rights

1. AWS console, IAM, Users, **Create user** `avshesh-deploy` (no console access).
2. Permissions, **Create inline policy**, JSON, paste `deploy/deploy-user-policy.json`.
3. Security credentials, **Create access key** (use case: Command Line Interface).
4. In your own terminal (never in a chat): `aws configure --profile avshesh-deploy` and type the two keys and the region
   `ap-south-1`.
5. Check: `aws sts get-caller-identity --profile avshesh-deploy`.
6. Bedrock must be enabled for the model in the region the app uses (`AWS_REGION` in `deploy/.env.prod.example`,
   Bedrock console, Model access).

## Deploy

```
export AWS_PROFILE=avshesh-deploy
bash deploy/aws-provision.sh        # creates the server (about 3 minutes), prints its IP
bash deploy/aws-deploy.sh           # copies the code, builds and starts it, prints the https URL
```

`aws-deploy.sh yourdomain.com` uses your own domain (point its A record at the Elastic IP first). Without an argument the
free name `<ip-with-dashes>.sslip.io` is used. After every code change run `bash deploy/aws-deploy.sh` again.

## Things to know

- **It is a demo.** The demo city and its accounts (password `demo1234`) are created on the first start (`DEMO_RICH`).
  Anyone who opens the URL can log in as the commissioner. Set `DEMO_RICH=false` in the server's `.env` and start from an
  empty database (`docker compose ... down -v`) for a real start; then create the first officer accounts yourself.
- **No SMS.** `SMS_DEV_CODES` is off on the server, so "Forgot password" cannot work until a real SMS service is connected.
  New accounts need no code (`PHONE_VERIFICATION_REQUIRED=false`).
- **Backups.** A cron job writes `~/backups/avshesh-<date>.dump` every night and keeps seven. Take EBS snapshots too.
  Restore: copy a dump back and `pg_restore` it into the `db` container.
- **One server** means a restart (or a failed disk) is downtime. Moving to RDS and several servers is the next step if it grows.
- The server accepts SSH only from the IP address you provisioned from. If your address changes, edit the security group.
- Map tiles and address search use the free OpenStreetMap services: fine for a demo, not for real traffic.
