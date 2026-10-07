/* A comment before the directive keeps it a directive. */
"use client";
import { useT } from "@evinvest/i18n/react";

export function Nav() {
  const t = useT();
  return <nav>{t("nav.home", "Home")}</nav>;
}
