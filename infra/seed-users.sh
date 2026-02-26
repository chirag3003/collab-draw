#!/usr/bin/env bash
set -euo pipefail

KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
REALM="${KEYCLOAK_REALM:-collab-draw}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

# Wait for Keycloak to be ready
echo "Waiting for Keycloak at $KEYCLOAK_URL ..."
until curl -sf "$KEYCLOAK_URL/realms/master" > /dev/null 2>&1; do
  sleep 2
done
echo "Keycloak is ready."

# Get admin token
TOKEN=$(curl -sf -X POST "$KEYCLOAK_URL/realms/master/protocol/openid-connect/token" \
  -d "grant_type=password" \
  -d "client_id=admin-cli" \
  -d "username=$ADMIN_USER" \
  -d "password=$ADMIN_PASS" | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

ADMIN_API="$KEYCLOAK_URL/admin/realms/$REALM"

create_user() {
  local username="$1" email="$2" first="$3" last="$4" password="$5"

  # Check if user already exists
  existing=$(curl -sf -H "Authorization: Bearer $TOKEN" \
    "$ADMIN_API/users?username=$username&exact=true")

  if [ "$existing" != "[]" ]; then
    echo "User '$username' already exists, skipping."
    return
  fi

  # Create user
  curl -sf -X POST "$ADMIN_API/users" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"$username\",
      \"email\": \"$email\",
      \"firstName\": \"$first\",
      \"lastName\": \"$last\",
      \"enabled\": true,
      \"emailVerified\": true,
      \"credentials\": [{
        \"type\": \"password\",
        \"value\": \"$password\",
        \"temporary\": false
      }]
    }"

  echo "Created user '$username' ($email) with password '$password'"
}

echo ""
echo "=== Seeding test users into realm '$REALM' ==="
echo ""

create_user "testuser"  "test@collabdraw.dev"    "Test"  "User"    "testpass123"
create_user "alice"     "alice@collabdraw.dev"    "Alice" "Dev"     "testpass123"
create_user "bob"       "bob@collabdraw.dev"      "Bob"   "Builder" "testpass123"

echo ""
echo "=== Done ==="
echo ""
echo "Test credentials:"
echo "  testuser / testpass123"
echo "  alice    / testpass123"
echo "  bob      / testpass123"
