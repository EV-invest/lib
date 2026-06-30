use tailwind_fuse::{AsTailwindClass, TwVariant};

pub const FIELD_BASE: &str = "group/field flex w-full gap-3 data-[invalid=true]:text-destructive";

pub const FIELD_SET: &str = "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3";

pub const FIELD_LEGEND: &str = "mb-3 font-medium data-[variant=legend]:text-base data-[variant=label]:text-sm";

pub const FIELD_GROUP: &str = "group/field-group @container/field-group flex w-full flex-col gap-7 \
         data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4";

pub const FIELD_CONTENT: &str = "group/field-content flex flex-1 flex-col gap-1.5 leading-snug";

pub const FIELD_LABEL: &str = "group/field-label peer/field-label flex w-fit gap-2 leading-snug \
         group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:w-full \
         has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:rounded-md has-[>[data-slot=field]]:border \
         [&>*]:data-[slot=field]:p-4 has-data-[state=checked]:bg-primary/5 has-data-[state=checked]:border-primary";

pub const FIELD_TITLE: &str = "flex w-fit items-center gap-2 text-sm leading-snug font-medium \
         group-data-[disabled=true]/field:opacity-50";

pub const FIELD_DESCRIPTION: &str = "text-muted-foreground text-sm leading-normal font-normal \
         group-has-[[data-orientation=horizontal]]/field:text-balance last:mt-0 nth-last-2:-mt-1 \
         [[data-variant=legend]+&]:-mt-1.5 [&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4";

pub const FIELD_SEPARATOR: &str = "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2";

pub const FIELD_SEPARATOR_LINE: &str = "absolute inset-0 top-1/2 shrink-0 bg-border h-px w-full";

pub const FIELD_SEPARATOR_CONTENT: &str = "bg-background text-muted-foreground relative mx-auto block w-fit px-2";

pub const FIELD_ERROR: &str = "text-destructive text-sm font-normal";

#[derive(strum::AsRefStr, strum::EnumIter, PartialEq, TwVariant)]
#[strum(serialize_all = "kebab-case")]
pub enum FieldOrientation {
	#[tw(default, class = "flex-col [&>*]:w-full [&>.sr-only]:w-auto")]
	Vertical,
	#[tw(class = "flex-row items-center [&>[data-slot=field-label]]:flex-auto \
	              has-[>[data-slot=field-content]]:items-start \
	              has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px")]
	Horizontal,
	#[tw(class = "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row \
	              @md/field-group:items-center @md/field-group:[&>*]:w-auto \
	              @md/field-group:[&>[data-slot=field-label]]:flex-auto \
	              @md/field-group:has-[>[data-slot=field-content]]:items-start \
	              @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px")]
	Responsive,
}
