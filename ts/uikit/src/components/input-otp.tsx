import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import {
  INPUT_OTP_CONTAINER,
  INPUT_OTP_GROUP,
  INPUT_OTP_INPUT,
  INPUT_OTP_SLOT,
  INPUT_OTP_SLOT_CARET,
  INPUT_OTP_SLOT_CARET_WRAPPER,
} from "../generated/input-otp";

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
        className={cn(INPUT_OTP_CONTAINER, containerClassName)}
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
          className={cn(INPUT_OTP_INPUT, className)}
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
      className={cn(INPUT_OTP_GROUP, className)}
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
      className={cn(INPUT_OTP_SLOT, className)}
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className={INPUT_OTP_SLOT_CARET_WRAPPER}>
          <div className={INPUT_OTP_SLOT_CARET} />
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
