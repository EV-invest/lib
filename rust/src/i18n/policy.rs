//! EV's translation policy, enforced in code rather than in review.
//!
//! **1.1 — English is canonical.** `en` is the authored source. It defines the
//! key set, the placeholders, and the meaning. Every other locale is a
//! *derivation* of it, and nothing else may introduce a key.
//!
//! **1.2 — A translation that no longer matches its English source is not
//! used.** The English string is served instead. This is the rule that keeps a
//! stale translation from quietly contradicting the site: when English copy
//! changes and the translation does not, the translation is no longer a
//! translation of anything — it is last quarter's claim, in another language,
//! presented as current.
//!
//! **1.3 — Compiled content with no translation for the current locale is
//! hidden, not silently served in English.** See [`available_in`].
//!
//! # What "semantic comparison" can and cannot mean in code
//!
//! Nothing here compares *meaning* across languages — no program does that
//! reliably, and one that claimed to would fail silently, which is worse than
//! not trying. What is mechanically checkable is **provenance** and
//! **structure**, and together they catch the failure that actually happens:
//!
//! - **Provenance.** Each translated entry records the English text it was
//!   written against. If today's English differs, the translation is stale by
//!   construction — no judgement required, and the diff shows a reviewer exactly
//!   what changed underneath it.
//! - **Structure.** The set of placeholders, their argument types, and the
//!   plural categories a locale requires must all match. A Russian string that
//!   handles only `one`/`other` is *provably* not equivalent to an English
//!   plural, because Russian needs `few` and `many` too — that one is caught
//!   arithmetically, not by opinion.
//!
//! A translation can still be a bad translation of the right source. That is a
//! job for a human reviewer, and this module deliberately does not pretend
//! otherwise.

use std::collections::{BTreeMap, BTreeSet};

use super::{DEFAULT_LOCALE, Locale, Messages};

/// One translated entry: the text, plus the English it was translated from.
///
/// `en` is stored as the source *text* rather than a hash on purpose. A hash
/// would be shorter and equally correct, but a reviewer reading a pull request
/// could not see what the translator was looking at. With the text inline, a
/// drifted entry is self-evident in the diff.
///
/// This is the on-disk shape of `messages/<locale>/*.json`, shared byte-for-byte
/// with the TypeScript mirror:
///
/// ```json
/// { "team.title": { "en": "Our team", "t": "Наша команда" } }
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TranslatedEntry {
	/// The English source this was translated from.
	pub en: String,
	/// The translation.
	pub t: String,
}

/// A non-English catalogue as authored on disk.
pub type TranslatedCatalogue = BTreeMap<String, TranslatedEntry>;

/// Why a translated entry was refused, and English used instead.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RejectionReason {
	/// Today's English differs from the `en` the translation was written against.
	SourceDrift,
	/// The translation interpolates a different set of placeholders.
	PlaceholderMismatch,
	/// An argument is a plural/select in one language and not the other.
	ArgumentTypeMismatch,
	/// A plural is missing a category this locale requires (ru needs few/many).
	PluralCategoryMissing,
	/// A key English does not define — rule 1.1: only English introduces keys.
	OrphanKey,
	/// Blank translation.
	Empty,
}

impl RejectionReason {
	/// The kebab-case name, matching the TypeScript mirror's string union so both
	/// halves report the same vocabulary.
	pub fn as_str(self) -> &'static str {
		match self {
			Self::SourceDrift => "source-drift",
			Self::PlaceholderMismatch => "placeholder-mismatch",
			Self::ArgumentTypeMismatch => "argument-type-mismatch",
			Self::PluralCategoryMissing => "plural-category-missing",
			Self::OrphanKey => "orphan-key",
			Self::Empty => "empty",
		}
	}
}

impl std::fmt::Display for RejectionReason {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(self.as_str())
	}
}

/// One refusal, with enough detail to fix it without opening the catalogue.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rejection {
	pub key: String,
	pub reason: RejectionReason,
	pub detail: String,
}

/// The outcome of applying the policy to one locale's catalogue.
#[derive(Debug, Clone, PartialEq)]
pub struct ResolvedCatalogue {
	pub locale: Locale,
	/// Ready for [`Translator`](super::Translator): accepted translations,
	/// English everywhere else.
	pub messages: Messages,
	/// Entries refused by rule 1.2, each falling back to English.
	pub rejected: Vec<Rejection>,
	/// Keys English defines that this locale has not translated at all.
	pub missing: Vec<String>,
	/// Share of English keys actually served in this locale, 0–1.
	pub coverage: f64,
}

/// Apply rules 1.1 and 1.2 to one locale's catalogue.
///
/// Never fails and never returns a hole: every key English defines is present in
/// `messages`, served in the target locale when the translation passes and in
/// English when it does not. A view therefore cannot break because a translation
/// went stale — it degrades to canonical English, which is rule 1.2's entire
/// point.
///
/// ```
/// use ev_lib::i18n::{Locale, Messages};
/// use ev_lib::i18n::policy::{TranslatedCatalogue, TranslatedEntry, resolve_catalogue};
///
/// let mut en = Messages::new();
/// en.insert("hero.title".into(), "Coastal Vietnam".into());
///
/// let mut ru = TranslatedCatalogue::new();
/// // Translated from copy that has since changed — rule 1.2 refuses it.
/// ru.insert("hero.title".into(), TranslatedEntry { en: "Coastal Vietnam, today".into(), t: "Прибрежный Вьетнам".into() });
///
/// let resolved = resolve_catalogue(Locale::Ru, &en, &ru);
/// assert_eq!(resolved.messages["hero.title"], "Coastal Vietnam");
/// assert_eq!(resolved.rejected.len(), 1);
/// ```
pub fn resolve_catalogue(locale: Locale, source: &Messages, translated: &TranslatedCatalogue) -> ResolvedCatalogue {
	if locale == DEFAULT_LOCALE {
		return ResolvedCatalogue {
			locale,
			messages: source.clone(),
			rejected: Vec::new(),
			missing: Vec::new(),
			coverage: 1.0,
		};
	}

	let mut messages = Messages::new();
	let mut rejected = Vec::new();
	let mut missing = Vec::new();
	let mut accepted = 0usize;

	// Rule 1.1 — English defines the key set, so a key only this locale has is a
	// key nothing renders. Reported rather than ignored: it is usually a rename
	// that left the translation behind.
	for key in translated.keys() {
		if !source.contains_key(key) {
			rejected.push(Rejection {
				key: key.clone(),
				reason: RejectionReason::OrphanKey,
				detail: format!("not defined in {DEFAULT_LOCALE} — only the canonical locale introduces keys"),
			});
		}
	}

	for (key, en) in source {
		let Some(entry) = translated.get(key) else {
			missing.push(key.clone());
			messages.insert(key.clone(), en.clone());
			continue;
		};

		match check(entry, en, locale) {
			Some((reason, detail)) => {
				rejected.push(Rejection { key: key.clone(), reason, detail });
				messages.insert(key.clone(), en.clone());
			}
			None => {
				messages.insert(key.clone(), entry.t.clone());
				accepted += 1;
			}
		}
	}

	let total = source.len();
	let coverage = if total == 0 { 1.0 } else { accepted as f64 / total as f64 };
	ResolvedCatalogue {
		locale,
		messages,
		rejected,
		missing,
		coverage,
	}
}

/// The whole of rule 1.2 for a single entry. `None` means accepted.
fn check(entry: &TranslatedEntry, en: &str, locale: Locale) -> Option<(RejectionReason, String)> {
	if entry.t.trim().is_empty() {
		return Some((RejectionReason::Empty, "translation is blank".to_owned()));
	}

	// Provenance. The one check that catches ordinary drift: English moved, the
	// translation did not.
	if entry.en != en {
		return Some((RejectionReason::SourceDrift, format!("translated from {:?}, source is now {:?}", entry.en, en)));
	}

	let source_args = scan_arguments(en);
	let target_args = scan_arguments(&entry.t);

	for (name, kind) in &source_args {
		let Some(mirrored) = target_args.get(name) else {
			return Some((RejectionReason::PlaceholderMismatch, format!("source interpolates {{{name}}}, translation does not")));
		};
		if mirrored.arg_type != kind.arg_type {
			return Some((
				RejectionReason::ArgumentTypeMismatch,
				format!("{{{name}}} is a {} in {DEFAULT_LOCALE} and a {} here", kind.arg_type, mirrored.arg_type),
			));
		}
		if kind.arg_type == ArgType::Plural {
			// The arithmetic half of "semantically equal". English has two plural
			// categories; Russian has four. A translation that only mirrors
			// English's branches is missing cases real numbers will hit.
			//
			// `other` is NOT accepted as a wildcard here, even though the formatter
			// falls back to it at runtime. That fallback is what stops a page
			// breaking; it is not evidence the translation is right. A Russian
			// `one`/`other` pair renders "5 участка" for five — grammatical
			// nonsense — and the runtime cannot tell, because it got a branch. The
			// whole point of a build-time check is to catch what degrades silently.
			// A locale that genuinely needs one branch (Vietnamese) declares only
			// `other`, so it passes on the same rule rather than an exemption.
			let absent: Vec<&str> = locale.plural_categories().iter().map(|c| c.as_str()).filter(|c| !mirrored.branches.contains(*c)).collect();
			if !absent.is_empty() {
				return Some((RejectionReason::PluralCategoryMissing, format!("{{{name}}} needs {} in {locale}", absent.join(", "))));
			}
		}
	}

	for name in target_args.keys() {
		if !source_args.contains_key(name) {
			return Some((
				RejectionReason::PlaceholderMismatch,
				format!("translation interpolates {{{name}}}, which the source does not provide"),
			));
		}
	}

	None
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ArgType {
	Value,
	Plural,
	Select,
}

impl std::fmt::Display for ArgType {
	fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
		f.write_str(match self {
			Self::Value => "value",
			Self::Plural => "plural",
			Self::Select => "select",
		})
	}
}

#[derive(Debug, Clone)]
struct ArgumentShape {
	arg_type: ArgType,
	branches: BTreeSet<String>,
}

/// Extract each argument's name, type, and (for plural/select) branch keys.
///
/// Deliberately independent of the formatter: this needs only the shape of the
/// arguments, never their rendered output, and keeping the two separate means
/// the policy carries no formatting behaviour it would then have to keep in
/// sync.
fn scan_arguments(pattern: &str) -> BTreeMap<String, ArgumentShape> {
	let mut found = BTreeMap::new();
	walk(&pattern.chars().collect::<Vec<char>>(), &mut found);
	found
}

fn walk(text: &[char], found: &mut BTreeMap<String, ArgumentShape>) {
	let mut i = 0;
	while i < text.len() {
		let ch = text[i];

		// Mirror the formatter's ICU 4.8 quoting so an escaped '{' is not read as
		// an argument — otherwise "it's '{not}' a placeholder" trips the checker.
		if ch == '\'' {
			let next = text.get(i + 1).copied();
			if next == Some('\'') {
				i += 2;
				continue;
			}
			if matches!(next, Some('{') | Some('}') | Some('#')) {
				i += 2;
				while i < text.len() && text[i] != '\'' {
					i += 1;
				}
				i += 1;
				continue;
			}
			i += 1;
			continue;
		}

		if ch != '{' {
			i += 1;
			continue;
		}

		let Some(end) = closing(text, i) else { return };
		let inner = &text[i + 1..end];
		i = end + 1;

		let Some(first_comma) = top_level(inner, ',') else {
			let name: String = inner.iter().collect::<String>().trim().to_owned();
			if !name.is_empty() {
				found.entry(name).or_insert(ArgumentShape {
					arg_type: ArgType::Value,
					branches: BTreeSet::new(),
				});
			}
			continue;
		};

		let name: String = inner[..first_comma].iter().collect::<String>().trim().to_owned();
		let rest = &inner[first_comma + 1..];
		let second_comma = top_level(rest, ',');
		let declared: String = match second_comma {
			Some(idx) => rest[..idx].iter().collect::<String>(),
			None => rest.iter().collect::<String>(),
		}
		.trim()
		.to_owned();
		let body: &[char] = match second_comma {
			Some(idx) => &rest[idx + 1..],
			None => &[],
		};
		let arg_type = match declared.as_str() {
			"plural" => ArgType::Plural,
			"select" => ArgType::Select,
			_ => ArgType::Value,
		};

		let mut branches = BTreeSet::new();
		if arg_type != ArgType::Value {
			for (branch_key, branch_body) in branches_of(body) {
				branches.insert(branch_key);
				walk(&branch_body, found);
			}
		}
		if !name.is_empty() {
			found.insert(name, ArgumentShape { arg_type, branches });
		}
	}
}

fn closing(source: &[char], start: usize) -> Option<usize> {
	let mut depth = 0usize;
	for (offset, ch) in source[start..].iter().enumerate() {
		match ch {
			'{' => depth += 1,
			'}' => {
				depth -= 1;
				if depth == 0 {
					return Some(start + offset);
				}
			}
			_ => {}
		}
	}
	None
}

fn top_level(source: &[char], sep: char) -> Option<usize> {
	let mut depth = 0i32;
	for (i, &ch) in source.iter().enumerate() {
		match ch {
			'{' => depth += 1,
			'}' => depth -= 1,
			c if c == sep && depth == 0 => return Some(i),
			_ => {}
		}
	}
	None
}

fn branches_of(body: &[char]) -> Vec<(String, Vec<char>)> {
	let mut out = Vec::new();
	let mut i = 0;
	while i < body.len() {
		while i < body.len() && body[i].is_whitespace() {
			i += 1;
		}
		let key_start = i;
		while i < body.len() && !body[i].is_whitespace() && body[i] != '{' {
			i += 1;
		}
		let key: String = body[key_start..i].iter().collect();
		while i < body.len() && body[i].is_whitespace() {
			i += 1;
		}
		if body.get(i) != Some(&'{') {
			break;
		}
		let Some(end) = closing(body, i) else { break };
		if !key.is_empty() {
			out.push((key, body[i + 1..end].to_vec()));
		}
		i = end + 1;
	}
	out
}

/// Render resolved catalogues as a report for a CI check.
///
/// The runtime already degrades safely — rule 1.2 serves English and the view is
/// fine. That safety is exactly why drift needs a *second*, noisy channel: a
/// silent fallback looks identical to a surface that was never translated, so
/// without this a locale can rot to zero coverage without anyone noticing.
///
/// `floor` is the minimum acceptable coverage, 0–1; pass `1.0` for "no drift".
pub fn audit(resolved: &[ResolvedCatalogue], floor: f64) -> (bool, String) {
	let mut lines = Vec::new();
	let mut ok = true;

	for cat in resolved {
		let pct = (cat.coverage * 100.0).round() as i64;
		let healthy = cat.rejected.is_empty() && cat.coverage >= floor;
		if !healthy {
			ok = false;
		}
		lines.push(format!("{} {}  {pct}% coverage", if healthy { "ok  " } else { "FAIL" }, cat.locale));

		for r in &cat.rejected {
			lines.push(format!("       {}  [{}] {}", r.key, r.reason, r.detail));
		}
		// Missing keys are listed but capped: a locale that has translated nothing
		// yet would otherwise bury the drift that actually needs fixing.
		if !cat.missing.is_empty() {
			let shown: Vec<&str> = cat.missing.iter().take(10).map(String::as_str).collect();
			lines.push(format!("       untranslated ({}): {}", cat.missing.len(), shown.join(", ")));
			if cat.missing.len() > shown.len() {
				lines.push(format!("       …and {} more", cat.missing.len() - shown.len()));
			}
		}
	}

	(ok, lines.join("\n"))
}

// ── Rule 1.3 — content ───────────────────────────────────────────────────────

/// What to do with a content item that has no translation for the current
/// locale.
///
/// [`Hide`](MissingContentPolicy::Hide) is the policy for *compiled* content —
/// publications, the whitepaper, anything built once and surfaced everywhere. A
/// Russian reader given an English essay under Russian chrome learns that the
/// locale is a veneer.
///
/// [`Fallback`](MissingContentPolicy::Fallback) exists because the rule is not
/// universally right, and pretending otherwise would be the bug. A vacancy is
/// the clear case: hiding an open role from a Russian speaker who reads English
/// fine costs a candidate, and loses more than the inconsistency costs. Choose
/// per collection, deliberately.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum MissingContentPolicy {
	#[default]
	Hide,
	Fallback,
}

/// Apply rule 1.3 to a content collection.
///
/// ```
/// use ev_lib::i18n::Locale;
/// use ev_lib::i18n::policy::{MissingContentPolicy, available_in};
///
/// struct Lot { name: &'static str, locales: Vec<Locale> }
/// let lots = vec![
///     Lot { name: "A1", locales: vec![Locale::En, Locale::Ru] },
///     Lot { name: "B2", locales: vec![Locale::En] },
/// ];
///
/// let shown = available_in(Locale::Ru, &lots, |l| l.locales.as_slice(), MissingContentPolicy::Hide);
/// assert_eq!(shown.len(), 1);
/// assert_eq!(shown[0].name, "A1");
/// ```
pub fn available_in<T, F>(locale: Locale, items: &[T], locales_of: F, policy: MissingContentPolicy) -> Vec<&T>
where
	F: Fn(&T) -> &[Locale], {
	if locale == DEFAULT_LOCALE || policy == MissingContentPolicy::Fallback {
		return items.iter().collect();
	}
	items.iter().filter(|item| locales_of(item).contains(&locale)).collect()
}
