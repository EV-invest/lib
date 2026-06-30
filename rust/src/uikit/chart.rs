//! Dep-light chart primitives: the shadcn/recharts wrapper minus recharts.
//!
//! The upstream shadcn `chart` is theming + presentational tooltip/legend
//! wrappers around recharts, which does the actual plotting. We keep the
//! wrappers and drop recharts: `ChartContainer` is a themed SVG host that emits
//! per-key `--color-<key>` custom properties from its `config`, and consumers
//! draw their own `<svg>`/series inside it. `ChartTooltipContent` and
//! `ChartLegendContent` are purely presentational and take explicit `items`
//! instead of a recharts payload. `dark:*` selectors are dropped; the
//! recharts-specific `[&_.recharts-*]` selectors are dropped from the base.

use dioxus::prelude::*;

use crate::{
	cn,
	uikit::{CHART_CONTAINER, CHART_LEGEND, CHART_TOOLTIP},
};

/// Maps a series key to its presentation. The Rust mirror of the TS
/// `ChartConfig`; provided via context so tooltip/legend can read labels.
pub type ChartConfig = Vec<(String, ChartSeries)>;
/// One chart series' presentation: an optional human `label` and an optional
/// `color` (any CSS color) exposed as `--color-<key>` under `[data-chart=id]`.
#[derive(Clone, Default, PartialEq)]
pub struct ChartSeries {
	pub label: Option<String>,
	pub color: Option<String>,
}

/// A single rendered tooltip/legend row.
#[derive(Clone, PartialEq, Props)]
pub struct ChartItem {
	#[props(default)]
	pub label: String,
	#[props(default)]
	pub value: String,
	pub color: Option<String>,
}
/// Themed SVG host. Emits `--color-<key>` custom properties scoped to
/// `[data-chart=id]` from `config`, provides `config` via context, and lets
/// consumers render their own `<svg>`/series as `children`.
#[component]
pub fn ChartContainer(id: String, #[props(default)] class: String, config: ChartConfig, children: Element) -> Element {
	let chart_id = format!("chart-{id}");
	use_context_provider(|| ChartCtx { config: config.clone() });
	let cls = cn!(CHART_CONTAINER, class);
	rsx! {
		div { class: cls, "data-slot": "chart", "data-chart": chart_id.clone(),
			ChartStyle { id: chart_id.clone(), config }
			{children}
		}
	}
}
/// Emits a `<style>` defining `--color-<key>` for every series with a `color`,
/// scoped to `[data-chart=id]`.
#[component]
pub fn ChartStyle(id: String, config: ChartConfig) -> Element {
	let vars: String = config
		.iter()
		.filter_map(|(key, s)| s.color.as_ref().map(|c| format!("  --color-{key}: {c};")))
		.collect::<Vec<_>>()
		.join("\n");
	if vars.is_empty() {
		return rsx! {};
	}
	let css = format!("[data-chart={id}] {{\n{vars}\n}}");
	rsx! {
		style { dangerous_inner_html: css }
	}
}
/// Presentational tooltip box. `label` heads the box; `items` are the rows,
/// each with a `--color-*` swatch. Replaces the recharts payload path.
#[component]
pub fn ChartTooltipContent(
	#[props(default)] label: String,
	#[props(default)] hide_label: bool,
	#[props(default)] hide_indicator: bool,
	#[props(default)] class: String,
	items: Vec<ChartItem>,
) -> Element {
	let _ = use_context::<ChartCtx>();
	let cls = cn!(CHART_TOOLTIP, class);
	rsx! {
		div { class: cls,
			if !hide_label && !label.is_empty() {
				div { class: "font-medium", {label.clone()} }
			}
			div { class: "grid gap-1.5",
				for item in items {
					div { class: "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 items-center",
						if !hide_indicator {
							div {
								class: "shrink-0 rounded-[2px] h-2.5 w-2.5",
								style: match &item.color {
									Some(c) => format!("background-color: {c}; border-color: {c};"),
									None => String::new(),
								},
							}
						}
						div { class: "flex flex-1 justify-between leading-none items-center",
							span { class: "text-muted-foreground", "{item.label}" }
							if !item.value.is_empty() {
								span { class: "text-foreground font-mono font-medium tabular-nums", "{item.value}" }
							}
						}
					}
				}
			}
		}
	}
}
/// Presentational legend. Uses `items` when given, else derives one row per
/// `config` series (label falling back to the key).
#[component]
pub fn ChartLegendContent(#[props(default)] class: String, #[props(default)] items: Vec<ChartItem>) -> Element {
	let ctx = use_context::<ChartCtx>();
	let rows: Vec<ChartItem> = if items.is_empty() {
		ctx.config
			.iter()
			.map(|(key, s)| ChartItem {
				label: s.label.clone().unwrap_or_else(|| key.clone()),
				value: String::new(),
				color: s.color.clone(),
			})
			.collect()
	} else {
		items
	};
	let cls = cn!(CHART_LEGEND, class);
	rsx! {
		div { class: cls, "data-slot": "chart-legend",
			for item in rows {
				div { class: "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3",
					div {
						class: "h-2 w-2 shrink-0 rounded-[2px]",
						style: match &item.color {
							Some(c) => format!("background-color: {c};"),
							None => String::new(),
						},
					}
					"{item.label}"
				}
			}
		}
	}
}
#[derive(Clone, PartialEq)]
struct ChartCtx {
	config: ChartConfig,
}

#[cfg(test)]
mod tests {
	use super::*;
	use crate::uikit::test_util::render;

	fn cfg() -> ChartConfig {
		vec![(
			"desktop".into(),
			ChartSeries {
				label: Some("Desktop".into()),
				color: Some("#3b82f6".into()),
			},
		)]
	}

	#[test]
	fn container_emits_slot_and_scoped_vars() {
		fn app() -> Element {
			rsx! {
				ChartContainer { id: "x".to_string(), config: cfg(),
					svg {}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"chart\""), "{html}");
		assert!(html.contains("data-chart=\"chart-x\""), "{html}");
		assert!(html.contains("[data-chart=chart-x]"), "{html}");
		assert!(html.contains("--color-desktop: #3b82f6;"), "{html}");
		assert!(!html.contains("recharts-cartesian"), "recharts selectors dropped: {html}");
	}

	#[test]
	fn tooltip_renders_label_and_items() {
		fn app() -> Element {
			rsx! {
				ChartContainer { id: "t".to_string(), config: cfg(),
					ChartTooltipContent {
						label: "Jan".to_string(),
						items: vec![ChartItem { label: "Desktop".into(), value: "120".into(), color: Some("#3b82f6".into()) }],
					}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("Jan"), "{html}");
		assert!(html.contains("Desktop"));
		assert!(html.contains("120"));
		assert!(html.contains("border-border/50"), "{html}");
	}

	#[test]
	fn legend_derives_from_config() {
		fn app() -> Element {
			rsx! {
				ChartContainer { id: "y".to_string(), config: cfg(),
					ChartLegendContent {}
				}
			}
		}
		let html = render(app);
		assert!(html.contains("data-slot=\"chart-legend\""), "{html}");
		assert!(html.contains("Desktop"), "{html}");
	}
}
