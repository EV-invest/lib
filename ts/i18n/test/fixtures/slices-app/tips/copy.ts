import type { Translate } from "@evinvest/i18n";
import type { TipKey } from "./catalog";

export const TIP_COPY: Record<TipKey, (t: Translate) => { title: string; body: string }> = {
  "wallet.x": t => ({ title: t("tips.wallet.x.title", "Wallet tip"), body: t("tips.wallet.x.body", "Wallet tip body") }),
  "invest.y": t => ({ title: t("tips.invest.y.title", "Invest tip"), body: t("tips.invest.y.body", "Invest tip body") }),
};
