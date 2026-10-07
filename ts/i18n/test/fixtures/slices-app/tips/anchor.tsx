// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
"use client";
import { useT } from "@evinvest/i18n/react";
import { TIP_COPY } from "./copy";
import { tips, type TipKey } from "./catalog";

export function TipAnchor({ anchor }: { anchor: TipKey }) {
  const t = useT();
  void tips;
  const copy = TIP_COPY[anchor](t);
  return <span aria-label={t("tips.a11y.about", "About")}>{copy.title}</span>;
}
