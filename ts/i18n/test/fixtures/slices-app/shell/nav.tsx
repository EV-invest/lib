// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
/* A comment before the directive keeps it a directive. */
"use client";
import { useT } from "@evinvest/i18n/react";

export function Nav() {
  const t = useT();
  return <nav>{t("nav.home", "Home")}</nav>;
}
