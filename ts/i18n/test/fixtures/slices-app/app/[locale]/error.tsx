// @ts-nocheck — a fixture app for slices.node.test.ts, read by the slice generator, never compiled.
"use client";
import { useT } from "@evinvest/i18n/react";

export default function ErrorBoundary() {
  const t = useT();
  return <p>{t("err.title", "Something went wrong")}</p>;
}
