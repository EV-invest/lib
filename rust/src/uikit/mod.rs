//! `uikit` — EV-invest's dep-light Dioxus UI kit.
//!
//! Renderer-agnostic RSX components, mirrored semantically by the `@ev/uikit`
//! TypeScript package. Styling is Tailwind-utility based; every class references
//! a design token from [`tokens.css`](./tokens.css), the theme contract a
//! consumer must `@import` into its Tailwind v4 entrypoint.
//!
//! Variants are plain `enum`s matched to class strings (no `cva`); the `class`
//! prop is fused last via [`cn!`](crate::cn) so a caller override wins.
//!
//! ```toml
//! [target.'cfg(target_arch = "wasm32")'.dependencies]
//! ev = { git = "https://github.com/EV-invest/lib.git", default-features = false, features = ["uikit", "wasm"] }
//! ```

pub mod primitives;
pub mod utils;

#[cfg(test)]
mod test_util;

mod alert;
mod aspect_ratio;
mod avatar;
mod badge;
mod breadcrumb;
mod button;
mod button_group;
mod card;
mod empty;
mod field;
mod input;
mod input_group;
mod item;
mod kbd;
mod label;
mod pagination;
mod progress;
mod separator;
mod skeleton;
mod spinner;
mod table;
mod textarea;

pub use alert::{Alert, AlertDescription, AlertTitle, AlertVariant};
pub use aspect_ratio::AspectRatio;
pub use avatar::{Avatar, AvatarFallback, AvatarImage};
pub use badge::{Badge, BadgeVariant};
pub use breadcrumb::{Breadcrumb, BreadcrumbEllipsis, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator};
pub use button::{Button, ButtonSize, ButtonVariant, button_classes};
pub use button_group::{ButtonGroup, ButtonGroupOrientation, ButtonGroupSeparator, ButtonGroupText};
pub use card::{Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle};
pub use empty::{Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyMediaVariant, EmptyTitle};
pub use field::{Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldLegendVariant, FieldOrientation, FieldSeparator, FieldSet, FieldTitle};
pub use input::Input;
pub use input_group::{InputGroup, InputGroupAddon, InputGroupAddonAlign, InputGroupButton, InputGroupButtonSize, InputGroupInput, InputGroupText, InputGroupTextarea};
pub use item::{Item, ItemActions, ItemContent, ItemDescription, ItemFooter, ItemGroup, ItemHeader, ItemMedia, ItemMediaVariant, ItemSeparator, ItemSize, ItemTitle, ItemVariant};
pub use kbd::{Kbd, KbdGroup};
pub use label::Label;
pub use pagination::{Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious};
pub use progress::Progress;
pub use separator::{Orientation, Separator};
pub use skeleton::Skeleton;
pub use spinner::Spinner;
pub use table::{Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow};
pub use textarea::Textarea;
