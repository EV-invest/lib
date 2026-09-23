#!/usr/bin/env bash
# Boots the OCI image a landing ships and holds it to its contract: it answers
# /health, negotiates the bare URL, renders a page and the OG card from the
# files it carries, writes a posted lead into the /data mount, and refuses to
# serve at all when the prod env is missing. Linux + docker; run through
# `nix run .#container-smoke` (mkLanding), which sets the SMOKE_* variables.
#
# The host port is docker's choice (`-p 127.0.0.1::<port>`): the container
# ports landings use sit inside Linux's ephemeral range, and a fixed host port
# there fails now and then with `address already in use`.
set -euo pipefail

: "${SMOKE_IMAGE_NAME:?}" "${SMOKE_PORT:?}" "${SMOKE_PAGE:?}"
host_header=()
[ -n "${SMOKE_HOST:-}" ] && host_header=(-H "Host: $SMOKE_HOST")

data="$(mktemp -d)"
chmod 777 "$data"
image="$(nix build .#container --no-link --print-out-paths)"
docker load <"$image" >/dev/null

cleanup() {
  docker logs smoke 2>&1 | tail -20 || true
  docker rm -f smoke smoke-bare >/dev/null 2>&1 || true
}
trap cleanup EXIT

# The published host port docker picked for the container's port.
published() { docker port "$1" "$SMOKE_PORT/tcp" | head -n1 | sed 's/.*://'; }

docker run -d --name smoke -p "127.0.0.1::$SMOKE_PORT" -v "$data:/data" "$SMOKE_IMAGE_NAME" >/dev/null
port="$(published smoke)"
for _ in $(seq 60); do curl -fsS "127.0.0.1:$port/health" >/dev/null 2>&1 && break; sleep 1; done

status() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
expect() {
  local want="$1"
  shift
  local got
  got="$(status "$@")"
  [ "$got" = "$want" ] || { echo "✘ $* → $got, expected $want" >&2; exit 1; }
  echo "✓ $want  $*"
}

expect 200 "127.0.0.1:$port/health"
expect 302 "127.0.0.1:$port/"
expect 200 "${host_header[@]}" "127.0.0.1:$port$SMOKE_PAGE"
expect 200 "127.0.0.1:$port/og"

if [ -n "${SMOKE_QUOTE:-}" ]; then
  # The brand's fields, one `name=value` per line.
  fields=()
  while IFS= read -r kv; do [ -n "$kv" ] && fields+=(--data-urlencode "$kv"); done <<<"$SMOKE_QUOTE"
  # A person's submission: rendered five seconds ago, honeypot empty.
  rendered=$(($(date +%s) * 1000 - 5000))
  locale="${SMOKE_PAGE#/}"
  locale="${locale%%/*}"
  expect 303 "${host_header[@]}" --data-urlencode "locale=$locale" --data-urlencode "form_id=quote" \
    --data-urlencode "t=$rendered" --data-urlencode "website=" "${fields[@]}" "127.0.0.1:$port/quote"
  [ -s "$data/leads.db" ] || { echo "✘ no leads.db in the /data mount" >&2; exit 1; }
  echo "✓ the lead is in the mount"
fi

# Without the prod env the server must not come up on dev defaults.
docker run -d --name smoke-bare -p "127.0.0.1::$SMOKE_PORT" -e LEADS_DB_PATH= "$SMOKE_IMAGE_NAME" >/dev/null
bare="$(published smoke-bare)"
for _ in $(seq 30); do [ "$(status "127.0.0.1:$bare/health")" != 000 ] && break; sleep 1; done
expect 500 "127.0.0.1:$bare/health"
