use super::{
	DEFAULT_LOCALE, LOCALES, Locale, MessageValue, MessageValues, Messages, PluralCategory, Translator, format_message, locale_alternates, locale_path, negotiate,
	policy::{MissingContentPolicy, RejectionReason, TranslatedCatalogue, TranslatedEntry, audit, available_in, resolve_catalogue},
	split_locale_path,
};

fn values(pairs: &[(&str, MessageValue)]) -> MessageValues {
	pairs.iter().map(|(k, v)| ((*k).to_owned(), v.clone())).collect()
}

// ── registry ─────────────────────────────────────────────────────────────────

#[test]
fn parses_language_codes_and_rejects_country_codes() {
	assert_eq!(Locale::parse("ru"), Some(Locale::Ru));
	assert_eq!(Locale::parse("vi"), Some(Locale::Vi));
	// `vn` is the ISO 3166 country code, not a language subtag. Accepting it
	// would emit an invalid `hreflang` Google silently discards.
	assert_eq!(Locale::parse("vn"), None);
	assert_eq!(Locale::parse(""), None);
	assert_eq!(Locale::parse("EN"), None, "codes are lowercase; callers normalise");
}

#[test]
fn every_locale_labels_itself_in_its_own_language() {
	// A reader who cannot read the current language cannot read "Russian" either.
	assert_eq!(Locale::Ru.label(), "Русский");
	assert_eq!(Locale::Vi.label(), "Tiếng Việt");
	assert_eq!(Locale::De.label(), "Deutsch");
}

// ── URL contract ─────────────────────────────────────────────────────────────

#[test]
fn default_locale_is_unprefixed_and_others_are_not() {
	assert_eq!(locale_path(Locale::En, "/team"), "/team");
	assert_eq!(locale_path(Locale::Ru, "/team"), "/ru/team");
	// "/ru/" would be a second URL for the same page to a crawler.
	assert_eq!(locale_path(Locale::Ru, "/"), "/ru");
	assert_eq!(locale_path(Locale::En, "/"), "/");
	assert_eq!(locale_path(Locale::Ru, "team"), "/ru/team", "a missing leading slash is repaired");
}

#[test]
fn split_is_the_inverse_of_locale_path() {
	for locale in LOCALES {
		for path in ["/", "/team", "/hiring/analyst", "/a/b/c"] {
			let url = locale_path(locale, path);
			assert_eq!(split_locale_path(&url), (locale, path.to_owned()), "round trip failed for {locale} {path}");
		}
	}
}

#[test]
fn unknown_prefix_reads_as_default_rather_than_failing() {
	// `/vn/team` is not a locale — it must stay a path, not become a 500.
	assert_eq!(split_locale_path("/vn/team"), (Locale::En, "/vn/team".to_owned()));
	assert_eq!(split_locale_path("/team"), (Locale::En, "/team".to_owned()));
	// An explicit `/en` prefix is not the canonical shape, so it reads as a path.
	assert_eq!(split_locale_path("/en/team"), (Locale::En, "/en/team".to_owned()));
}

#[test]
fn alternates_cover_every_requested_locale() {
	let alts = locale_alternates("/team", &LOCALES);
	assert_eq!(alts.len(), 5);
	assert_eq!(alts[0], (Locale::En, "/team".to_owned()));
	assert_eq!(alts[1], (Locale::Ru, "/ru/team".to_owned()));
	// A surface translated into a subset is not forced to claim all five.
	let subset = locale_alternates("/team", &[Locale::En, Locale::Vi]);
	assert_eq!(subset.len(), 2);
}

// ── negotiation ──────────────────────────────────────────────────────────────

#[test]
fn negotiate_honours_q_values_and_regional_tags() {
	assert_eq!(negotiate(Some("ru-RU,ru;q=0.9,en;q=0.8"), &LOCALES), Locale::Ru);
	assert_eq!(negotiate(Some("en;q=0.4,de;q=0.9"), &LOCALES), Locale::De);
	assert_eq!(negotiate(Some("fr-CA"), &LOCALES), Locale::Fr, "regional tag matches its base language");
	assert_eq!(negotiate(Some("ja,ko;q=0.8"), &LOCALES), Locale::En, "no match falls back");
	assert_eq!(negotiate(None, &LOCALES), Locale::En);
	assert_eq!(negotiate(Some(""), &LOCALES), Locale::En);
}

#[test]
fn negotiate_treats_q_zero_as_refusal_not_weak_preference() {
	// "de but definitely not ru" must not return ru.
	assert_eq!(negotiate(Some("ru;q=0,de"), &LOCALES), Locale::De);
}

#[test]
fn negotiate_survives_a_malformed_q_value() {
	// A broken q= sorts last rather than poisoning the comparison.
	assert_eq!(negotiate(Some("ru;q=banana,de;q=0.5"), &LOCALES), Locale::De);
}

#[test]
fn negotiate_wildcard_yields_the_default() {
	assert_eq!(negotiate(Some("*"), &LOCALES), DEFAULT_LOCALE);
}

// ── plural rules ─────────────────────────────────────────────────────────────

#[test]
fn russian_selects_all_four_categories_at_the_cldr_boundaries() {
	use PluralCategory as P;
	let cases = [
		(1.0, P::One),
		(21.0, P::One),
		(101.0, P::One),
		(11.0, P::Many), // 11 is the exception to "ends in 1"
		(2.0, P::Few),
		(23.0, P::Few),
		(12.0, P::Many), // 12–14 are the exception to "ends in 2–4"
		(5.0, P::Many),
		(0.0, P::Many),
		(100.0, P::Many),
	];
	for (n, expected) in cases {
		assert_eq!(Locale::Ru.select_plural(n), expected, "ru.select({n})");
	}
	// A fraction always selects `other`: every ru category requires v = 0.
	assert_eq!(Locale::Ru.select_plural(1.5), P::Other);
}

#[test]
fn the_other_four_locales_follow_their_own_rules() {
	use PluralCategory as P;
	assert_eq!(Locale::En.select_plural(1.0), P::One);
	assert_eq!(Locale::En.select_plural(0.0), P::Other);
	assert_eq!(Locale::De.select_plural(1.0), P::One);
	// Vietnamese has no plural inflection at all.
	for n in [0.0, 1.0, 5.0, 100.0] {
		assert_eq!(Locale::Vi.select_plural(n), P::Other);
	}
	// French `one` covers both 0 and 1 — unlike English.
	assert_eq!(Locale::Fr.select_plural(0.0), P::One);
	assert_eq!(Locale::Fr.select_plural(1.0), P::One);
	assert_eq!(Locale::Fr.select_plural(2.0), P::Other);
	assert_eq!(Locale::Fr.select_plural(1_000_000.0), P::Many);
}

#[test]
fn declared_categories_match_what_select_can_return() {
	// The policy's plural check is only sound if these two agree.
	for locale in LOCALES {
		let declared = locale.plural_categories();
		for n in 0..=130 {
			let selected = locale.select_plural(f64::from(n));
			assert!(declared.contains(&selected), "{locale} selected {selected} for {n}, which it does not declare");
		}
	}
}

#[test]
fn numbers_are_grouped_the_way_each_locale_writes_them() {
	assert_eq!(Locale::En.format_number(1_234_567.0), "1,234,567");
	assert_eq!(Locale::De.format_number(1_234_567.0), "1.234.567");
	assert_eq!(Locale::Vi.format_number(1_234_567.0), "1.234.567");
	// Non-breaking spaces, so a number cannot wrap across a line break.
	assert_eq!(Locale::Fr.format_number(1_234_567.0), "1\u{202f}234\u{202f}567");
	assert_eq!(Locale::Ru.format_number(1_234_567.0), "1\u{a0}234\u{a0}567");
	assert_eq!(Locale::En.format_number(999.0), "999");
	assert_eq!(Locale::En.format_number(0.0), "0");
	assert_eq!(Locale::De.format_number(-1234.5), "-1.234,5");
}

// ── formatter ────────────────────────────────────────────────────────────────

#[test]
fn interpolates_named_arguments() {
	let v = values(&[("city", MessageValue::from("Quy Nhơn"))]);
	assert_eq!(format_message("Our office in {city}.", Locale::En, &v), "Our office in Quy Nhơn.");
}

#[test]
fn an_unsupplied_argument_renders_verbatim_rather_than_vanishing() {
	// A hole in the copy is invisible; "{city}" on screen is a bug report.
	assert_eq!(format_message("Our office in {city}.", Locale::En, &MessageValues::new()), "Our office in {city}.");
}

#[test]
fn integral_numbers_render_without_a_trailing_decimal() {
	let v = values(&[("n", MessageValue::Num(3.0))]);
	assert_eq!(format_message("{n} rooms", Locale::En, &v), "3 rooms");
}

#[test]
fn plural_selects_the_branch_and_binds_the_count_to_pound() {
	let pattern = "{count, plural, one {# role} other {# roles}}";
	let t = |n: f64| format_message(pattern, Locale::En, &values(&[("count", MessageValue::Num(n))]));
	assert_eq!(t(1.0), "1 role");
	assert_eq!(t(2.0), "2 roles");
	assert_eq!(t(0.0), "0 roles");
}

#[test]
fn exact_match_branches_beat_the_category() {
	let pattern = "{n, plural, =0 {no roles} one {# role} other {# roles}}";
	let t = |n: f64| format_message(pattern, Locale::En, &values(&[("n", MessageValue::Num(n))]));
	assert_eq!(t(0.0), "no roles");
	assert_eq!(t(1.0), "1 role");
}

#[test]
fn a_plural_falls_back_to_other_when_its_category_is_absent() {
	// Not a policy question — at runtime a missing branch must still render.
	let pattern = "{n, plural, other {# вакансий}}";
	assert_eq!(format_message(pattern, Locale::Ru, &values(&[("n", MessageValue::Num(2.0))])), "2 вакансий");
}

#[test]
fn pound_is_localised_inside_the_branch() {
	let pattern = "{n, plural, other {# объектов}}";
	let out = format_message(pattern, Locale::Ru, &values(&[("n", MessageValue::Num(12_500.0))]));
	assert_eq!(out, "12\u{a0}500 объектов");
}

#[test]
fn select_chooses_by_string_and_falls_back_to_other() {
	let pattern = "{kind, select, villa {A villa} plot {A plot} other {A property}}";
	let t = |k: &str| format_message(pattern, Locale::En, &values(&[("kind", MessageValue::from(k))]));
	assert_eq!(t("villa"), "A villa");
	assert_eq!(t("plot"), "A plot");
	assert_eq!(t("penthouse"), "A property");
}

#[test]
fn a_select_nested_in_a_plural_keeps_pound_bound_to_the_enclosing_count() {
	let pattern = "{n, plural, other {# {kind, select, villa {villas} other {lots}}}}";
	let v = values(&[("n", MessageValue::Num(3.0)), ("kind", MessageValue::from("villa"))]);
	assert_eq!(format_message(pattern, Locale::En, &v), "3 villas");
}

#[test]
fn apostrophes_in_ordinary_copy_survive_untouched() {
	// The naive "quote escapes the next character" reading mangles every
	// "we've" and "don't" — English marketing copy is full of them.
	assert_eq!(format_message("we've don't it's", Locale::En, &MessageValues::new()), "we've don't it's");
}

#[test]
fn an_apostrophe_before_a_syntax_character_quotes_a_literal() {
	assert_eq!(format_message("'{not a placeholder}'", Locale::En, &MessageValues::new()), "{not a placeholder}");
	// A doubled apostrophe is one literal apostrophe.
	assert_eq!(format_message("it''s", Locale::En, &MessageValues::new()), "it's");
}

#[test]
fn pound_outside_a_plural_stays_literal() {
	assert_eq!(format_message("lot #4", Locale::En, &MessageValues::new()), "lot #4");
}

#[test]
fn a_malformed_pattern_degrades_to_the_text_as_written() {
	// A copy typo must not take a view down.
	assert_eq!(format_message("unbalanced {n", Locale::En, &MessageValues::new()), "unbalanced {n");
}

#[test]
fn a_missing_key_renders_as_itself() {
	let t = Translator::new(Messages::new(), Locale::En);
	// Self-describing on screen, greppable, and survives to a screenshot.
	assert_eq!(t.t("hero.title"), "hero.title");
	assert!(!t.has("hero.title"));
}

// ── policy ───────────────────────────────────────────────────────────────────

fn en_source(pairs: &[(&str, &str)]) -> Messages {
	pairs.iter().map(|(k, v)| ((*k).to_owned(), (*v).to_owned())).collect()
}

fn translated(pairs: &[(&str, &str, &str)]) -> TranslatedCatalogue {
	pairs
		.iter()
		.map(|(k, en, t)| {
			(
				(*k).to_owned(),
				TranslatedEntry {
					en: (*en).to_owned(),
					t: (*t).to_owned(),
				},
			)
		})
		.collect()
}

#[test]
fn english_resolves_to_itself_unchanged() {
	let en = en_source(&[("a", "A")]);
	let resolved = resolve_catalogue(Locale::En, &en, &TranslatedCatalogue::new());
	assert_eq!(resolved.messages, en);
	assert_eq!(resolved.coverage, 1.0);
	assert!(resolved.rejected.is_empty());
}

#[test]
fn rule_1_2_refuses_a_translation_whose_source_moved_and_serves_english() {
	let en = en_source(&[("hero", "Coastal Vietnam, today")]);
	let ru = translated(&[("hero", "Coastal Vietnam", "Прибрежный Вьетнам")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);

	// The point of the rule: the page still renders, in canonical English.
	assert_eq!(resolved.messages["hero"], "Coastal Vietnam, today");
	assert_eq!(resolved.rejected[0].reason, RejectionReason::SourceDrift);
	assert_eq!(resolved.coverage, 0.0);
}

#[test]
fn a_matching_translation_is_accepted() {
	let en = en_source(&[("hero", "Coastal Vietnam")]);
	let ru = translated(&[("hero", "Coastal Vietnam", "Прибрежный Вьетнам")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert_eq!(resolved.messages["hero"], "Прибрежный Вьетнам");
	assert!(resolved.rejected.is_empty());
	assert_eq!(resolved.coverage, 1.0);
}

#[test]
fn rule_1_1_reports_a_key_english_does_not_define() {
	let en = en_source(&[("a", "A")]);
	let ru = translated(&[("a", "A", "А"), ("stray", "Gone", "Ушло")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	// Usually a rename that left the translation behind — reported, not ignored.
	assert_eq!(resolved.rejected.len(), 1);
	assert_eq!(resolved.rejected[0].reason, RejectionReason::OrphanKey);
	assert_eq!(resolved.rejected[0].key, "stray");
}

#[test]
fn a_dropped_placeholder_is_refused() {
	let en = en_source(&[("greet", "Hello, {name}")]);
	let ru = translated(&[("greet", "Hello, {name}", "Здравствуйте")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert_eq!(resolved.rejected[0].reason, RejectionReason::PlaceholderMismatch);
}

#[test]
fn an_invented_placeholder_is_refused() {
	let en = en_source(&[("greet", "Hello, {name}")]);
	let ru = translated(&[("greet", "Hello, {name}", "Здравствуйте, {имя}")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert_eq!(resolved.rejected[0].reason, RejectionReason::PlaceholderMismatch);
}

#[test]
fn changing_an_argument_from_plural_to_plain_is_refused() {
	let en = en_source(&[("n", "{n, plural, one {# lot} other {# lots}}")]);
	let ru = translated(&[("n", "{n, plural, one {# lot} other {# lots}}", "{n} участков")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert_eq!(resolved.rejected[0].reason, RejectionReason::ArgumentTypeMismatch);
}

#[test]
fn russian_must_carry_few_and_many_not_just_englishs_two_branches() {
	// The arithmetic half of "semantically equal": a translation mirroring only
	// English's one/other is provably missing cases real counts will hit.
	let source = "{n, plural, one {# lot} other {# lots}}";
	let en = en_source(&[("n", source)]);
	let ru = translated(&[("n", source, "{n, plural, one {# участок} other {# участка}}")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert_eq!(resolved.rejected[0].reason, RejectionReason::PluralCategoryMissing);
	assert!(
		resolved.rejected[0].detail.contains("few"),
		"detail should name the absent categories: {}",
		resolved.rejected[0].detail
	);
	assert!(resolved.rejected[0].detail.contains("many"));
}

#[test]
fn a_russian_plural_carrying_all_four_categories_is_accepted() {
	let source = "{n, plural, one {# lot} other {# lots}}";
	let en = en_source(&[("n", source)]);
	let ru = translated(&[("n", source, "{n, plural, one {# участок} few {# участка} many {# участков} other {# участка}}")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert!(resolved.rejected.is_empty(), "{:?}", resolved.rejected);
}

#[test]
fn a_bare_other_branch_is_enough_only_where_the_locale_declares_nothing_else() {
	let source = "{n, plural, one {# lot} other {# lots}}";
	let en = en_source(&[("n", source)]);

	// Vietnamese has no plural inflection, so `other` alone is the whole rule.
	let vi = translated(&[("n", source, "{n, plural, other {# lô đất}}")]);
	assert!(resolve_catalogue(Locale::Vi, &en, &vi).rejected.is_empty());

	// Russian is not exempt just because the formatter would fall back to
	// `other` at runtime: that fallback renders "5 участков" for every count,
	// including 1 and 2, which is wrong Russian the runtime cannot detect.
	let ru = translated(&[("n", source, "{n, plural, other {# участков}}")]);
	let rejected = resolve_catalogue(Locale::Ru, &en, &ru).rejected;
	assert_eq!(rejected[0].reason, RejectionReason::PluralCategoryMissing);
}

#[test]
fn a_blank_translation_is_refused() {
	let en = en_source(&[("a", "A")]);
	let ru = translated(&[("a", "A", "   ")]);
	assert_eq!(resolve_catalogue(Locale::Ru, &en, &ru).rejected[0].reason, RejectionReason::Empty);
}

#[test]
fn an_escaped_brace_is_not_read_as_a_placeholder() {
	// "it's '{not}' a placeholder" must not trip the checker.
	let source = "use '{braces}' literally";
	let en = en_source(&[("a", source)]);
	let ru = translated(&[("a", source, "используйте '{braces}' буквально")]);
	assert!(resolve_catalogue(Locale::Ru, &en, &ru).rejected.is_empty());
}

#[test]
fn an_untranslated_key_is_missing_not_rejected_and_still_renders() {
	let en = en_source(&[("a", "A"), ("b", "B")]);
	let ru = translated(&[("a", "A", "А")]);
	let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
	assert_eq!(resolved.missing, vec!["b".to_owned()]);
	assert!(resolved.rejected.is_empty());
	assert_eq!(resolved.messages["b"], "B", "every English key is present, so nothing can render a hole");
	assert_eq!(resolved.coverage, 0.5);
}

#[test]
fn audit_fails_on_drift_and_names_the_key() {
	let en = en_source(&[("hero", "New")]);
	let ru = translated(&[("hero", "Old", "Старое")]);
	let (ok, report) = audit(&[resolve_catalogue(Locale::Ru, &en, &ru)], 1.0);
	assert!(!ok);
	assert!(report.contains("FAIL ru"));
	assert!(report.contains("source-drift"));
	assert!(report.contains("hero"));
}

#[test]
fn audit_passes_a_fully_translated_catalogue() {
	let en = en_source(&[("hero", "New")]);
	let ru = translated(&[("hero", "New", "Новое")]);
	let (ok, report) = audit(&[resolve_catalogue(Locale::Ru, &en, &ru)], 1.0);
	assert!(ok, "{report}");
	assert!(report.contains("100% coverage"));
}

#[test]
fn audit_caps_the_untranslated_list_so_drift_stays_visible() {
	let pairs: Vec<(String, String)> = (0..25).map(|i| (format!("k{i}"), "x".to_owned())).collect();
	let en: Messages = pairs.into_iter().collect();
	let (_, report) = audit(&[resolve_catalogue(Locale::Ru, &en, &TranslatedCatalogue::new())], 1.0);
	assert!(report.contains("untranslated (25)"));
	assert!(report.contains("…and 15 more"));
}

// ── rule 1.3 ─────────────────────────────────────────────────────────────────

struct Item {
	name: &'static str,
	locales: Vec<Locale>,
}

#[test]
fn rule_1_3_hides_untranslated_compiled_content() {
	let items = vec![
		Item {
			name: "translated",
			locales: vec![Locale::En, Locale::Ru],
		},
		Item {
			name: "english-only",
			locales: vec![Locale::En],
		},
	];
	let shown = available_in(Locale::Ru, &items, |i| i.locales.as_slice(), MissingContentPolicy::Hide);
	assert_eq!(shown.len(), 1);
	assert_eq!(shown[0].name, "translated");
}

#[test]
fn fallback_keeps_everything_because_the_rule_is_not_universally_right() {
	// A vacancy hidden from a Russian speaker who reads English fine costs a
	// candidate — worth more than the inconsistency costs.
	let items = vec![Item {
		name: "english-only",
		locales: vec![Locale::En],
	}];
	assert_eq!(available_in(Locale::Ru, &items, |i| i.locales.as_slice(), MissingContentPolicy::Fallback).len(), 1);
}

#[test]
fn the_default_locale_always_sees_everything() {
	let items = vec![Item {
		name: "english-only",
		locales: vec![Locale::En],
	}];
	assert_eq!(available_in(Locale::En, &items, |i| i.locales.as_slice(), MissingContentPolicy::Hide).len(), 1);
}

// ── interop with the TypeScript mirror ───────────────────────────────────────

#[test]
fn renders_the_real_site_catalogue_plurals_identically_to_intl() {
	// These five patterns are copied verbatim from site_conductor's shipped
	// `messages/<locale>/common.json`, and the expectations from the output of
	// `Intl.PluralRules` + `Intl.NumberFormat` in the browser. If this ever
	// diverges, a catalogue authored against one half is wrong in the other —
	// which is the entire failure mode a shared registry exists to prevent.
	let cases: [(Locale, &str, [(f64, &str); 3]); 5] = [
		(Locale::En, "{count, plural, one {# role} other {# roles}}", [(1.0, "1 role"), (2.0, "2 roles"), (5.0, "5 roles")]),
		(
			Locale::Ru,
			"{count, plural, one {# вакансия} few {# вакансии} many {# вакансий} other {# вакансии}}",
			[(1.0, "1 вакансия"), (2.0, "2 вакансии"), (5.0, "5 вакансий")],
		),
		(Locale::Vi, "{count, plural, other {# vị trí}}", [(1.0, "1 vị trí"), (2.0, "2 vị trí"), (5.0, "5 vị trí")]),
		(
			Locale::Fr,
			"{count, plural, one {# poste} many {# postes} other {# postes}}",
			[(1.0, "1 poste"), (2.0, "2 postes"), (5.0, "5 postes")],
		),
		(
			Locale::De,
			"{count, plural, one {# Stelle} other {# Stellen}}",
			[(1.0, "1 Stelle"), (2.0, "2 Stellen"), (5.0, "5 Stellen")],
		),
	];

	for (locale, pattern, expectations) in cases {
		for (n, expected) in expectations {
			let got = format_message(pattern, locale, &values(&[("count", MessageValue::Num(n))]));
			assert_eq!(got, expected, "{locale} at n={n}");
		}
	}
}

#[test]
fn zero_matches_intl_which_differs_per_locale() {
	// The case most likely to be got wrong by hand: English says "0 roles",
	// French says "0 poste" (singular), Russian selects `many`.
	let en = format_message("{n, plural, one {# role} other {# roles}}", Locale::En, &values(&[("n", MessageValue::Num(0.0))]));
	let fr = format_message(
		"{n, plural, one {# poste} many {# postes} other {# postes}}",
		Locale::Fr,
		&values(&[("n", MessageValue::Num(0.0))]),
	);
	let ru = format_message(
		"{n, plural, one {# вакансия} few {# вакансии} many {# вакансий} other {# вакансии}}",
		Locale::Ru,
		&values(&[("n", MessageValue::Num(0.0))]),
	);
	assert_eq!(en, "0 roles");
	assert_eq!(fr, "0 poste");
	assert_eq!(ru, "0 вакансий");
}
