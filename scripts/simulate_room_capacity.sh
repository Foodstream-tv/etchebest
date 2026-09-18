#!/usr/bin/env bash
# simulate_room_capacity.sh
# Automated multi-client test simulating 5 simultaneous room participants,
# testing saturation / capacity rejection (6th user), participant leave,
# and host room cleanup.

set -euo pipefail

BASE_URL="${API_URL:-http://localhost:8081}"
TIMESTAMP="$(date +%s)"
PASSWORD="Password123!"

echo "=========================================================="
echo " Starting Multi-Client Room Capacity Simulation"
echo " Target API: $BASE_URL"
echo "=========================================================="

# Check if curl and jq are installed
if ! command -v curl >/dev/null 2>&1; then
  echo "Error: curl is required" >&2
  exit 1
fi

get_json_val() {
  local json="$1"
  local key="$2"
  if command -v jq >/dev/null 2>&1; then
    echo "$json" | jq -r ".${key} // empty"
  else
    # Fallback to python or sed/grep if jq is missing
    echo "$json" | grep -o "\"$key\":[^,}]*" | head -1 | cut -d: -f2 | tr -d ' "{}'
  fi
}

register_and_login() {
  local email="$1"
  local username="$2"
  local role="${3:-USER}"

  # Register
  curl -s -X POST "$BASE_URL/api/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\",\"firstName\":\"Test\",\"lastName\":\"User\",\"username\":\"$username\",\"description\":\"Simulation participant account\",\"countryNumberPhone\":33,\"numberPhone\":\"0612345678\"}" > /dev/null 2>&1 || true

  # Login
  local resp
  resp="$(curl -s -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$PASSWORD\"}")"

  local token
  token="$(get_json_val "$resp" "token")"

  if [[ -z "$token" ]]; then
    echo "Failed to obtain token for $email (Response: $resp)" >&2
    exit 1
  fi

  echo "$token"
}

# 1. Register & Login Host
echo ""
echo "[1/6] Registering and authenticating Host..."
HOST_EMAIL="host_${TIMESTAMP}@sim.local"
HOST_USER="host_${TIMESTAMP}"
HOST_TOKEN="$(register_and_login "$HOST_EMAIL" "$HOST_USER")"
echo "Host authenticated successfully."

# 2. Create Room
echo ""
echo "[2/6] Host creates room 'Simulation Live Cooking'..."
CREATE_ROOM_RESP="$(curl -s -X POST "$BASE_URL/api/rooms" \
  -H "Authorization: Bearer $HOST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Simulation Live Cooking\",\"title\":\"Cooking Session\",\"description\":\"Testing capacity\",\"tags\":[\"test\"],\"level\":\"facile\",\"durationMinutes\":30,\"visibility\":\"public\"}")"

ROOM_ID="$(get_json_val "$CREATE_ROOM_RESP" "roomId")"
if [[ -z "$ROOM_ID" ]]; then
  ROOM_ID="$(get_json_val "$CREATE_ROOM_RESP" "id")"
fi

if [[ -z "$ROOM_ID" ]]; then
  echo "Error: Failed to create room: $CREATE_ROOM_RESP" >&2
  exit 1
fi
echo "Room created with ID: $ROOM_ID (Participant 1/5 = Host)"

# 3. Join 4 participants (reaching capacity limit of 5)
echo ""
echo "[3/6] Joining 4 co-streamers to reach 5/5 capacity..."
P_TOKENS=()
for i in {1..4}; do
  P_EMAIL="p${i}_${TIMESTAMP}@sim.local"
  P_USER="p${i}_${TIMESTAMP}"
  P_TOK="$(register_and_login "$P_EMAIL" "$P_USER")"
  P_TOKENS+=("$P_TOK")

  RESERVE_RESP="$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/rooms/$ROOM_ID/reserve" \
    -H "Authorization: Bearer $P_TOK" \
    -H "Content-Type: application/json" \
    -d "{}")"

  HTTP_CODE="$(echo "$RESERVE_RESP" | tail -n1)"
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "Error: Participant $i failed to join room (HTTP $HTTP_CODE): $RESERVE_RESP" >&2
    exit 1
  fi
  echo "  - Participant $i joined room successfully (Capacity: $((i + 1))/5)"
done

# 4. Attempt to add a 6th participant -> Must be rejected with 403 Forbidden!
echo ""
echo "[4/6] Attempting to add a 6th participant (should be rejected with 403 Forbidden)..."
P5_EMAIL="p5_${TIMESTAMP}@sim.local"
P5_USER="p5_${TIMESTAMP}"
P5_TOKEN="$(register_and_login "$P5_EMAIL" "$P5_USER")"

EXCEED_RESP="$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/rooms/$ROOM_ID/reserve" \
  -H "Authorization: Bearer $P5_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")"

EXCEED_CODE="$(echo "$EXCEED_RESP" | tail -n1)"
EXCEED_BODY="$(echo "$EXCEED_RESP" | head -n -1)"

if [[ "$EXCEED_CODE" == "403" ]]; then
  echo "SUCCESS: 6th participant was properly rejected with HTTP 403 Forbidden!"
  echo "  Server response: $EXCEED_BODY"
else
  echo "FAILURE: Expected HTTP 403 but got HTTP $EXCEED_CODE ($EXCEED_BODY)" >&2
  exit 1
fi

# 5. Disconnect 1 participant -> Capacity frees up to 4/5
echo ""
echo "[5/6] Disconnecting Participant 1..."
LEAVE_RESP="$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/rooms/$ROOM_ID/disconnect" \
  -H "Authorization: Bearer ${P_TOKENS[0]}" \
  -H "Content-Type: application/json" \
  -d "{}")"

LEAVE_CODE="$(echo "$LEAVE_RESP" | tail -n1)"
LEAVE_BODY="$(echo "$LEAVE_RESP" | head -n -1)"

if [[ "$LEAVE_CODE" == "200" ]]; then
  echo "SUCCESS: Participant 1 left room cleanly (HTTP 200, $LEAVE_BODY)."
else
  echo "FAILURE: Expected HTTP 200 for participant leave, got HTTP $LEAVE_CODE ($LEAVE_BODY)" >&2
  exit 1
fi

# 5b. Now 6th participant can join into the freed slot!
echo "Now Participant 5 attempts to join the freed slot..."
JOIN_RETRY="$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/rooms/$ROOM_ID/reserve" \
  -H "Authorization: Bearer $P5_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")"

RETRY_CODE="$(echo "$JOIN_RETRY" | tail -n1)"
if [[ "$RETRY_CODE" == "200" ]]; then
  echo "SUCCESS: Participant 5 took the freed slot (Capacity: 5/5)!"
else
  echo "FAILURE: Expected HTTP 200 after spot freed, got HTTP $RETRY_CODE" >&2
  exit 1
fi

# 6. Host disconnects -> Room is ended for everyone
echo ""
echo "[6/6] Host ends the live session..."
HOST_DISC_RESP="$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/api/rooms/$ROOM_ID/disconnect" \
  -H "Authorization: Bearer $HOST_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{}")"

HOST_DISC_CODE="$(echo "$HOST_DISC_RESP" | tail -n1)"
if [[ "$HOST_DISC_CODE" == "200" ]]; then
  echo "SUCCESS: Host closed room cleanly (HTTP 200)."
else
  echo "FAILURE: Expected HTTP 200 for host close, got HTTP $HOST_DISC_CODE" >&2
  exit 1
fi

echo ""
echo "=========================================================="
echo " ALL CAPACITY & PARTICIPANT SIMULATION TESTS PASSED!"
echo "=========================================================="
