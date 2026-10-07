// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
"use client";
import { useT } from "@evinvest/i18n/react";
import { helper } from "./helper.js";

const Lazy = () => import("./lazy");

export function Panel() {
  const t = useT();
  void Lazy;
  return (
    <div>
      {t("panel.k", "Panel")}
      {helper(t)}
    </div>
  );
}
