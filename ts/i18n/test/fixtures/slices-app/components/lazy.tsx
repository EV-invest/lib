import { useT } from "@evinvest/i18n/react";

export default function Lazy() {
  const t = useT();
  return <i>{t("lazy.k", "Lazy")}</i>;
}
