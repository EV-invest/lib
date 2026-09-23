"use client";

import dynamic from "next/dynamic";

/**
 * Next renders a segment's not-found boundary into every page under it, so it
 * must not read the request (that would make each cached page per-request
 * again) and should not weigh on pages that never 404: a lazily loaded client
 * module over the route params. The server still renders it into the 404.
 */
const Screen = dynamic(() => import("@/views/not-found").then(m => m.NotFound));

export default function NotFound() {
  return <Screen />;
}
