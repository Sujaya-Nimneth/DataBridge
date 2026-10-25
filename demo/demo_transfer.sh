#!/usr/bin/env bash
# End-to-end demo: registers a user, connects the seeded demo databases
# and runs a PostgreSQL -> MySQL transfer through the public API.
#
# Prerequisites:
#   docker compose -f docker-compose.yml -f docker-compose.demo.yml up -d
#
# Usage:
#   ./demo/demo_transfer.sh [email] [password]

set -euo pipefail

EMAIL="${1:-demo@example.com}"
PASSWORD="${2:-demo-password-123}"
API="http://localhost:8000/api"

say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

say "Waiting for the API to become healthy"
for _ in $(seq 1 60); do
  if curl -sf http://localhost:8000/health >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -sf http://localhost:8000/health >/dev/null

say "Signing in as $EMAIL"
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\"}" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

if [ -z "$TOKEN" ]; then
  say "No account yet — registering"
  TOKEN=$(curl -s -X POST "$API/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"email\": \"$EMAIL\", \"password\": \"$PASSWORD\", \"full_name\": \"Demo User\"}" \
    | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
fi
AUTH="Authorization: Bearer $TOKEN"

say "Creating connections to the demo databases"
SOURCE_ID=$(curl -s -X POST "$API/connections" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Demo Source (PostgreSQL)","db_type":"postgresql","host":"demo-postgres","port":5432,"database_name":"demo_source","username":"demo","password":"demo_pass"}' \
  | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')
TARGET_ID=$(curl -s -X POST "$API/connections" -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"name":"Demo Target (MySQL)","db_type":"mysql","host":"demo-mysql","port":3306,"database_name":"demo_target","username":"demo","password":"demo_pass"}' \
  | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

say "Testing connectivity"
curl -s -X POST "$API/connections/$SOURCE_ID/test" -H "$AUTH" | head -c 200; echo
curl -s -X POST "$API/connections/$TARGET_ID/test" -H "$AUTH" | head -c 200; echo

say "Starting transfer: customers (PostgreSQL) -> customers (MySQL), DE only"
JOB=$(curl -s -X POST "$API/transfers" -H "$AUTH" -H 'Content-Type: application/json' \
  -d "{\"source_connection_id\":\"$SOURCE_ID\",\"source_schema\":\"public\",\"source_table\":\"customers\",\"target_connection_id\":\"$TARGET_ID\",\"target_table\":\"customers\",\"filter_query\":\"country = 'DE'\",\"create_target_table\":true}" \
  | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

for _ in $(seq 1 60); do
  STATUS_JSON=$(curl -s "$API/transfers/$JOB" -H "$AUTH")
  STATUS=$(printf '%s' "$STATUS_JSON" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')
  echo "  status: $STATUS"
  case "$STATUS" in
    completed|failed|cancelled) break ;;
  esac
  sleep 2
done

say "Transfer logs"
curl -s "$API/transfers/$JOB/logs" -H "$AUTH" \
  | sed 's/{"id"/\n{"id"/g'

say "Row count in the target table"
curl -s "$API/discovery/$TARGET_ID/tables/customers/count?schema=demo_target" -H "$AUTH"; echo

say "Promoting the demo user to admin (Monitoring > Users tab)"
docker compose -f docker-compose.yml -f docker-compose.demo.yml exec -T backend \
  python -m scripts.promote_admin "$EMAIL" || echo "  (not running under Docker — promote manually with: python -m scripts.promote_admin $EMAIL)"

printf '\nDone. Sign in at http://localhost:5173 (%s / %s) to explore.\n' "$EMAIL" "$PASSWORD"
