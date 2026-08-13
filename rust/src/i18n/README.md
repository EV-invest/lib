# `i18n`

Five-locale internationalisation — the Rust half of `@evinvest/i18n`.

```toml
ev_lib = { version = "0.8", default-features = false, features = ["i18n"] }
```

Zero dependencies, `wasm32`-safe, no I/O.

## Why a Rust half exists

`real_estate_allocation` is a Dioxus app. It cannot import an npm package, and a
zone rendering English chrome inside a Russian shell is exactly the failure the
shared locale registry was created to prevent.

The two halves are not merely similar — they read **the same
`messages/<locale>/*.json` files** and apply the same rules, so a catalogue
authored for the site works unchanged in a zone and neither half can drift
alone. `tests.rs` pins that: it renders the site's shipped plural patterns and
asserts the output matches what `Intl.PluralRules` + `Intl.NumberFormat` produce
in the browser.

## What's here

| Item | What |
| --- | --- |
| [`Locale`] | the five locales, their codes and their native labels |
| [`locale_path`] / [`split_locale_path`] | the `/<locale>` URL contract — default unprefixed, everything else prefixed |
| [`negotiate`] | `Accept-Language`, with q-values and regional-tag matching |
| [`Translator`] / [`format_message`] | ICU-subset formatter: `{name}`, `plural`, `select`, `#`, `'` quoting |
| [`policy`] | rules 1.1–1.3: English is canonical, stale translations are refused, untranslated content is hidden |

## The two things worth knowing before you change this

**Plural rules are hand-written, and that ceiling is deliberate.** `Intl` has no
`std` equivalent, and ICU4X would put megabytes of locale data into a wasm
bundle. The rules in `plural.rs` are transcribed from CLDR 46 for exactly five
locales. Adding a sixth means transcribing its rule by hand — which is the
review moment a generic fallback would quietly rob us of. `plural_categories`
and `select_plural` must agree; a test asserts it, because the policy's plural
check is only sound if they do.

**`other` is not a wildcard in the policy.** The formatter falls back to `other`
at runtime so a view cannot break — that is not evidence a translation is right.
A Russian `one`/`other` pair renders "5 участка" for five, which is grammatical
nonsense the runtime cannot detect, *because it got a branch*. The policy
therefore requires every category the locale declares. Vietnamese declares only
`other` and so passes on the same rule, not an exemption.

## Formatting numbers and money is not this module's job

`plural` and `select`, yes. `number`, `date`, `currency`, no. A consuming app
owns one policy per unit of measure and interpolates the already-formatted
string; a second, competing number policy hiding inside message catalogues is
precisely the drift that rule exists to prevent. The one exception is `#` inside
a plural branch, which *is* the count — see [`Locale::format_number`].

[`Locale`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/enum.Locale.html
[`Locale::format_number`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/enum.Locale.html#method.format_number
[`Translator`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/struct.Translator.html
[`format_message`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/fn.format_message.html
[`locale_path`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/fn.locale_path.html
[`split_locale_path`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/fn.split_locale_path.html
[`negotiate`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/fn.negotiate.html
[`policy`]: https://docs.rs/ev_lib/latest/ev_lib/i18n/policy/index.html
