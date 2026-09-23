"use client";

import dynamic from "next/dynamic";

/**
 * The boundary for a `notFound()` the proxy could not foresee — a place the
 * live source withdrew. Every dead path the proxy recognises goes to
 * `app/global-not-found.tsx` instead: Next 16 answers a `notFound()` with an
 * empty shell and renders this boundary only in the browser.
 *
 * Rendered into every page under the segment, so it must not read the request
 * and should not weigh on pages that never 404: a lazily loaded client module.
 */
const Screen = dynamic(() => import("@/views/not-found").then(m => m.NotFound));

export default function NotFound() {
  return <Screen />;
}
