# Changelog

All notable changes to this repo are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the packages follow
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This is a monorepo. The Rust crate (`ev_lib`) is versioned as a single unit; each
TypeScript package under `ts/` is versioned independently.
Entries are grouped into dated release waves, since most changes land across the
Rust crate and its TypeScript mirror at once.

| Package                      | Source                 | Version |
| ---------------------------- | ---------------------- | ------- |
| `ev_lib` (Rust crate)        | `rust/`                | 0.6.6   |
| `@evinvest/uikit`            | `ts/uikit/`            | 0.8.0   |
| `@evinvest/types`            | `ts/types/`            | 0.2.0   |
| `@evinvest/settings`         | `ts/settings/`         | 0.2.0   |
| `@evinvest/analytics`        | `ts/analytics/`        | 0.1.2   |
| `@evinvest/architecture`     | `ts/architecture/`     | 0.1.0   |
| `@evinvest/error-monitoring` | `ts/error-monitoring/` | 0.1.0   |
| `@evinvest/experiments`      | `ts/experiments/`      | 0.1.0   |

## [Unreleased]

### Added

- **Messenger leads: WhatsApp and the brand's Telegram bot** (`@evinvest/kitstart`,
  `/react`, `/server`). `LeadCapture`'s `messenger` prop draws one of ten arms
  of the `lead_channel` experiment (`select`, `segment`, `tiles`, `thanks`,
  `swap`, `saga`, `urgency`, `sheet`, `chip`, `split`), each its own lazy
  chunk; a place without WhatsApp falls back to the control (`messengerFacts`,
  `PlaceLive.telegram` / `messengers`). A messenger tap posts the lead in the
  background (`channel=whatsapp|telegram`, `keepalive`) with its chat
  reference `message_ref` (`AQ-7K3F`, in the prefilled message and the bot's
  `start`); on a computer WhatsApp is a QR code (`qrcode-generator`, a new
  runtime dependency, loaded on that tap only), back on the page the card asks
  whether the message went. `LeadChannel` gains `whatsapp` and `telegram`
  (phone optional, no consent), the lead schema is at 8 (`message_ref`), the
  mail names the channel and the `Réf.`, and the webhook's `panelMessenger`
  switch (off) sends them to the panel as `ctx.channel` / `ctx.messageRef`.
  Every `LeadCapture` event carries `channels_available`; new events
  `lead_messenger_open`, `lead_messenger_return`, intents `telegram`,
  `whatsapp_qr`.
  The message's timing line is `urgency`'s answer or the estimate answer
  `messengerTiming={{ input }}` names; each line is a text key a brand
  rewords (`messagePrice: "… env. {price}"`). The need's line and the
  preview carry the estimate's answers (short labels, `messengerPreviewPrice`).
  Parts `messengerCta`, `messengerSecondary`, `messengerSquare`,
  `messengerSegment`, `messengerTile`, `messengerTrigger` size the variants'
  buttons without descendant selectors; a call inside a variant wears
  `channelIcons.phone`.
- **`TopBar`, `AccountMenu`, `AppShell.topBar`** (`@evinvest/uikit`, TS-only):
  the wide screen's utility bar over the content column, and the account menu
  every service under one account shows in the same order — name / email,
  Manage account, the service's groups, Switch account, Sign out. The contract
  is in the README's App shell section. `DropdownMenuContent` takes `align`
  (default `start`, as before) and `DropdownMenuItem` takes `asChild`, so an
  item can be a link.

- **Every event of a QA visit says `forced: true`, at the sink**
  (`@evinvest/kitstart`, #219). `analyticsSink` takes the QA cookie's name
  (4th argument, `qaCookie`; 5th, `cookies` — a request's `Cookie` header on
  the server, `document.cookie` read per event when left out) and adds
  `forced: true` to every capture while that cookie is set with a non-empty
  value. `AnalyticsBoundary`
  passes its `qaCookie` to it, so the lead form's funnel (`lead_form_view`,
  `_start`, `_step`, `_field_error`, `_submit_error`, `lead_estimate_shown`)
  and `lead_booking_open` / `_done` are marked like the page view and intents.
  `quoteRoute` takes `qaCookie` too and marks `lead_form_submit` and
  `lead_form_reject` from the post's `Cookie` header. One rule on both sides,
  exported as `qaVisit(cookies, name)`. Without the name, the events are
  byte-for-byte as before. The template passes `ab__qa` to `quoteRoute`.
  First load of the template's place page: 180,245 → 180,255 B gz (+10 B; the
  three per-event spreads go, the per-capture check comes in the sink).

- **A test visit's analytics say so** (`@evinvest/kitstart/react`):
  `AnalyticsBoundary` takes an optional `qaCookie` — pass `AbSwitcher`'s. With
  that cookie set (non-empty), `location_page_view` and both
  `contact_intent_click` paths carry `forced: true`, so the QA menu's reloads
  stop counting as a place's traffic; `forced` joins `ALLOWED_PROPS`. Read in
  the browser per event; without the prop or the cookie the events are
  unchanged, no `forced` key. About 50 B gz of first load on the template,
  which passes `ab__qa`.

- **`ToggleGroup` owns its selection** (`ev_lib` `uikit`, #193), as the TS port
  does: `r#type` (`ToggleGroupType::Single` — the default — or `Multiple`),
  controlled `value: Vec<String>` / uncontrolled `default_value` and
  `on_value_change: EventHandler<Vec<String>>`. Both types use a `Vec`; a
  single group holds at most one entry, and pressing its selected item clears
  it. `ToggleGroupItem` takes a `value` and reads its pressed state from the
  group. Source-compatible: an item without a `value` keeps its own
  `pressed`/`default_pressed`/`on_pressed_change`. Behaviour change: an item's
  `variant`/`size` are now optional and default to the group's (an explicit
  one still wins), so items in a `ToggleGroup { variant: Outline }` render
  outlined where they used to fall back to `Bare`. Migration from hand-driven
  items: move the selection onto the group and give each item a `value`.

- **Card tables** (`ev_lib` `uikit` and `@evinvest/uikit`, #187): `Table`
  takes `variant` (`TableVariant::Card` — uppercase `text-xs tracking-wide
  text-ink-soft` head, `px-5 py-3` cells, no head-row hover) and `density`
  (`TableDensity::Compact`); `TableHead`/`TableCell` take `align`
  (`TableAlign::End` — right-aligned, tabular numerals); `TableCard` is the
  paddingless card such a table sits in. The table only sets inherited
  `--table-*` custom properties that the cells read, so a cell's own `class`
  still wins. Generated TS: `tableVariants`, `tableDensities`, `tableAligns`,
  `TABLE_CARD`. Default tables render as before; `TABLE_HEAD` aligns
  `text-start` instead of `text-left`. TS: the props are `variant`, `density`
  and `align` (`"start" | "end"`, replacing the obsolete HTML `align` on
  `TableHead`/`TableCell`); `Table` stays a Server Component and sets
  `data-variant`/`data-density`; exported `TableCard`, the types
  `TableVariant`/`TableDensity`/`TableAlign`/`TableProps`/`TableHeadProps`/
  `TableCellProps`, and the TS-only `ListRows`/`ListRow`/`ListRowLabel`/
  `ListRowValue` (a table's phone form; shipped in 0.26.0's `dist/` but not
  reachable from the barrel). The example app mounts a Tables section.
- **`AbSwitcher`, the QA menu for A/B variants** (`@evinvest/kitstart/react`).
  A chip in a corner (`data-ab-switcher`, placed by `className`) whose panel
  lists each experiment's variants, the current one pressed; a tap is the
  brand's own force parameter (`?ab_<key>=<value>`), no new server path.
  "Reset" drops the `ab_<key>` assignments and the force parameters and keeps
  the QA cookie; "Leave test" drops it too; minimize and hide last until the
  next load. About 190 B gz of first load: after hydration it imports the
  panel only outside production or for a visit with the QA cookie, so a
  visitor never fetches it and the page stays static. The decisions are core
  functions (`abSwitcherVisible`, `abVariantUrl`, `abReset`, `abAssignments`,
  `cookieValue`). The template mounts it with a demo `lead_form` experiment
  and an e2e of its own.
- **`LeadCapture` one question a screen, and the compact form**
  (`@evinvest/kitstart/react`). `layout="steps"` — the intro question, the
  need, each estimate question, the postcode, the phone last; a thin bar,
  "Retour", answered screens as chips; `lead_form_step` per screen; the same
  screen on the server and after hydration, every screen posted, a noscript
  style for the form without a script. `intro` (an answer posted as a brand's
  extra, `channel: "callback"` cutting the form to the phone and its consent),
  `localityStep`, `needDisplay` (`tiles` · `cards` with the brand's icons),
  `questions` (`display: "cards"` with each answer's total, `badges`,
  `shortLabels` (and `needs[].shortLabel`) for phones, `step` to share a
  screen with a `next` button, `unknown` → "Je ne sais pas" (`unknownSpan`), a quote on the form and on the server via
  `ESTIMATE_UNKNOWN`/`answeredUnknown`), `price="compact"` with `taxCredit`,
  `afterPhone`, `channelsDisplay="row"` with `channelIcons`, `focusNext`, and
  `?postcode=` prefilling the postcode. Opt-in: every existing prop renders as
  in 0.13; `qualify-first` is unchanged. No lead schema change (`urgency` and
  the like are a brand's `extras`).
- **`ts_gen`** (`ev_lib` 0.24.1): the TS generator `ev_lib_gen` runs on, opened
  to downstream repos — `Ts::types::<T>()` (via `ts-rs`), `Ts::Value` (via
  serde), `Ts::write`. `Ts::Array`/`Ts::Scalar` folded into `Ts::Value`; the
  lib's generated files are unchanged byte for byte.
- **TS contract constants generated from Rust** (`@evinvest/experiments`,
  `@evinvest/settings`, `@evinvest/analytics`): the FNV-1a seeds, the cookie
  prefix and max-age, `PROFILE_VAR`/`DEFAULT_PROFILE`/`EX_CONFIG`, and PostHog's
  US host come from `ev_lib` via `nix run .#gen`; the `settings` presets are
  type-checked against the Rust presets' variable names. Exports unchanged.
  New Rust consts: `experiments::{FNV_OFFSET_BASIS, FNV_PRIME, COOKIE_PREFIX,
  COOKIE_MAX_AGE_SECS}`; `ts_gen::Ts::Union`.
- **`Command` takes server-driven results** (`@evinvest/uikit`, #107).
  `shouldFilter={false}` (on `Command` and `CommandDialog`; default `true`, as
  in cmdk) turns the client filter off: every mounted `CommandItem` renders in
  the caller's order and `CommandEmpty` counts mounted rows. The kit also gains
  the keyboard it never had: focus stays in `CommandInput`, which points at the
  highlighted row through `aria-activedescendant`; ArrowUp/ArrowDown move it
  past disabled rows, Enter fires that row's `onSelect`, hover moves it too
  (Home/End stay with the caret; keys from other focusables are left alone). The highlight sits on the first row until the user moves it, so
  results that land after the keystroke put Enter on the top hit. TS only —
  the Rust port still filters and has no keyboard.
- **`FormSelect` takes a controlled `value`** (`@evinvest/kitstart/react`,
  #163). Under `value` the prop is what the trigger shows and the form posts;
  a pick only calls `onValueChange`, so a parent drives and resets it, and a
  form `reset` leaves it on `value`. Without JavaScript it is still the native
  select, starting on `value`; a pick made there before hydration is reported
  through `onValueChange`. Switching between controlled and uncontrolled warns
  once in development and keeps the last value. `defaultValue` is unchanged.

### Fixed

- **Rust `Command` from the keyboard** (`ev_lib` `uikit`, #197), the model of
  the TS `Command` (#196): focus stays in the search field, now
  `role="combobox"` with `aria-controls` naming the list, `aria-expanded` and
  `aria-activedescendant` naming the highlighted row. ArrowUp/ArrowDown move
  the highlight (stopping at the ends, skipping `disabled` rows), Enter fires
  the highlighted row's `on_select`, and Home/End stay with the caret. On the
  web both follow the rows' order on screen, so a keyed re-sort or a row
  inserted on top is walked where it shows. Until moved, the highlight tracks
  the first row the filter keeps; a row under the
  pointer takes it too. Rows carry `id`, `data-selected`/`aria-selected` and
  `aria-disabled`. New `should_filter` on `Command` and `CommandDialog`
  (default `true`): `false` renders every mounted row and `CommandEmpty` counts
  mounted rows, for results the caller filters itself.
- **Rust `Select` from the keyboard** (`ev_lib` `uikit`, #161): ArrowDown or
  ArrowUp on the trigger opens the list; opening focuses the chosen option
  (else the first); ArrowUp/ArrowDown/Home/End move between options (wrapping,
  skipping `disabled` ones; on the web in the order on screen, so a re-sorted
  or newly inserted option is walked where it shows), Enter or Space chooses
  (never a disabled option, even a focused one), and letters type ahead (a
  repeated letter cycles; a space inside a query is part of it). Escape and a choice close the list and hand focus
  back to the trigger; Tab and a click outside close it and leave focus where
  it went. The trigger carries `aria-haspopup="listbox"` and, while open,
  `aria-controls` naming the listbox. `SelectItem` takes `disabled` and
  `text_value` (what type-ahead matches; defaults to the text of its children).
- **Escape and outside clicks reach only the top Rust overlay** (`ev_lib`
  `uikit`, #161): new `primitives::use_dismissable_layer`, the mirror of the TS
  dismissable-layer stack. `Select`, `Popover`, `Dialog` and `DropdownMenu` are
  on it — an Escape or a scrim click inside a `Dialog` closes the `Select` or
  `Popover` open above it, not the `Dialog`. Other Rust overlays are listed in
  the uikit README Limitations.
- **`AbSwitcher` Reset and Leave test reload a page reached by an anchor**
  (`@evinvest/kitstart`). On `/fr#quote` with no force parameter the reset
  URL was the page itself, so `location.replace` only scrolled: the cookies
  were dropped but nothing reloaded, and after Leave test the page kept
  sending events without the QA mark. `abReset` now drops the hash.

- **Menu arrow keys stay on the real items** (`@evinvest/uikit`, #209).
  `DropdownMenu` and `ContextMenu` bounded their roving focus by a hardcoded
  64, so End moved to a non-existent item and ArrowDown past the last item
  piled up a hidden index that later ArrowUp presses had to walk back. The
  bound is now the number of mounted, enabled menu items, read at keydown, so
  End lands on the last item, arrows wrap and disabled items are skipped.
  `MenubarContent` counted its children (separators and labels included) and
  never moved focus; it now focuses items the same way. `useRovingFocus`
  accepts `count` as a getter (`() => number`) read only on keydown, and
  clamps a stale index when the item set shrinks.

- **Escape and outside clicks reach only the top overlay layer**
  (`@evinvest/uikit`, #162 step 1). `Drawer` and `CommandDialog` join the
  dismissable-layer stack: an Escape in a `Popover`, `Select`, menu or
  `Command` search inside a Drawer closes that layer, not the panel, and a
  press inside a Drawer or a `CommandDialog` opened above a `Dialog` no
  longer closes the Dialog; their outside click is still the scrim's.
  `DropdownMenu` and `ContextMenu` close on Escape through the stack only (no
  second React `onKeyDown` path). An Escape belongs to the layer that was on
  top when it was pressed, so a handler on its way that closes that layer
  first no longer hands the same key to the layer below. A toast takes no
  Escape: it still closes the Dialog under it. `useDismissableLayer` takes
  `pointerOutside: false` for an overlay whose scrim decides outside clicks.

- **Nested overlay layers keep their order and a modal bars the ones below**
  (`@evinvest/uikit`, #162 step 2). Closes #162. A layer rendered inside
  another stacks above it through a React context, not by when its effect
  ran: a `Popover` opened in its `Dialog`'s own commit (`defaultOpen` on both,
  one shared `open`) takes the first Escape, and a press in it no longer
  closes the Dialog. `Dialog`, `AlertDialog`, `Sheet`, `Drawer` and
  `CommandDialog` are modal: while one is open the layers below ignore every
  pointer-down, so a click on the backdrop of an `AlertDialog`, `Sheet` or
  `Drawer` over a `Dialog` closes the upper one only. Toasts are outside every
  layer: a click on one no longer closes a `Dialog` or a `Popover`. The stack
  lives on `globalThis` (`Symbol.for`), so a micro-frontend with its own uikit
  copy shares the host's. New exports: `DismissableLayerScope` (wrap a custom
  overlay's content so layers in it stack above), `LAYER_IGNORE_ATTR`, and
  `useDismissableLayer`'s `modal` option.

- **`uikit::Slider` drag no longer sticks off the web** (`ev_lib`, #47).
  Without pointer capture (desktop/native renderers) a release outside the
  slider never reached `onpointerup`, so the value kept following the bare
  cursor. A `pointermove` with no button held now ends the drag, as do
  `pointerleave` and `pointercancel`; the web build keeps its pointer capture.
- **`uikit::Calendar` opens on the current month** (`ev_lib`, #48). The
  uncontrolled month was hardcoded to June 2026; `default_month` (now
  `Option`) and `today` default to the host date like the TS `new Date()` —
  the browser's local date on `wasm`, the UTC date from `SystemTime` natively.
  New `CalendarDate::today()`. `DateTimePicker`'s `today` follows suit.
- **`uikit::FormItem` and `InfoTip` ids survive hydration** (`ev_lib`, #49).
  Their ids came from process-global counters, so a long-lived SSR server and a
  fresh client disagreed. They now derive from the component's place in the
  tree (new `primitives::use_stable_id`, the analogue of React's `useId`).
- **A `Toggle` that is on is the primary fill** (both ports, #175). It wore
  `bg-hover` — ~1.2:1 against the surface and the very tint an outline toggle
  wore on hover, so in a weekday `ToggleGroup` the selected days could not be
  told from a pointed-at one. On is now `bg-primary text-on-primary` (≥ 3:1
  against `background`, `secondary`, `card` and `popover`; the outline variant
  also takes `border-primary`), hover stays a surface tint, and the toggle
  wears the offset `FILLED_FOCUS_RING` instead of the halo. A consumer that
  styled the old on-state with its own classes should drop them.
- **Destructive menu rows read at AA** (both ports, #166). The row's text and
  icon move from `text-accent-error` to a new derived token,
  `--accent-error-ink` (`color-mix(in srgb, var(--accent-error) 70%,
  var(--ink))`; EV `#ec8379`): 4.83:1 on the row's `accent-error/10` tint over
  `popover` (was 3.76:1), 5.36:1 on `popover`. Derived, so an existing brand
  file keeps rendering; one whose mix misses 4.5:1 pins `accent-error-ink` in
  its `[colors.*]`. See `docs/spec/accents.md`.
- **`ev_lib::uikit` a11y and markup parity with the TS port** (`ev_lib`,
  #45 #46 #50 #51 #52). `FormMessage` renders nothing without children (an
  empty string included), so a valid field no longer carries an empty `<p>`
  and a spurious grid gap. `FieldSeparator` sets `data-content` from its
  children and omits the content span when it has none, so a bare divider is
  no longer notched. `Slider`'s `aria_label` now names the `role="slider"`
  thumb instead of the role-less root. `PaginationLink` takes an optional
  `aria_label` (additive, not breaking); `PaginationPrevious`/`PaginationNext`
  pass "Go to previous page"/"Go to next page", so they stay named below `sm`
  where the visible text is hidden. `CommandDialog` and `DrawerContent` set
  `aria-modal="true"` like `Dialog`/`AlertDialog`/`Sheet`.

- **`Calendar` weekday headers stay on one line in `vi` and `he`**
  (`@evinvest/uikit`, #122). CLDR spells the Vietnamese short weekday as two
  words ("Thứ 2"), which wrapped inside the fixed 36px column and grew the
  popover by ~27px; Hebrew ("יום ב׳") has the same shape. A locale whose
  `short` form carries whitespace now falls back to `narrow` ("T2" … "T7",
  "CN"; "ב׳" … "א׳") when that form is still unambiguous, and the header cell
  is `whitespace-nowrap` so no locale can wrap it either way; en/ru/de/fr
  render byte-for-byte as before.

- **`DateTimePicker` closes on Tab out** (`@evinvest/uikit`, #120). Tab from
  the last control / Shift+Tab from the first closes the popover and returns
  focus to the trigger; the portalled content is the last child of `<body>`, so
  a real Tab previously dropped focus out of the document with the dialog still
  open. Alt-tab (blur with a null `relatedTarget`) still keeps it open. TS only
  — the Rust port renders inline.
- **`uikit::Fonts` is back.** #105 cut it on the argument that brand assets are
  not a UI kit's business. The argument is sound; the move was not, because
  nothing else shipped the faces. `tokens.css` kept naming `"Inter"` and
  `"Playfair Display"` in its `--font-*` chains with no `@font-face` behind
  them, so every Dioxus consumer fell silently through to `ui-sans-serif` — a
  typography regression with no error and no log line. `real_estate_allocation`
  was insulated only by its `^0.9.0` pin and hit it the moment that moved. The
  `dioxus?/asset` feature comes back with it; that is what puts `asset!` in
  scope. It stays here until there is somewhere for it to go.
- **`uikit` overlays scroll with the page and get their exit animation back**
  (`@evinvest/uikit`). `useFloating` moves from `position: fixed` plus a
  scroll-driven React state — always a frame or two behind the compositor — to
  `position: absolute` at the containing block's origin, moved with the CSS
  `translate` property written straight to the DOM. A document scroll carries
  the overlay natively; the side is chosen on open and resize, never on scroll.
  Sizes come from the layout box, not the rect the `zoom-in-95` enter animation
  reports scaled on its first frame. `usePresence` defers unmount to the end
  of the exit animation again; the flicker that made `0.1.2` drop it was the
  `fill-mode: none` snap-back frame, now skipped by unmounting synchronously
  (`flushSync`) inside `animationend`. The `Calendar` paints no background of
  its own, always renders six 36px-cell weeks (the popover never changes size
  with the month or the locale's weekday labels), and the `DateTimePicker`
  grows a close button (`labels.close`) beside Clear, both ports.

### Changed

- **`AbSwitcherPanel` shows an unassigned experiment as off**
  (`@evinvest/kitstart/react`): no `ab_<key>` cookie (or no entry in
  `current`) now reads `not running` by default (`text.unassigned`, was
  `not assigned`) and its variant buttons are disabled — the menu mounts on a
  place's page, where the proxy assigns every running experiment and would
  refuse a force for one that is not. `–` on the chip as before. A test
  listed in the QA-only cookie `<qaCookie>_off` — the brand proxy's list of
  paused tests, whose assignment cookies stay — reads the same (`abRunning`).

- **`experiments` — weights are equal unless overridden** (**Breaking**, both
  ports; #16; a major for `@evinvest/experiments`). Weights are no longer
  declared in code: every variant gets an equal share. `weights` is gone from
  the TS `ExperimentSpec` (`satisfies ExperimentConfig` rejects it) and from
  the Rust `Experiment`; `Experiment::new(variants, weights)` is now
  `Experiment::new(variants)`, and `Experiment::uniform` is removed — use
  `Experiment::new`. Manual weights come only from an operator override in the
  panel: `applyOverrides` lays them over the config under a package-private
  key, and `pickVariant` reads only that — a `weights` field left in a config
  (one without `satisfies`) is ignored and not carried over — falling back to
  equal shares; Rust has no override path. kitstart's `DeclaredExperiment` drops
  `weights` and `experiments.declared@1` sends one each per variant — the
  panel contract is unchanged. Migration: delete `weights` from every
  experiment config; a split that was not equal is set in the panel.
  Equal-weight picks are unchanged, so existing cookies and hashed subjects
  keep their arms.

- **`settings` — drift watching is a generated method** (**Breaking**, Rust).
  The new native-only `settings_drift` feature makes every `settings!` struct
  generate `watch_drift() -> Infallible`: it polls the Secret mounted at
  `$SETTINGS_DRIFT_MOUNT` every 5 min and `tracing::warn!`s each var that moved
  since the watch started. Race it against the main future in a `select!`.
  `settings::drift::{Watcher, Snapshot, VarChange, ChangeKind}` are gone from
  the public API; delete the per-service `config_drift.rs` that drove them.
  Plain `settings` stays zero-dep.

- **`uikit` — `--primary` is a fill, `--primary-ink` is the ink** (**Breaking**,
  both ports; #119). `--primary` is now the fill teal `#128377` under a white
  `--on-primary` (4.63:1; ≥ 3:1 against `background`, `secondary`, `card` and
  `popover`), and the readable teal `#2a9d8f` moves to a **new, required**
  `--primary-ink` — a consumer sheet that does not define it renders every
  link, eyebrow, radio dot and focus ring transparent. `--ring` is now the ink.
  Inside the kit the split is already applied: `Button` `Link`, the eyebrow,
  description links, the radio dot, the checked `Field` outline, the `Slider`
  range and thumb border and the `Progress` indicator (on a `bg-primary-ink/20`
  track) are the ink; `bg-primary text-on-primary`, a checked `Checkbox` /
  `Switch` and the `Primary` band are the fill, and an eyebrow inside a
  `Primary` band wears `on-primary`. Migration for a consumer's own classes:
  `text-primary` → `text-primary-ink`; `border-primary` used as an outline →
  `border-primary-ink`; a chip `bg-primary/N text-primary` keeps its tint and
  takes `text-primary-ink`; leave `bg-primary text-on-primary` alone. See
  `docs/spec/accents.md`.
- **`i18n` — English is written where it renders** (breaking, both ports;
  `@evinvest/i18n` 0.7.0, `ev_lib` 0.13.0). `t` takes the key *and* the English
  sentence — `t("hero.title", "Invest in …")` / `t!(tr, "hero.title", "Invest
  in …")` — and `messages/en/common.json` is generated back out of the code. The
  contract was already running in site_conductor, as ~90 lines of app-local
  code that had to fork `@evinvest/i18n/react` because the package's `Translate`
  could not express it; this moves it to the one place both apps and both
  languages read from. A key a translated catalogue lacks now renders the
  sentence the call site asked for, not the raw key: **this reverses a
  documented decision**, and reverses it because its premise is gone. Rendering
  a dotted key was defensible while the catalogue was the only place the English
  lived. `Translator::has` went with it — its only purpose was branching around
  that placeholder. For `en` the catalogue is not consulted at all.
- **`mfe!` — `messages:` is a required arm** (breaking, `ev_lib` 0.13.0). A
  producer declares a `fn(Locale) -> Messages`; the macro resolves the host's
  locale at mount and provides a `Translator` as context above the root. Not
  optional: a producer with no copy passes an empty catalogue as one deliberate,
  reviewable line, and a producer *with* copy cannot forget the locale — which
  is exactly what the second element remote did. `mfe` now implies `i18n`.

### Added

- **`applyOverrides`** (`@evinvest/experiments`): lays an operator's
  `{ enabled?, weights?, holdout? }` per key over the config in code, so a
  landing's proxy can take weights and the kill switch from the Service-Arb
  panel without a deploy. Each field is checked against the code on its own
  (weights of the declared length, `>= 0`, sum `> 0`; holdout in `[0, 1)`;
  enabled a boolean) and dropped when invalid; unknown keys are ignored and
  variants never come from outside the code. TS-only for now.
- **Experiments from the Service-Arb panel** (`@evinvest/kitstart/server`).
  `createExperimentsSource` reads `GET <base>/experiments` for the proxy:
  the first call waits (1.5 s timeout), later ones answer from memory with a
  30 s TTL and stale-while-revalidate; a failure keeps the last good answer
  (`{}`, the config in code, before the first one). `declareExperiments` queues `experiments.declared@1` in the lead
  webhook's outbox at start (signed and retried like a lead, never throwing),
  leaving out and logging an experiment the panel would refuse.
- **`analytics_id` on a lead** (`@evinvest/kitstart`). `AnalyticsBoundary`
  now holds one beacon `distinct_id` per page (in memory) and `LeadCapture`'s
  script posts it; `quoteRoute` passes it, checked against
  `[A-Za-z0-9._:-]{1,128}`, to the webhook as `ctx.analyticsId` for the
  brand's `lead.created` body. Optional both ways: an older page posts none.
- **`classNames.estimateGrid` on `LeadCapture`** (`@evinvest/kitstart/react`):
  the grid of an estimate input's answer tiles, so a brand sets its own column
  count (`"grid-cols-3 sm:grid-cols-4"` for a shorter card). Without it the
  grid stays two columns, three from `sm`; the tile keeps its 44 px minimum.
- **`i18n::t!`** (Rust): `$key` and `$en` are `literal` fragments, so the
  compiler is the literal-ness gate the TypeScript extractor has to enforce by
  hand. Natively each site also registers its pair with `i18n::catalogue()`, so
  **extraction is linking, not parsing** — a site that compiles is in the
  catalogue whether or not it ever renders. A recording `Translator` driven by
  one SSR pass would silently drop every string behind a branch that did not
  run, which is the failure class this exists to catch. One new dependency,
  `inventory`, declared native-only so a shipped wasm bundle stays zero-dep. The
  ceiling it buys: copy must live in natively-compilable code — which the
  component-MFE snapshot contract already required of a producer.
- **`localeOfElement` / `mfe::host_locale`**: the locale a DOM subtree is
  written in, via `closest("[lang]")`. This is how an element remote learns its
  language, and the reason it is read from the DOM rather than taken as a prop
  is mechanical: a host mounts the element before it applies attributes, so
  anything pushed in reads as absent at `connectedCallback` time. Previously
  each host solved this privately — or, in the second case, forgot to.
- **`evinvest-i18n-extract` / `evinvest-i18n-check`**: the extractor, moved out
  of site_conductor and generalised over `--root` / `--exclude` / `--messages`.
  `--exclude` names what is *not* source, because a list of source directories
  is a hole that opens the day someone adds a slice, and an unscanned call site
  produces no error — just English forever in five locales. Both refuse a `t()`
  whose key or English is not a literal. `typescript` is an optional peer
  dependency: needed to run the extractor, never to render a string.

- **`settings` — deployment-profile guards (both ports)**: `#[required_in("production")]`
  (Rust) / `requiredIn(v, 'production')` (TS) turns an optional or defaulted
  setting back into a boot failure in the named profiles. The setting that hurts
  is not the missing required one — that already stops the boot — but the
  optional whose absence is a *silent* no-op: no `SMTP_HOST` means mail is logged
  instead of sent, no `SENTRY_DSN` means the alerts never arrive. On a defaulted
  field the dev-shaped default stops applying there, so the value must be
  explicit. The profile is the canonical `APP_ENV` read from the same source
  (unset ⇒ `development`, so an unconfigured environment is never mistaken for
  production); TS additionally takes a `profile` override for Next.js, where
  `NODE_ENV` already owns that name. Refused at compile time (Rust) / declaration
  time (TS) on a setting that is already required everywhere.
- **`settings` — `required_var_names(profile)`** (Rust): the deploy-time
  checklist, so a preflight can diff a Secret's keys against what the image
  actually needs instead of discovering the gap as a CrashLoopBackOff.
- **`settings` — `or_exit` / `orExit`**: fail a boot with `EX_CONFIG` (78)
  instead of a nondescript 1, so "the config is wrong, a restart cannot help" is
  distinguishable from the dependency blip a restart does fix.
- **`settings::drift`** (Rust): detects that the source a process was configured
  from has moved on without it. Polling `std::env` is useless by construction —
  it is fixed at `exec`, and a runtime that injected values through `envFrom`
  never revisits them — so the watcher takes an **injected** source, to be
  pointed at something that does move (a Secret mounted as files, a rendered
  dotenv). The baseline is boot, not the previous poll, so a stale process keeps
  reporting until it is replaced. It only detects: nothing is applied in place,
  because a process that reconfigures itself erases the gitops env edit that was
  the audit trail. Snapshots hold hashes and a change is a name plus a verb, so
  the whole path is safe to log.

- **`error_monitoring::Config.service`** (Rust, native): names the service on
  every event and transaction as a `service` tag. A Sentry project is a DSN, so
  sibling services commonly share one and were separable only by hostname in the
  issue list. Set from the same value as `OTEL_SERVICE_NAME` so an issue, a trace
  and a log line agree. It is a scope tag rather than a `before_send` hook
  because `before_send` never sees transactions, which need the name just as
  much. **Breaking:** `Config` gains a public field, so struct literals must add
  `service` (`None` keeps the old behaviour).
- **`uikit` — `terminal`** (both ports; the class tables are generated from
  Rust): a trading terminal over an investment product's shares — ticker,
  chart slot | order book | order form, open orders — the way a spot exchange
  lays it out. `Terminal` is a viewport-bound grid from `lg` (a phone stacks
  the panes) that places each `TerminalPane` by `TerminalArea`, so the desktop
  layout does not depend on DOM order. `OrderBook` rows carry a depth bar
  behind the figures and colour the price by `BookSide` (bids positive, asks
  loud); `TradesTapeRow` reads the same enum; `OrderFormSubmit` fills by
  `OrderSide`. The chart is a sized `relative` slot and nothing more — the
  plotting engine stays the consumer's (React hands the element out through a
  `ref`, Dioxus through an `id`) — and the open-orders pane reuses `Table` and
  `Tabs`, contributing only `OpenOrdersEmpty`. Same `data-slot` / `data-area` /
  `data-side` attributes on both sides, so one stylesheet or test selector
  reads either port.

### Fixed

- `error_monitoring` (Rust, native): a malformed or empty `Config.dsn` now
  disables reporting instead of panicking at boot, matching the wasm and TS
  ports' documented no-op contract — a monitoring typo no longer crash-loops
  the service.
- `uikit` (**both ports**): `CommandEmpty` renders only when a query matched
  nothing. It gated on "is there a query", so "No results found." showed next to
  matching items; items now register their value through the Command context, so
  the empty state can tell "nothing matched" from "nothing is here". The query is
  trimmed once and shared by the item filter and the empty-state gate, so blank
  input is uniformly not a search (it previously hid every item **and** the empty
  state, leaving a blank palette).

## 2026-07-07 — uikit 0.6.0 · Rust brand-chrome catch-up

Rust `ev_lib` 0.5.0 · `@evinvest/uikit` 0.6.0. The Dioxus port catches up to two
TypeScript uikit releases — uikit 0.5.0 (Header density variants) and 0.6.0 (the
shared status pages), both 2026-07-06 — so both ports render one identical shell
again. Those two TS releases are folded into this single wave; the crate ships as
one versioned unit, so `ev_lib` 0.5.0 covers both.

### Added

- **Status pages — `StatusScreen` + `NotFound` / `Forbidden` / `ServerError`**
  (Rust; TS since uikit 0.6.0, 2026-07-06): the shared 404 / 403 / 500 surface
  ported from site_conductor — a centred hero (skyline-crown mark, mono eyebrow,
  Playfair code, italic-accent headline, CTAs) with a per-status accent
  (`StatusAccent`: teal / gold / red / blue). The ready-made pages bake in their
  copy; a host passes only hrefs. `ServerError`'s retry runs a host `reset` or
  reloads. `status_button_class` is exposed for bespoke CTAs.
    - TS: `linkComponent` routes CTAs through `next/link` for soft nav.
    - Dioxus: renders plain `<a>` (a full document load, as an error page wants —
      no `linkComponent` equivalent) and reloads via `document::eval`.
- **`Header` — `compact` variant + `hideNav`** (Rust; TS since uikit 0.5.0,
  2026-07-06): `variant="compact"` (Rust `HeaderVariant::Compact`) is a fixed
  short opaque bar for app surfaces — no scroll growth, a known 4rem height a
  sticky sidebar can butt flush against; `marketing` (default) keeps the
  scroll-aware bar. `hideNav` (`hide_nav`) drops the nav — desktop row + mobile
  menu — keeping just the lockup and CTA.

## 2026-07-04 — uikit 0.4.0

Rust `ev_lib` 0.4.0 · `@evinvest/uikit` 0.4.0. The EV brand chrome, mirrored
across both ports, so every surface (site_conductor, cabinet, REA) renders one
identical shell (EV-invest/site_conductor#55).

### Added

- **Brand chrome — `Header` / `Footer` / `Logo`** (Rust + TS): the site shell
  ported from site_conductor's `application/layout`. Scroll-aware fixed header
  with brand lockup, desktop nav and a built-in full-screen mobile menu; the
  12-col footer (sitemap groups, offices, optional newsletter slot, build-version
  line); the mark as a self-contained data-URI CSS mask (no asset pipeline).
  Nav items and CTAs stay app-side — the kit owns only the chrome.
    - TS: `linkComponent` prop lets Next hosts pass `next/link`; default `<a>`.
    - Dioxus: web behaviors (scroll state, body-scroll lock, Escape,
      close-on-navigate delegation) via `document::eval`, SSR-safe no-op.

## 2026-06-22 — uikit 0.3.0

Rust `ev_lib` 0.3.0 · `@evinvest/uikit` 0.3.0. The toast (`sonner`) animation
suite, mirrored across both ports. ([#12])

### Added

- **Toast / `sonner` animation suite** (Rust + TS): Sonner-style enter/exit
  animation, stacking that collapses into a pile and expands on hover/focus, and
  a host-timer-free CSS lifecycle.
    - TS: swipe-to-dismiss, hover-to-pause auto-dismiss, and persistent
      (no-duration) toasts.
    - Dioxus: stacking + expand-on-hover mirrored; auto-dismiss driven by a no-op
      CSS `ev-toast-life` animation (no host timer); the enter plays as a keyframe
      on DOM insertion (fixes the Dioxus appear).
- **Viewers** for previewing the kit against live code: a React example app
  (`ts/uikit/example`) and a Dioxus viewer crate (`rust/uikit-viewer`).

### Changed

- The Rust crate is published to crates.io as **`ev_lib`** (the `ev` name was
  taken); the import path stays **`use ev::…`**.
- Native `analytics` / `error_monitoring` backends moved to **`reqwest` 0.13**
  (rustls).
- Applied `codestyle` formatting.

### Fixed

- Toast restack settles instead of bouncing back; stacked toasts stay inside the
  viewport edge; the enter no longer couples to the restack (rapid-fire lag).

## 2026-06-20 — uikit 0.2.0

Rust `ev` 0.2.0 · `@evinvest/uikit` 0.2.0. ([#8])

### Added

- `Container` component.
- Responsive page-gutter and radius tokens.

> The Rust crate's `0.2.0` also folds in everything since `0.1.0` — the whole
> `uikit` feature and the three I/O libraries below — because the crate ships as
> one versioned unit.

## 2026-06-18 — analytics · error-monitoring · experiments 0.1.0

Three opt-in I/O libraries, each mirrored Rust ↔ TS and gated per target.
([#6], [#7])

### Added

- **`analytics`** — PostHog product analytics (`@evinvest/analytics`; Rust
  `analytics` feature). `@evinvest/analytics` **0.1.2** (2026-06-19) added the
  `/next` subpath and buffered captures behind a single pageview. ([#7])
- **`error-monitoring`** — Sentry (`@evinvest/error-monitoring`; Rust
  `error_monitoring` feature, native-only `sentry` crate).
- **`experiments`** — frontend-only, zero-runtime-dep A/B testing
  (`@evinvest/experiments`; Rust `experiments` feature), reporting exposure
  through an injected sink.

### Fixed

- `experiments`: the TS `pickVariant` zero-total fallback now matches Rust.

## 2026-06-16 — uikit 0.1.1 / 0.1.2 · public npm

The big `uikit` PR landed and the packages went public on npm. ([#2])

### Added

- npm publishing: packages scoped under **`@evinvest`** (the `@ev` scope was
  taken); `@evinvest/uikit` ships as a `"use client"` bundle for RSC / the App
  Router.

### Fixed

- `0.1.1` — Slider thumb position and Portal/floating sync; overlays no longer
  jump to the top-left.
- `0.1.2` — Slider drag from the thumb; dropped the exit animation that caused an
  overlay close flicker.

### Build

- Pinned the Rust nightly toolchain via `rust-toolchain.toml` (codestyle emits
  nightly-only features).

## 2026-06-15 — uikit 0.1.0 · architecture (TypeScript) 0.1.0

### Added

- **`@evinvest/uikit` 0.1.0** / Rust `uikit` feature — a dep-light UI kit
  mirrored Rust (Dioxus) ↔ TS (React) with a shared design-token contract:
    - Tier A — 22 static components.
    - Behaviour primitives — controllable state, portal, floating, dismiss, focus
      scope, presence, roving focus.
    - Tiers B / C / D — 41 interactive, overlay & engine components.
- **`@evinvest/architecture` 0.1.0** — the DDD kernel ported to TypeScript,
  mirroring the Rust `architecture` feature's semantics (zero runtime deps,
  I/O-free).

### Build

- Adopted the `v_flakes` org Nix toolchain; relocated the `ev` crate into `rust/`
  under a root workspace; configured prettier; added the docs/README fragments
  and per-package READMEs.

## 2026-06-14 — Initial scaffold

Rust `ev` 0.1.0.

### Added

- Scaffolded the `ev` shared-libs monorepo with the **`architecture`** DDD kernel
  as the first Rust feature — zero-dep, I/O-free, and `wasm32`-safe (host-only id
  minting gated behind `cfg(not(target_arch = "wasm32"))`).

[#2]: https://github.com/EV-invest/lib/pull/2
[#6]: https://github.com/EV-invest/lib/pull/6
[#7]: https://github.com/EV-invest/lib/pull/7
[#8]: https://github.com/EV-invest/lib/pull/8
[#12]: https://github.com/EV-invest/lib/pull/12

