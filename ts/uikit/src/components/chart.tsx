// Dep-light chart primitives: the shadcn/recharts wrapper minus recharts.
//
// Upstream shadcn `chart` is theming + presentational tooltip/legend wrappers
// around recharts, which does the actual plotting. We keep the wrappers and
// drop recharts: `ChartContainer` is a themed SVG host that emits per-key
// `--color-<key>` custom properties from its `config`, and consumers draw their
// own <svg>/series inside it. `ChartTooltipContent` and `ChartLegendContent`
// are purely presentational and take explicit `items` instead of a recharts
// payload. `ChartTooltip`/`ChartLegend` are passthrough wrappers. `dark:*`
// selectors are dropped; the recharts-specific `[&_.recharts-*]` selectors are
// dropped from the container base.

import * as React from "react";
import { cn } from "../lib/cn";

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    color?: string;
  };
};

type ChartContextProps = {
  config: ChartConfig;
};

const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);

  if (!context) {
    throw new Error("useChart must be used within a <ChartContainer />");
  }

  return context;
}

function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={cn(
          "flex aspect-video justify-center text-xs [&_.recharts-layer]:outline-hidden [&_.recharts-surface]:outline-hidden [&_svg]:outline-hidden",
          className,
        )}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        {children}
      </div>
    </ChartContext.Provider>
  );
}

const ChartStyle = ({ id, config }: { id: string; config: ChartConfig }) => {
  const colorConfig = Object.entries(config).filter(([, c]) => c.color);

  if (!colorConfig.length) {
    return null;
  }

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `[data-chart=${id}] {
${colorConfig
  .map(([key, itemConfig]) => `  --color-${key}: ${itemConfig.color};`)
  .join("\n")}
}`,
      }}
    />
  );
};

// One rendered tooltip/legend row. Replaces the recharts payload.
export type ChartItem = {
  label?: React.ReactNode;
  value?: React.ReactNode;
  color?: string;
};

const ChartTooltip = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

function ChartTooltipContent({
  className,
  items = [],
  label,
  hideLabel = false,
  hideIndicator = false,
  labelClassName,
}: React.ComponentProps<"div"> & {
  items?: ChartItem[];
  label?: React.ReactNode;
  hideLabel?: boolean;
  hideIndicator?: boolean;
  labelClassName?: string;
}) {
  useChart();

  if (!items.length) {
    return null;
  }

  return (
    <div
      data-slot="chart-tooltip"
      className={cn(
        "border-border/50 bg-background grid min-w-[8rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
        className,
      )}
    >
      {!hideLabel && label ? (
        <div className={cn("font-medium", labelClassName)}>{label}</div>
      ) : null}
      <div className="grid gap-1.5">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 items-center",
            )}
          >
            {!hideIndicator && (
              <div
                className="shrink-0 rounded-[2px] h-2.5 w-2.5"
                style={
                  {
                    backgroundColor: item.color,
                    borderColor: item.color,
                  } as React.CSSProperties
                }
              />
            )}
            <div className="flex flex-1 justify-between leading-none items-center">
              <span className="text-muted-foreground">{item.label}</span>
              {item.value !== undefined && (
                <span className="text-foreground font-mono font-medium tabular-nums">
                  {item.value}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const ChartLegend = ({ children }: { children?: React.ReactNode }) => (
  <>{children}</>
);

function ChartLegendContent({
  className,
  hideIcon = false,
  items,
}: React.ComponentProps<"div"> & {
  hideIcon?: boolean;
  items?: ChartItem[];
}) {
  const { config } = useChart();

  const rows: ChartItem[] =
    items ??
    Object.entries(config).map(([key, c]) => ({
      label: c.label ?? key,
      ...(c.color ? { color: c.color } : {}),
    }));

  if (!rows.length) {
    return null;
  }

  return (
    <div
      data-slot="chart-legend"
      className={cn("flex items-center justify-center gap-4", className)}
    >
      {rows.map((item, index) => (
        <div
          key={index}
          className={cn(
            "[&>svg]:text-muted-foreground flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3",
          )}
        >
          {!hideIcon && (
            <div
              className="h-2 w-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: item.color }}
            />
          )}
          {item.label}
        </div>
      ))}
    </div>
  );
}

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
};
