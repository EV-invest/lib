"use client";

import dynamic from "next/dynamic";

/**
 * The 500, loaded on demand: an error boundary ships with every page under
 * it, so whatever it imports is paid by every visitor, error or not. It never
 * imports the site config — see `BRAND_PUBLIC`.
 */
const Screen = dynamic(() => import("@/views/server-error").then(m => m.ServerError));

export default function ErrorBoundary() {
  return <Screen />;
}
