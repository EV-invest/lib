import * as React from "react";
import { useControllableState } from "../primitives/use-controllable-state";

interface CollapsibleContextValue {
  open: boolean;
  setOpen: (next: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(
  null,
);

function useCollapsible(): CollapsibleContextValue {
  const ctx = React.useContext(CollapsibleContext);
  if (!ctx) throw new Error("Collapsible parts must be used within <Collapsible>");
  return ctx;
}

export interface CollapsibleProps extends React.ComponentProps<"div"> {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Collapsible({
  open,
  defaultOpen = false,
  onOpenChange,
  children,
  ...props
}: CollapsibleProps) {
  const [isOpen, setOpen] = useControllableState<boolean>({
    ...(open !== undefined ? { value: open } : {}),
    defaultValue: defaultOpen,
    ...(onOpenChange ? { onChange: onOpenChange } : {}),
  });
  return (
    <CollapsibleContext.Provider value={{ open: isOpen, setOpen }}>
      <div data-slot="collapsible" data-state={isOpen ? "open" : "closed"} {...props}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export function CollapsibleTrigger({
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { open, setOpen } = useCollapsible();
  return (
    <button
      type="button"
      data-slot="collapsible-trigger"
      data-state={open ? "open" : "closed"}
      aria-expanded={open}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      {...props}
    />
  );
}

export function CollapsibleContent({
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { open } = useCollapsible();
  if (!open) return null;
  return (
    <div data-slot="collapsible-content" data-state="open" {...props}>
      {children}
    </div>
  );
}
