import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";

type AccordionType = "single" | "multiple";

interface AccordionContextValue {
  isOpen: (value: string) => boolean;
  toggle: (value: string) => void;
}

const AccordionContext = React.createContext<AccordionContextValue | null>(null);

function useAccordion(): AccordionContextValue {
  const ctx = React.useContext(AccordionContext);
  if (!ctx) throw new Error("Accordion parts must be used within <Accordion>");
  return ctx;
}

const ItemContext = React.createContext<string | null>(null);

function useItemValue(): string {
  const value = React.useContext(ItemContext);
  if (value === null)
    throw new Error("AccordionTrigger/Content must be used within <AccordionItem>");
  return value;
}

export interface AccordionProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  type?: AccordionType;
  collapsible?: boolean;
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
}

export function Accordion({
  type = "single",
  collapsible = false,
  value,
  defaultValue = [],
  onValueChange,
  children,
  ...props
}: AccordionProps) {
  const [open, setOpen] = useControllableState<string[]>({
    ...(value !== undefined ? { value } : {}),
    defaultValue,
    ...(onValueChange ? { onChange: onValueChange } : {}),
  });

  const isOpen = (v: string) => open.includes(v);
  const toggle = (v: string) => {
    if (type === "multiple") {
      setOpen(open.includes(v) ? open.filter((x) => x !== v) : [...open, v]);
      return;
    }
    if (open.includes(v)) setOpen(collapsible ? [] : open);
    else setOpen([v]);
  };

  return (
    <AccordionContext.Provider value={{ isOpen, toggle }}>
      <div data-slot="accordion" {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export interface AccordionItemProps extends React.ComponentProps<"div"> {
  value: string;
}

export function AccordionItem({
  className,
  value,
  children,
  ...props
}: AccordionItemProps) {
  return (
    <ItemContext.Provider value={value}>
      <div
        data-slot="accordion-item"
        className={cn("border-b last:border-b-0", className)}
        {...props}
      >
        {children}
      </div>
    </ItemContext.Provider>
  );
}

export function AccordionTrigger({
  className,
  children,
  onClick,
  ...props
}: React.ComponentProps<"button">) {
  const { isOpen, toggle } = useAccordion();
  const value = useItemValue();
  const open = isOpen(value);
  return (
    <h3 className="flex" data-slot="accordion-header">
      <button
        type="button"
        data-slot="accordion-trigger"
        data-state={open ? "open" : "closed"}
        aria-expanded={open}
        className={cn(
          "focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180",
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          toggle(value);
        }}
        {...props}
      >
        {children}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </h3>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { isOpen } = useAccordion();
  const value = useItemValue();
  if (!isOpen(value)) return null;
  return (
    <div
      data-slot="accordion-content"
      data-state="open"
      className="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </div>
  );
}
