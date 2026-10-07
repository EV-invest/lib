// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
"use client";
import { useT } from "@evinvest/i18n/react";

export type Only = string;

export function TypeOnly() {
  const t = useT();
  return t("typeonly.k", "Type only");
}
