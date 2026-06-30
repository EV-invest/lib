pub const INPUT_OTP_CONTAINER: &str = "relative flex items-center gap-2 has-disabled:opacity-50";

pub const INPUT_OTP_INPUT: &str = "absolute inset-0 h-full w-full opacity-0 disabled:cursor-not-allowed";

pub const INPUT_OTP_GROUP: &str = "flex items-center";

pub const INPUT_OTP_SLOT: &str = "data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 \
	 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive border-input relative flex h-9 \
	 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md \
	 first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]";

pub const INPUT_OTP_SLOT_CARET_WRAPPER: &str = "pointer-events-none absolute inset-0 flex items-center justify-center";

pub const INPUT_OTP_SLOT_CARET: &str = "animate-caret-blink bg-foreground h-4 w-px duration-1000";
