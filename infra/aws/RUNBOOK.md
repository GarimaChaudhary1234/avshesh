# Deploying Avshesh to AWS (runbook, not yet executed)

**Status:** nothing here has been run. It is the plan and the settings the app needs, written from the AWS and
Spring Boot documentation. Every step creates billable resources: check the prices, and delete what you do not use.
No access keys are ever put in the app or in chat: the backend uses an IAM role.

## What runs where

| Part | Service | Notes |
|---|---|---|
| Backend (Spring Boot image) | App Runner, image in ECR | one instance is fine for a demo |
| Frontend (nginx image) | a second App Runner service | proxies `/api` to the backend (`BACKEND_URL`, `BACKEND_HOST`) |
| Database | RDS PostgreSQL 16 | Flyway creates the tables on first start |
| Photos | S3 (template: `app-resources.yaml`) | `tmp/` expires after 1 day, plus the hourly cleanup |
| AI | Bedrock, Nova Lite | model access must be enabled in the console for the region |
| SMS | SNS | new accounts are in the **SMS sandbox**: only verified numbers get messages until you request production access |
| Shared limits | ElastiCache Redis (optional) | with one instance `LIMITER=memory` works; with several instances use Redis |
| Alarms | `infra/cloudwatch-alarms.yaml` | untested draft |

## Steps

1. **Region.** Use one region for everything (Bedrock model access, SNS SMS and App Runner must exist there).
2. **Bedrock access.** Console, Bedrock, Model access: enable the Nova Lite model.
3. **Resources.** Deploy `infra/aws/app-resources.yaml` (photo bucket and backend role). Note the two outputs.
4. **RDS.** PostgreSQL 16, private, with a password kept in Secrets Manager. Allow the App Runner service to reach it
   through a VPC connector and a security group.
5. **Images.** Build and push both images to ECR:
   `docker build -t <ecr>/avshesh-backend backend` and `docker build -t <ecr>/avshesh-frontend frontend`.
6. **Backend service (App Runner).** Instance role = `BackendRoleArn`. Environment:

   | Variable | Value |
   |---|---|
   | `SPRING_PROFILES_ACTIVE` | `aws` (S3 photos, no demo data) |
   | `DB_URL`, `DB_USER`, `DB_PASSWORD` | the RDS endpoint and credentials (password from Secrets Manager) |
   | `JWT_SECRET` | a long random value from Secrets Manager (the `aws` profile refuses to start without it) |
   | `SCANNER` | `bedrock` |
   | `AWS_REGION`, `S3_BUCKET` | the region and the bucket |
   | `SMS_SENDER` | `sns` |
   | `SMS_DEV_CODES` | `false`. **Never true in production: it returns the SMS code to the caller.** |
   | `COOKIE_SECURE` | `true` (the login cookie only travels over HTTPS) |
   | `CORS_ORIGINS` | the public URL of the frontend |
   | `LIMITER` | `memory` for one instance, `redis` plus `REDIS_HOST` when you add ElastiCache |
   | `GEO_PROVIDER` | `nominatim` (free public service; use a paid geocoder for real traffic) |

   Health check path: `/api/v1/health`. The metrics port (8081) is internal and is not exposed by App Runner.
7. **Frontend service (App Runner).** Environment `BACKEND_URL=https://<backend-service-domain>` and
   `BACKEND_HOST=<backend-service-domain>`. Users open this service's HTTPS URL: the same address serves the app and
   `/api`, so no CORS is needed and the cookie stays first-party.
8. **First checks.** Open the URL on a phone: the install prompt and the camera need HTTPS. Register, verify a phone
   number you have verified in the SNS sandbox, scan one item, create a listing.
9. **Backups.** Turn on automated RDS backups. `scripts/backup.sh` works against the local compose stack only.
10. **Operators.** Municipal accounts cannot self-register. Create the first officer and commissioner accounts by
    inserting them with the application's own `registerOfficer` path (a small one-off job or a SQL script that
    uses a BCrypt hash); the demo seeder does not run on the `aws` profile.

## Things to decide before real users

- Who verifies dealers in each ward, and who operates the officer accounts.
- The waste per person per day used for the "kept out of the dump" percentage (`IMPACT_KG_PER_PERSON_PER_DAY`).
- A paid geocoder and map tiles instead of the free OpenStreetMap servers.
- Native review of the Hindi and Odia texts.
- A data-protection notice: the app stores names, phone numbers and home locations.
