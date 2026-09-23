/**
 * Class joining for the server widgets. Not the kit's `cn`: today the kit is
 * one `"use client"` bundle, so its `cn` is a client reference on the server
 * and cannot be called from a Server Component
 * (TODO(EV-invest/lib#140): the per-module kit makes it server-safe). No
 * conflict merging either — the widgets' classes and a brand's override are
 * meant to stack, and a brand that needs to replace one passes its own.
 */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
