pub const ALERT_DIALOG_OVERLAY: &str = "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                                        data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50";

pub const ALERT_DIALOG_CONTENT: &str = "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 \
                                        data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] \
                                        left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg \
                                        border p-6 shadow-lg duration-200 sm:max-w-lg";

pub const ALERT_DIALOG_HEADER: &str = "flex flex-col gap-2 text-center sm:text-left";

pub const ALERT_DIALOG_FOOTER: &str = "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end";

pub const ALERT_DIALOG_TITLE: &str = "text-lg font-semibold";

pub const ALERT_DIALOG_DESCRIPTION: &str = "text-muted-foreground text-sm";
