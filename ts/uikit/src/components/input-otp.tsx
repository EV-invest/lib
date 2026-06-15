import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";

type InputOTPContextValue = {
  value: string;
  maxLength: number;
  activeIndex: number;
};

const InputOTPContext = React.createContext<InputOTPContextValue | null>(null);

function useInputOTP() {
  const context = React.useContext(InputOTPContext);
  if (!context) {
    throw new Error("InputOTP slots must be used within an <InputOTP />");
  }
  return context;
}

export interface InputOTPProps
  extends Omit<React.ComponentProps<"input">, "value" | "defaultValue" | "onChange"> {
  maxLength: number;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  containerClassName?: string;
  children?: React.ReactNode;
}

export function InputOTP({
  maxLength,
  value: valueProp,
  defaultValue = "",
  onChange,
  className,
  containerClassName,
  children,
  disabled,
  ...props
}: InputOTPProps) {
  const [value, setValue] = useControllableState<string>({
    value: valueProp,
    defaultValue,
    onChange,
  });
  const [focused, setFocused] = React.useState(false);

  const activeIndex = focused ? Math.min(value.length, maxLength - 1) : -1;

  return (
    <InputOTPContext.Provider value={{ value, maxLength, activeIndex }}>
      <div
        data-slot="input-otp"
        className={cn(
          "relative flex items-center gap-2 has-disabled:opacity-50",
          containerClassName,
        )}
      >
        {children}
        <input
          // drag/momentum: n/a — single visually-hidden input tracks the string
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={maxLength}
          value={value}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value.slice(0, maxLength))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(
            "absolute inset-0 h-full w-full opacity-0 disabled:cursor-not-allowed",
            className,
          )}
          {...props}
        />
      </div>
    </InputOTPContext.Provider>
  );
}

export function InputOTPGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-otp-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  );
}

export interface InputOTPSlotProps extends React.ComponentProps<"div"> {
  index: number;
}

export function InputOTPSlot({ index, className, ...props }: InputOTPSlotProps) {
  const { value, activeIndex } = useInputOTP();
  const char = value[index];
  const isActive = activeIndex === index;
  const hasFakeCaret = isActive && char === undefined;

  return (
    <div
      data-slot="input-otp-slot"
      data-active={isActive}
      className={cn(
        "data-[active=true]:border-ring data-[active=true]:ring-ring/50 data-[active=true]:aria-invalid:ring-destructive/20 aria-invalid:border-destructive data-[active=true]:aria-invalid:border-destructive border-input relative flex h-9 w-9 items-center justify-center border-y border-r text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:ring-[3px]",
        className,
      )}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
}

export function InputOTPSeparator({ ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="input-otp-separator" role="separator" {...props}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 12h14" />
      </svg>
    </div>
  );
}
