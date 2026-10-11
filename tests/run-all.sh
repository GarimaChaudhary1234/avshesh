#!/usr/bin/env bash
# Runs every automated check against a freshly reset local stack (mock AI, no AWS cost).
#   bash tests/run-all.sh
# Needs: Docker, Java 17 (the Maven wrapper is included), Node 22 and Microsoft Edge or Google Chrome.
set -u
cd "$(dirname "$0")/.."

# Use the same JWT secret as the backend so the expired-token check can sign a token.
export JWT_SECRET="${JWT_SECRET:-$(grep '^JWT_SECRET=' .env 2>/dev/null | cut -d= -f2-)}"
export SCANNER=mock
# The tests exercise the phone-proof flow, which the app leaves off by default.
export PHONE_VERIFICATION_REQUIRED=true
# The tests start from the small demo data; the lived-in demo city (DemoDataExtras) is for people.
export DEMO_RICH=false
# The browser tests ask for many codes from one address (every registration verifies a phone): the real limit is 20 an hour.
export SMS_CLIENT_LIMIT_PER_HOUR=500
# Address search must not call the public OpenStreetMap service from tests.
export GEO_PROVIDER=static
failed=0

# The API and browser tests both change data, so each one starts from a freshly seeded database.
reset_stack() {
  docker compose down -v >/dev/null 2>&1
  docker compose up --build -d >/dev/null 2>&1 || { echo "docker compose failed"; exit 1; }
  for i in $(seq 1 90); do curl -s localhost:8080/api/v1/health | grep -q UP && break; sleep 2; done
  curl -s localhost:8088/api/v1/scan/mode | grep -q mock || { echo "backend is not in mock mode"; exit 1; }
}

echo "### 1/5  unit tests and translation check"
(cd backend && ./mvnw -q test) || failed=1
(cd frontend && npm run i18n --silent) || failed=1

echo "### 2/5  API tests (fresh database)"
reset_stack
node tests/api/run.mjs || failed=1
echo "### 2b  consistency audit of the figures (database rules and API numbers recomputed from the tables)"
node tests/api/audit.mjs || failed=1

echo "### 3/5  limits shared by two backend instances (Redis)"
docker rm -f avshesh-backend-2 >/dev/null 2>&1
docker compose run -d --no-deps --name avshesh-backend-2 -p 127.0.0.1:8082:8080 backend >/dev/null 2>&1
for i in $(seq 1 60); do curl -s localhost:8082/api/v1/health | grep -q UP && break; sleep 2; done
node tests/api/shared-limit.mjs || failed=1
docker rm -f avshesh-backend-2 >/dev/null 2>&1

echo "### 4/5  default setup: registration without an SMS code"
docker rm -f avshesh-backend-3 >/dev/null 2>&1
docker compose run -d --no-deps --name avshesh-backend-3 -p 127.0.0.1:8083:8080 -e PHONE_VERIFICATION_REQUIRED=false backend >/dev/null 2>&1
for i in $(seq 1 60); do curl -s localhost:8083/api/v1/health | grep -q UP && break; sleep 2; done
node tests/api/no-otp.mjs || failed=1
docker rm -f avshesh-backend-3 >/dev/null 2>&1

echo "### 5/5  browser tests (fresh database)"
reset_stack
(cd tests/e2e && { [ -d node_modules ] || npm install --silent; } && node run.mjs) || failed=1
echo "### 5b  consistency audit again, now on the data the browser tests made"
node tests/api/audit.mjs || failed=1

[ "$failed" = 0 ] && echo "ALL CHECKS PASSED" || echo "SOME CHECKS FAILED"
exit $failed
