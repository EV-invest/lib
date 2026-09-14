import { useState } from "react";
import {
  Input,
  Label,
  OpenOrdersEmpty,
  OrderBook,
  OrderBookHead,
  OrderBookRow,
  OrderBookSpread,
  OrderForm,
  OrderFormRow,
  OrderFormSubmit,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Terminal,
  TerminalChart,
  TerminalPane,
  TerminalPaneBody,
  TerminalPaneHeader,
  TerminalTicker,
  TickerStat,
  toast,
  TradesTapeRow,
  type BookSide,
  type OrderSide,
} from "@evinvest/uikit";

interface Level {
  price: string;
  size: string;
  total: string;
  depth: number;
}

const ASKS: Level[] = [
  { price: "1.034", size: "420", total: "1 260", depth: 1 },
  { price: "1.032", size: "300", total: "840", depth: 0.67 },
  { price: "1.030", size: "120", total: "540", depth: 0.43 },
  { price: "1.028", size: "80", total: "420", depth: 0.33 },
];

const BIDS: Level[] = [
  { price: "1.024", size: "150", total: "150", depth: 0.12 },
  { price: "1.022", size: "260", total: "410", depth: 0.33 },
  { price: "1.020", size: "500", total: "910", depth: 0.72 },
  { price: "1.018", size: "350", total: "1 260", depth: 1 },
];

const TAPE: { side: BookSide; price: string; size: string; time: string }[] = [
  { side: "bid", price: "1.024", size: "12", time: "12:00:07" },
  { side: "ask", price: "1.026", size: "40", time: "12:00:04" },
  { side: "bid", price: "1.024", size: "5", time: "12:00:01" },
];

/**
 * Fake data only: the point is the frame, the depth bars and the side colours.
 * The chart host is left empty on purpose — the plotting engine is the
 * consumer's, and the example bundles none.
 */
export function TerminalDemo() {
  const [side, setSide] = useState<OrderSide>("buy");
  const [size, setSize] = useState("100");
  const [price, setPrice] = useState("1.024");

  return (
    // the frame is viewport-bound from `lg`; the gallery caps it so the page keeps scrolling
    <Terminal className="lg:h-[36rem] lg:grid-rows-[auto_minmax(0,1fr)_8rem]">
      <TerminalTicker>
        <TickerStat label="Product" value="EV-RE-01" />
        <TickerStat label="Last" value="1.024" />
        <TickerStat label="24h change" value="+1.2%" className="text-positive" />
        <TickerStat label="24h volume" value="12 480" />
        <TickerStat label="NAV" value="1.020" />
      </TerminalTicker>

      <TerminalPane area="chart">
        <TerminalPaneHeader>Chart</TerminalPaneHeader>
        <TerminalPaneBody>
          <TerminalChart className="grid place-items-center text-ink-soft text-xs">
            chart host — mount a plotting engine here
          </TerminalChart>
        </TerminalPaneBody>
      </TerminalPane>

      <TerminalPane area="book">
        <TerminalPaneHeader>Order book</TerminalPaneHeader>
        <TerminalPaneBody>
          <OrderBook>
            <OrderBookHead price="Price" size="Size" total="Total" />
            {ASKS.map((l) => (
              <OrderBookRow key={l.price} side="ask" {...l} onClick={() => setPrice(l.price)} />
            ))}
            <OrderBookSpread>
              <span>1.026</span>
              <span>spread 0.004</span>
            </OrderBookSpread>
            {BIDS.map((l) => (
              <OrderBookRow key={l.price} side="bid" {...l} onClick={() => setPrice(l.price)} />
            ))}
          </OrderBook>
          <div className="border-border border-t">
            {TAPE.map((t) => (
              <TradesTapeRow key={t.time} {...t} />
            ))}
          </div>
        </TerminalPaneBody>
      </TerminalPane>

      <TerminalPane area="form">
        <TerminalPaneHeader>
          <Tabs value={side} onValueChange={(v) => setSide(v as OrderSide)}>
            <TabsList>
              <TabsTrigger value="buy">Buy</TabsTrigger>
              <TabsTrigger value="sell">Sell</TabsTrigger>
            </TabsList>
          </Tabs>
        </TerminalPaneHeader>
        <TerminalPaneBody>
          <OrderForm onSubmit={() => toast.positive(`${side} ${size} @ ${price}`)}>
            <div className="space-y-1">
              <Label htmlFor="t-price">Price</Label>
              <Input id="t-price" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="t-size">Size</Label>
              <Input id="t-size" value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <OrderFormRow label="Cost" value="102.40" />
            <OrderFormRow label="Fee" value="0.10" />
            <OrderFormRow label="Available" value="5 000.00" />
            <OrderFormSubmit side={side}>{side === "buy" ? "Buy" : "Sell"}</OrderFormSubmit>
          </OrderForm>
        </TerminalPaneBody>
      </TerminalPane>

      <TerminalPane area="orders">
        <TerminalPaneHeader>
          <Tabs defaultValue="open">
            <TabsList>
              <TabsTrigger value="open">Open orders</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="open" />
            <TabsContent value="history" />
          </Tabs>
        </TerminalPaneHeader>
        <TerminalPaneBody>
          <OpenOrdersEmpty>No open orders</OpenOrdersEmpty>
        </TerminalPaneBody>
      </TerminalPane>
    </Terminal>
  );
}
