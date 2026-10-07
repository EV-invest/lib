// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
import { translator } from "@evinvest/i18n";
import { Panel } from "@/components/panel";
import { TipAnchor } from "../../../tips/anchor";
import type { Only } from "@/components/typeonly";

export default function WalletPage() {
  const t = translator({}, "en");
  return (
    <main>
      <h1>{t("wallet.server", "Wallet")}</h1>
      <Panel />
      <TipAnchor anchor="wallet.x" />
    </main>
  );
}
