# Boots the OCI image a landing ships and holds it to its contract: it answers
# /health, negotiates the bare URL, renders a page and the OG card from the
# files it carries, writes a posted lead into its data mount, and refuses to
# serve at all when its prod env, or only its lead store, is missing. Linux +
# docker; the text of mkLanding's `container-smoke` app, which sets every
# SMOKE_* variable.
#
# The host port is docker's choice (`-p 127.0.0.1::<port>`): the container
# ports landings use sit inside Linux's ephemeral range, and a fixed host port
# there fails now and then with `address already in use`.
set -euo pipefail

: "${SMOKE_IMAGE_ATTR:?}" "${SMOKE_IMAGE_NAME:?}" "${SMOKE_PORT:?}" "${SMOKE_PAGE:?}" "${SMOKE_OG:?}" "${SMOKE_DATA:?}"
host_header=()
if [ -n "${SMOKE_HOST:-}" ]; then host_header=(-H "Host: $SMOKE_HOST"); fi

data="$(mktemp -d)"
chmod 777 "$data"
image="$(nix build "$SMOKE_IMAGE_ATTR" --no-link --print-out-paths)"
docker load <"$image" >/dev/null

cleanup() {
  docker logs smoke 2>&1 | tail -20 || true
  docker rm -f smoke smoke-bare smoke-nostore >/dev/null 2>&1 || true
}
trap cleanup EXIT

# The host port docker picked for the container's port.
published() { docker port "$1" "$SMOKE_PORT/tcp" | head -n1 | sed 's/.*://'; }

docker run -d --name smoke -p "127.0.0.1::$SMOKE_PORT" -v "$data:$SMOKE_DATA" "$SMOKE_IMAGE_NAME" >/dev/null
port="$(published smoke)"
for _ in $(seq 60); do curl -fsS "127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 1; done

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() {
  local want="$1"
  shift
  local got
  got="$(status "$@")"
  if [ "$got" != "$want" ]; then
    echo "✘ $* → $got, expected $want" >&2
    exit 1
  fi
  echo "✓ $want  $*"
}

expect 200 "127.0.0.1:$port/health"
expect 302 "127.0.0.1:$port/"
expect 200 "${host_header[@]}" "127.0.0.1:$port$SMOKE_PAGE"
expect 200 "127.0.0.1:$port$SMOKE_OG"

if [ -n "${SMOKE_QUOTE:-}" ]; then
  # The brand's fields, one `name=value` per line.
  fields=()
  while IFS= read -r kv; do
    if [ -n "$kv" ]; then fields+=(--data-urlencode "$kv"); fi
  done <<<"$SMOKE_QUOTE"
  # A person's submission: rendered five seconds ago, honeypot empty.
  rendered=$(($(date +%s) * 1000 - 5000))
  locale="${SMOKE_PAGE#/}"
  locale="${locale%%/*}"
  expect 303 "${host_header[@]}" --data-urlencode "locale=$locale" --data-urlencode "form_id=quote" \
    --data-urlencode "t=$rendered" "${fields[@]}" "127.0.0.1:$port/quote"
  if [ -z "$(find "$data" -type f -size +0 -print -quit)" ]; then
    echo "✘ the lead left nothing in the data mount" >&2
    exit 1
  fi
  echo "✓ the lead is in the mount"
fi

# Without its prod env — every key the image bakes, blanked — the server must
# not come up on dev defaults.
blank=()
for key in ${SMOKE_PROD_ENV_KEYS:-}; do blank+=(-e "$key="); done
docker run -d --name smoke-bare -p "127.0.0.1::$SMOKE_PORT" "${blank[@]}" "$SMOKE_IMAGE_NAME" >/dev/null
bare="$(published smoke-bare)"
for _ in $(seq 30); do
  if [ "$(status "127.0.0.1:$bare/health")" != 000 ]; then break; fi
  sleep 1
done
expect 500 "127.0.0.1:$bare/health"

# The run above blanks every key, so its 500 could come from any of them.
# This one blanks the lead store's alone, the rest of the prod env in place:
# a server that then boots would write leads outside the volume.
if [ -z "${SMOKE_STORE_KEYS:-}" ]; then
  echo "✘ prodEnv names no lead store (LEADS_DB_PATH or LEADS_DB_URL)" >&2
  exit 1
fi
nostore=()
for key in $SMOKE_STORE_KEYS; do nostore+=(-e "$key="); done
docker run -d --name smoke-nostore -p "127.0.0.1::$SMOKE_PORT" "${nostore[@]}" "$SMOKE_IMAGE_NAME" >/dev/null
nostore_port="$(published smoke-nostore)"
for _ in $(seq 30); do
  if [ "$(status "127.0.0.1:$nostore_port/health")" != 000 ]; then break; fi
  sleep 1
done
expect 500 "127.0.0.1:$nostore_port/health"
