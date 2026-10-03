import {
  Badge,
  Button,
  ListRow,
  ListRows,
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@evinvest/uikit";

const KEYS = [
  { id: "sk_live_7f3a", kind: "api", brands: "aquafix, vifnet", created: "2026-09-30 14:02", revoked: false },
  { id: "sk_live_2b91", kind: "form", brands: "aquafix", created: "2026-09-12 09:41", revoked: true },
  { id: "sk_live_c04e", kind: "api", brands: "kitstart", created: "2026-08-03 18:17", revoked: false },
];

const FILLS = [
  { at: "14:02:11", side: "buy", price: "1.0042", size: "1,250.00", fee: "0.63" },
  { at: "14:01:57", side: "sell", price: "1.0038", size: "310.50", fee: "" },
  { at: "13:59:03", side: "buy", price: "1.0040", size: "12,000.00", fee: "6.02" },
];

/** The card list (variant="card" in a TableCard), its phone form (ListRows), and a compact ledger. */
export function TablesDemo() {
  return (
    <div className="flex w-full flex-col gap-6">
      <TableCard>
        <Table variant="card">
          <TableHeader>
            <TableRow>
              <TableHead>Key</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Brands</TableHead>
              <TableHead align="end">Created</TableHead>
              <TableHead>
                <span className="sr-only">State</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {KEYS.map((k) => (
              <TableRow key={k.id} data-state={k.id === "sk_live_7f3a" ? "selected" : undefined}>
                <TableCell className="font-mono text-xs">{k.id}</TableCell>
                <TableCell>{k.kind}</TableCell>
                <TableCell className="text-ink-mid">{k.brands}</TableCell>
                <TableCell align="end" className="text-ink-soft">{k.created}</TableCell>
                <TableCell align="end">
                  {k.revoked ? <Badge variant="outline">revoked</Badge> : <Button size="sm" variant="outline">Revoke</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>

      <TableCard className="max-w-sm">
        <ListRows variant="card">
          {KEYS.map((k) => (
            <ListRow key={k.id} label={<span className="font-mono text-xs">{k.id}</span>} description={`${k.kind} · ${k.brands}`}>
              {k.revoked ? <Badge variant="outline">revoked</Badge> : <Button size="sm" variant="outline">Revoke</Button>}
            </ListRow>
          ))}
        </ListRows>
      </TableCard>

      <Table density="compact">
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Side</TableHead>
            <TableHead align="end">Price</TableHead>
            <TableHead align="end">Size</TableHead>
            <TableHead align="end">Fee</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {FILLS.map((f) => (
            <TableRow key={f.at}>
              <TableCell className="text-ink-soft">{f.at}</TableCell>
              <TableCell className={f.side === "sell" ? "font-semibold text-accent-error" : "font-semibold text-positive"}>{f.side}</TableCell>
              <TableCell align="end">{f.price}</TableCell>
              <TableCell align="end">{f.size}</TableCell>
              <TableCell align="end">{f.fee || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
