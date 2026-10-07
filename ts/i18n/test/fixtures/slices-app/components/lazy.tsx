// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
import { useT } from "@evinvest/i18n/react";

export default function Lazy() {
  const t = useT();
  return <i>{t("lazy.k", "Lazy")}</i>;
}
