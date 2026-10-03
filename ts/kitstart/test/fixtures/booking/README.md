# Booking fixtures — the contract with the panel

The Service-Arb panel vendors this directory by commit sha and holds its own
validators and its own link builder to it; the site runs `src/core/booking` on
the same files (`test/booking.node.test.ts`). Changing a file here changes the
contract: tell the panel.

- `rules.json` — the Cal.com host list every fixture is checked under
  (`calComHosts`, the default).
- `valid/*.json`, `invalid/*.json` — place booking configs (`PlaceLive.booking`,
  the panel's place settings) every validator must accept / refuse. The file
  name says the one thing wrong.
- `requested/valid/*.json`, `requested/invalid/*.json` — `booking.requested@1`
  properties, the same way.
- `choose.json` — `[{ name, booking, variant, choice }]`: which booking a
  visitor is offered for a variant of the `booking_provider` experiment.
- `hrefs.json` — `[{ name, choice, prefill, href }]`: the page a click opens,
  byte for byte; `href: null` opens nothing.

## The config

`{ "default": <provider>, "providers": { <provider>: { "url" } } }`. The
providers are a closed set — `manual | link | google_calendar | cal_com`;
unknown fields are refused, not ignored. (`calendly` is the next one: its own
URL rule, nothing else changes.)

- `manual` — no page: the site promises a call to set the slot, the operator
  records it. Always available, so it is never a key of `providers`.
- `link` — any booking page that passes the URL rule.
- `google_calendar` — the URL rule, plus: the host is `calendar.app.google`
  with a non-empty path (a short link), or `calendar.google.com` with a path
  under `/calendar/appointments/` (something after it).
- `cal_com` — the URL rule, plus: the host is one of the site's Cal.com hosts
  (default `["cal.evinvest.ltd", "cal.com"]`; a site that names its own list
  replaces it; exact match, a subdomain is another host), and the path is
  exactly `/<user>/<event>`, each segment `[A-Za-z0-9][A-Za-z0-9._-]{0,99}` —
  no trailing slash, no percent-escape, no dot segment.
- `default` — `manual`, or a key of `providers`.

## The choice (normative)

The `booking_provider` experiment's variant (the same key on every brand)
names the provider a visitor is offered: `manual` always, another provider
when the place has it in `providers`. Any other variant, or none, is the
place's `default`. No booking at all is `manual`. The chosen provider is the
`provider` of `booking.requested@1` and of the site's `lead_booking_open` /
`lead_booking_done` events.

## The URL rule (normative, every provider with a page)

1. A string of at most 2048 characters, printable ASCII only (`0x21`–`0x7e`):
   no space, tab, line break or non-ASCII character.
2. Starts with the literal, lowercase `https://`. No other scheme.
3. No `#` anywhere (no fragment, not even an empty one); no `\`.
4. The authority (up to the first `/` or `?`) has no `@` (userinfo, even
   empty) and no `:` (a port, even empty) and does not start with `[`.
5. The host is a dotted DNS name: at least two labels, each
   `[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?`, at most 253 characters, no
   trailing dot — and its last label is not a number (`\d+` or `0x…`), which
   a WHATWG parser would read as an IPv4 address. Hosts compare lowercase.
6. A query is allowed and kept.

## The link (normative)

The lead's reference (`leadRef`, `lead-<row>-<8 hex>`, the panel's lead id),
when a provider takes it, goes in the QUERY, never in the fragment. Each pair
the site adds replaces a pair of the same (decoded) key already in the query;
every other pair is kept byte for byte, in order, and the added pairs come
last, in the order below. Keys are written as is, values percent-encoded
(`encodeURIComponent`).

- `manual` — no link.
- `link` — `ref=<leadRef>`. Nothing else: an arbitrary host gets no personal
  data.
- `google_calendar` — the URL as is: a schedule takes no parameter. The panel
  matches its bookings by the contact (the visitor is asked to type the same
  phone) and the time window.
- `cal_com` — `name=<name>` when a non-blank name was given (trimmed);
  `attendeePhoneNumber=<E.164>` when the typed number reads as one;
  `metadata[ref]=<leadRef>`.

## `booking.requested@1` (source kind `site`)

Sent by the site after `lead.created`, through the same outbox, behind its
`panelBooking` switch. Properties, snake_case, unknown fields refused:

- `lead_ref` — `lead-<row>-<8 hex>`, row ≥ 1, lowercase hex. Required.
- `provider` — `manual | link | google_calendar | cal_com`, the one chosen.
  Required.
- `preferred_date` — `YYYY-MM-DD`, a real calendar day. `manual` only.
- `preferred_part` — `morning | afternoon | evening`. `manual` only.

No free text: nothing a person typed travels here.
