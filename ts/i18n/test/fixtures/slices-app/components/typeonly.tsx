"use client";
import { useT } from "@evinvest/i18n/react";

export type Only = string;

export function TypeOnly() {
  const t = useT();
  return t("typeonly.k", "Type only");
}
