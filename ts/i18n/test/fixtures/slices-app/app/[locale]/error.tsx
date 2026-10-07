"use client";
import { useT } from "@evinvest/i18n/react";

export default function ErrorBoundary() {
  const t = useT();
  return <p>{t("err.title", "Something went wrong")}</p>;
}
