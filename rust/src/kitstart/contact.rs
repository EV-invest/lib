//! Outbound contact links — the conversions a small-business landing exists
//! for. Mirrors `@evinvest/marketing`'s `telHref` / `whatsappHref` /
//! `contactChannel`, so a Rust page links the same number the same way and a
//! click tracker classifies it the same way.

use super::query::encode_uri_component;

/// The channel a contact link opens.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ContactChannel {
	Phone,
	Whatsapp,
	Email,
}

impl ContactChannel {
	/// The analytics value: `"phone"`, `"whatsapp"`, `"email"`.
	pub fn as_str(self) -> &'static str {
		match self {
			Self::Phone => "phone",
			Self::Whatsapp => "whatsapp",
			Self::Email => "email",
		}
	}
}

// `web.whatsapp.com/send` is where desktop "click to chat" lands, and
// `whatsapp://send` the native deep link some pages use directly.
const WHATSAPP_HOSTS: [&str; 3] = ["wa.me", "api.whatsapp.com", "web.whatsapp.com"];

/// Which contact channel `href` opens, or `None` when it is not a contact link.
/// Relative hrefs are never a contact link.
///
/// ```
/// use ev_lib::kitstart::{ContactChannel, contact_channel};
/// assert_eq!(contact_channel("tel:+33423500640"), Some(ContactChannel::Phone));
/// assert_eq!(contact_channel("https://wa.me/33423500640"), Some(ContactChannel::Whatsapp));
/// assert_eq!(contact_channel("/fr/prices"), None);
/// ```
pub fn contact_channel(href: &str) -> Option<ContactChannel> {
	let value = href.trim().to_lowercase();
	if value.starts_with("tel:") {
		return Some(ContactChannel::Phone);
	}
	if value.starts_with("mailto:") {
		return Some(ContactChannel::Email);
	}
	if value.starts_with("whatsapp:") {
		return Some(ContactChannel::Whatsapp);
	}
	let rest = value.strip_prefix("https://").or_else(|| value.strip_prefix("http://"))?;
	let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
	let host_port = authority.rsplit_once('@').map_or(authority, |(_, host)| host);
	let host = host_port.split(':').next().unwrap_or("");
	WHATSAPP_HOSTS.contains(&host).then_some(ContactChannel::Whatsapp)
}

/// `tel:` href from a number as printed. RFC 3966 allows only digits, `+` and
/// visual separators; keeping digits and `+` (and dropping a `(0)` trunk
/// prefix) keeps "04 23 50 06 40" and "+33 (0)4…" dialable on every phone.
///
/// ```
/// use ev_lib::kitstart::tel_href;
/// assert_eq!(tel_href("+33 (0)4 23 50 06 40"), "tel:+33423500640");
/// ```
pub fn tel_href(phone: &str) -> String {
	let digits: String = phone.replace("(0)", "").chars().filter(|c| c.is_ascii_digit() || *c == '+').collect();
	format!("tel:{digits}")
}

/// `wa.me` click-to-chat href. wa.me wants the international number as bare
/// digits — no `+`, no `00` exit prefix — and answers anything else with a
/// generic "invalid link" page. A national number ("06 12 …") cannot be fixed
/// without its country, so it is left as it is and the broken link is visible
/// rather than silently dialling someone else.
///
/// ```
/// use ev_lib::kitstart::whatsapp_href;
/// assert_eq!(whatsapp_href("0033 4 23 50 06 40", Some("Bonjour !")), "https://wa.me/33423500640?text=Bonjour%20!");
/// ```
pub fn whatsapp_href(phone: &str, message: Option<&str>) -> String {
	let digits: String = phone.replace("(0)", "").chars().filter(char::is_ascii_digit).collect();
	let digits = digits.strip_prefix("00").unwrap_or(&digits);
	match message.filter(|m| !m.is_empty()) {
		Some(text) => format!("https://wa.me/{digits}?text={}", encode_uri_component(text)),
		None => format!("https://wa.me/{digits}"),
	}
}
