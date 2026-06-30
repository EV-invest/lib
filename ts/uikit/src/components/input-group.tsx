import * as React from "react";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import {
  INPUT_GROUP_ADDON_BASE,
  INPUT_GROUP_BASE,
  INPUT_GROUP_BUTTON_BASE,
  INPUT_GROUP_INPUT_CONTROL,
  INPUT_GROUP_TEXT,
  INPUT_GROUP_TEXTAREA_CONTROL,
  inputGroupAddonAligns,
  inputGroupButtonSizes,
  type InputGroupAddonAlign,
  type InputGroupButtonSize,
} from "../generated/input-group";

export type { InputGroupAddonAlign, InputGroupButtonSize };

export function InputGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="input-group"
      role="group"
      className={cn(INPUT_GROUP_BASE, className)}
      {...props}
    />
  );
}

export interface InputGroupAddonProps extends React.ComponentProps<"div"> {
  align?: InputGroupAddonAlign;
}

export function InputGroupAddon({
  className,
  align = "inline-start",
  ...props
}: InputGroupAddonProps) {
  return (
    <div
      role="group"
      data-slot="input-group-addon"
      data-align={align}
      className={cn(
        INPUT_GROUP_ADDON_BASE,
        inputGroupAddonAligns[align],
        className,
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        e.currentTarget.parentElement?.querySelector("input")?.focus();
      }}
      {...props}
    />
  );
}

export interface InputGroupButtonProps
  extends Omit<ButtonProps, "size"> {
  size?: InputGroupButtonSize;
}

export function InputGroupButton({
  className,
  type = "button",
  variant = "ghost",
  size = "xs",
  ...props
}: InputGroupButtonProps) {
  return (
    <Button
      type={type}
      data-size={size}
      variant={variant}
      className={cn(
        INPUT_GROUP_BUTTON_BASE,
        inputGroupButtonSizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function InputGroupText({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(INPUT_GROUP_TEXT, className)}
      {...props}
    />
  );
}

export function InputGroupInput({
  className,
  ...props
}: React.ComponentProps<"input">) {
  return (
    <Input
      data-slot="input-group-control"
      className={cn(INPUT_GROUP_INPUT_CONTROL, className)}
      {...props}
    />
  );
}

export function InputGroupTextarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  return (
    <Textarea
      data-slot="input-group-control"
      className={cn(INPUT_GROUP_TEXTAREA_CONTROL, className)}
      {...props}
    />
  );
}
