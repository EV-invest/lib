import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import {
  OpenOrdersEmpty,
  OrderBook,
  OrderBookHead,
  OrderBookRow,
  OrderBookSpread,
  OrderForm,
  OrderFormRow,
  OrderFormSubmit,
  Terminal,
  TerminalChart,
  TerminalPane,
  TerminalPaneBody,
  TerminalPaneHeader,
  TerminalTicker,
  TickerStat,
  TradesTapeRow,
} from "../src/components/terminal";

describe("Terminal frame", () => {
  it("places a pane by its area", () => {
    const { container } = render(
      <Terminal id="t">
        <TerminalPane area="form" className="extra">
          <TerminalPaneHeader>Order</TerminalPaneHeader>
          <TerminalPaneBody>body</TerminalPaneBody>
        </TerminalPane>
      </Terminal>,
    );
    const root = container.querySelector('[data-slot="terminal"]')!;
    expect(root).toHaveAttribute("id", "t");
    expect(root).toHaveClass("grid");

    const pane = container.querySelector('[data-slot="terminal-pane"]')!;
    expect(pane.tagName).toBe("SECTION");
    expect(pane).toHaveAttribute("data-area", "form");
    expect(pane).toHaveClass("lg:col-start-3");
    expect(pane).toHaveClass("extra");

    expect(container.querySelector('[data-slot="terminal-pane-header"]')!.tagName).toBe(
      "HEADER",
    );
    expect(container.querySelector('[data-slot="terminal-pane-body"]')).toHaveTextContent(
      "body",
    );
  });

  it("hands the chart host to a ref and keeps it empty", () => {
    const ref = React.createRef<HTMLDivElement>();
    const { container } = render(<TerminalChart ref={ref} id="chart" />);
    const host = container.querySelector('[data-slot="terminal-chart"]')!;
    expect(ref.current).toBe(host);
    expect(host).toHaveAttribute("id", "chart");
    expect(host).toHaveClass("relative");
    expect(host).toBeEmptyDOMElement();
  });

  it("puts the ticker in the full-width slot and colours a stat's figure", () => {
    const { container, getByText } = render(
      <TerminalTicker>
        <TickerStat label="Last" value="1.024" className="text-positive" />
      </TerminalTicker>,
    );
    const ticker = container.querySelector('[data-slot="terminal-ticker"]')!;
    expect(ticker).toHaveAttribute("data-area", "ticker");
    expect(ticker).toHaveClass("lg:col-span-3");

    expect(getByText("Last")).toHaveClass("uppercase");
    const figure = getByText("1.024");
    expect(figure).toHaveClass("tabular-nums");
    expect(figure).toHaveClass("text-positive");
    expect(container.querySelector('[data-slot="ticker-stat"]')).not.toHaveClass(
      "text-positive",
    );
  });
});

describe("OrderBook", () => {
  it("renders the captions in the consumer's words", () => {
    const { container, getByText } = render(
      <OrderBook>
        <OrderBookHead price="Price" size="Size" total="Total" />
        <OrderBookSpread>
          <span>Spread 0.002</span>
        </OrderBookSpread>
      </OrderBook>,
    );
    expect(container.querySelector('[data-slot="order-book"]')).toHaveClass("font-mono");
    expect(container.querySelector('[data-slot="order-book-head"]')).toHaveClass("grid-cols-3");
    expect(getByText("Price")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="order-book-spread"]')).toHaveTextContent(
      "Spread 0.002",
    );
  });

  it("colours the price by side and sizes the depth bar", () => {
    const onClick = vi.fn();
    const { container, getByText } = render(
      <OrderBookRow side="ask" price="1.030" size="120" total="360" depth={0.42} onClick={onClick} />,
    );
    const row = container.querySelector('[data-slot="order-book-row"]')!;
    expect(row).toHaveAttribute("data-side", "ask");

    const bar = row.firstElementChild as HTMLElement;
    expect(bar).toHaveAttribute("aria-hidden", "true");
    expect(bar).toHaveClass("bg-accent-error/15");
    expect(bar.style.width).toBe("42%");

    const price = getByText("1.030");
    expect(price).toHaveClass("text-left");
    expect(price).toHaveClass("text-accent-error");

    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("clamps the depth to a percentage", () => {
    const widthOf = (depth: number) => {
      const { container, unmount } = render(
        <OrderBookRow side="bid" price="1" size="1" total="1" depth={depth} />,
      );
      const width = (container.querySelector('[aria-hidden="true"]') as HTMLElement).style.width;
      unmount();
      return width;
    };
    expect(widthOf(-0.5)).toBe("0%");
    expect(widthOf(0.5)).toBe("50%");
    expect(widthOf(1.7)).toBe("100%");
    expect(widthOf(Number.NaN)).toBe("0%");
  });

  it("defaults a row to no depth and the bid tint", () => {
    const { container } = render(<OrderBookRow side="bid" price="1" size="1" total="1" />);
    const bar = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(bar).toHaveClass("bg-positive/15");
    expect(bar.style.width).toBe("0%");
  });
});

describe("TradesTapeRow", () => {
  it("colours the bid side positive", () => {
    const { container, getByText } = render(
      <TradesTapeRow side="bid" price="1.020" size="5" time="12:00:01" />,
    );
    expect(container.querySelector('[data-slot="trades-tape-row"]')).toHaveAttribute(
      "data-side",
      "bid",
    );
    expect(getByText("1.020")).toHaveClass("text-positive");
    expect(getByText("12:00:01")).toBeInTheDocument();
  });
});

describe("OrderForm", () => {
  it("prevents the default on submit and still calls the handler", () => {
    const onSubmit = vi.fn<(e: React.FormEvent<HTMLFormElement>) => void>();
    const { container } = render(
      <OrderForm onSubmit={onSubmit}>
        <OrderFormRow label="Fee" value="0.10" />
        <OrderFormSubmit>Buy</OrderFormSubmit>
      </OrderForm>,
    );
    const form = container.querySelector('[data-slot="order-form"]') as HTMLFormElement;
    expect(form.tagName).toBe("FORM");

    const notPrevented = fireEvent.submit(form);
    expect(notPrevented).toBe(false);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0].defaultPrevented).toBe(true);
  });

  it("renders a summary row", () => {
    const { container, getByText } = render(<OrderFormRow label="Fee" value="0.10" />);
    expect(container.querySelector('[data-slot="order-form-row"]')).toBeInTheDocument();
    expect(getByText("Fee")).toHaveClass("text-ink-soft");
    expect(getByText("0.10")).toHaveClass("tabular-nums");
  });

  it("fills the submit by side", () => {
    const { getByRole, rerender } = render(<OrderFormSubmit>Buy</OrderFormSubmit>);
    const buy = getByRole("button");
    expect(buy).toHaveAttribute("type", "submit");
    expect(buy).toHaveAttribute("data-side", "buy");
    expect(buy).toHaveClass("bg-positive");
    expect(buy).toHaveClass("text-on-positive");
    expect(buy).toBeEnabled();

    rerender(
      <OrderFormSubmit side="sell" disabled>
        Sell
      </OrderFormSubmit>,
    );
    const sell = getByRole("button");
    expect(sell).toHaveAttribute("data-side", "sell");
    expect(sell).toHaveClass("bg-accent-error");
    expect(sell).toBeDisabled();
  });
});

describe("OpenOrdersEmpty", () => {
  it("reads calm, not as an error", () => {
    const { container } = render(<OpenOrdersEmpty>No open orders</OpenOrdersEmpty>);
    const el = container.querySelector('[data-slot="open-orders-empty"]')!;
    expect(el).toHaveTextContent("No open orders");
    expect(el).toHaveClass("text-ink-soft");
  });
});
