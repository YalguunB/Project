#!/bin/sh
# A traveler who planned one trip (Kyoto, April 2026, 4 nights), written by hand into the API.
#   sh db/seed/one-trip-traveler.sh                       -> your local server (cd backend; npm start)
#   sh db/seed/one-trip-traveler.sh https://<your site>   -> a deployed site (only for testing, then delete it)
# The id and key below are EXAMPLE values. Anyone who reads this file knows the key, so never use them for a real traveler.
set -e
cd "$(dirname "$0")"
BASE=${1:-http://localhost:3000}
ID=0123456789abcdef0123456789abcdef                                   # public id: 32 hex characters
KEY=fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210  # secret: 64 hex characters (the first write claims the id)

put() { # $1 = collection, $2 = file
  code=$(curl -s -o /tmp/mt-out -w '%{http_code}' -X PUT "$BASE/api/db/$1/$ID" \
    -H 'content-type: application/json' -H "x-mt-key: $KEY" --data-binary @"$2")
  echo "PUT  $1  -> $code $(cat /tmp/mt-out)"
}
put profile profile.json        # who they are: 3 visits, 1 trip, not yet asked whether they went
put trip    trip.json           # the plan itself (what "Continue your Kyoto plan" opens)

echo "GET  profile (with the key)    -> $(curl -s -H "x-mt-key: $KEY" "$BASE/api/db/profile/$ID" | head -c 120)..."
echo "GET  profile (without the key) -> $(curl -s "$BASE/api/db/profile/$ID")"
echo "timing of the last read:        $(curl -s -D - -o /dev/null -H "x-mt-key: $KEY" "$BASE/api/db/profile/$ID" | grep -i server-timing)"
echo
echo "To see the site as this traveler, open $BASE, then in DevTools > Console run:"
echo "  localStorage.setItem('mt.who.v1', JSON.stringify({ id:'$ID', key:'$KEY' })); localStorage.removeItem('moodtrip:profile:v1'); location.reload()"
