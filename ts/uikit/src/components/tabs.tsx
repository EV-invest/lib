import * as React from "react";
import { cn } from "../lib/cn";
import { useControllableState } from "../primitives/use-controllable-state";
import { useRovingFocus } from "../primitives/use-roving-focus";

type TabsOrientation = "horizontal" | "vertical";

interface TabsContextValue {
  value: string;
  setValue: (next: string) => void;
  orientation: TabsOrientation;
}

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabs(): TabsContextValue {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs parts must be used within <Tabs>");
  return ctx;
}

export interface TabsProps
  extends Omit<React.ComponentProps<"div">, "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  orientation?: TabsOrientation;
}

export function Tabs({
  className,
  value,
  defaultValue = "",
  onValueChange,
  orientation = "horizontal",
  children,
  ...props
}: TabsProps) {
  const [active, setValue] = useControllableState<string>({
    ...(value !== undefined ? { value } : {}),
    defaultValue,
    ...(onValueChange ? { onChange: onValueChange } : {}),
  });
  return (
    <TabsContext.Provider value={{ value: active, setValue, orientation }}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className,
  children,
  onKeyDown,
  ...props
}: React.ComponentProps<"div">) {
  const { orientation } = useTabs();
  const items = React.Children.toArray(children);
  const { activeIndex, setActiveIndex, onKeyDown: rovingKeyDown } =
    useRovingFocus({
      count: items.length,
      orientation: orientation === "vertical" ? "vertical" : "horizontal",
    });
  return (
    <div
      role="tablist"
      data-slot="tabs-list"
      aria-orientation={orientation}
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className,
      )}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        rovingKeyDown(e);
      }}
      {...props}
    >
      {items.map((child, index) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<TabsTriggerInternal>, {
              __index: index,
              __isFocusItem: index === activeIndex,
              __onFocusItem: () => setActiveIndex(index),
            })
          : child,
      )}
    </div>
  );
}

interface TabsTriggerInternal {
  __index?: number;
  __isFocusItem?: boolean;
  __onFocusItem?: () => void;
}

export interface TabsTriggerProps
  extends React.ComponentProps<"button">,
    TabsTriggerInternal {
  value: string;
}

export function TabsTrigger({
  className,
  value,
  onClick,
  onFocus,
  __isFocusItem,
  __onFocusItem,
  ...props
}: TabsTriggerProps) {
  const { value: active, setValue } = useTabs();
  const selected = active === value;
  return (
    <button
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      data-state={selected ? "active" : "inactive"}
      aria-selected={selected}
      tabIndex={__isFocusItem ? 0 : -1}
      className={cn(
        "data-[state=active]:bg-background focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      onClick={(e) => {
        onClick?.(e);
        __onFocusItem?.();
        setValue(value);
      }}
      onFocus={(e) => {
        onFocus?.(e);
        __onFocusItem?.();
      }}
      {...props}
    />
  );
}

export interface TabsContentProps extends React.ComponentProps<"div"> {
  value: string;
}

export function TabsContent({
  className,
  value,
  children,
  ...props
}: TabsContentProps) {
  const { value: active } = useTabs();
  if (active !== value) return null;
  return (
    <div
      role="tabpanel"
      data-slot="tabs-content"
      data-state="active"
      className={cn("flex-1 outline-none", className)}
      {...props}
    >
      {children}
    </div>
  );
}
