/**
 * `@evinvest/marketing` — the server-safe core.
 *
 * No `"use client"`, no DOM, no hooks: everything here can be imported from a
 * React Server Component and gets the real value, not a client reference.
 * The interactive half (motion, the form field and harness, the click tracker,
 * the click-to-load facade) is `@evinvest/marketing/react`.
 */

export {
  DUR,
  EASE,
  RISE,
  SETTLE_OPACITY,
  STAGGER,
  STAGGER_TEXT,
  VIEWPORT,
  VIEWPORT_LIVE,
  VIEWPORT_Y,
} from "./core/motion-tokens";

export { Accented, accented, type AccentedProps } from "./core/accented";

export {
  charLength,
  firstFieldErrors,
  fromSafeParse,
  translateErrors,
  type FieldErrors,
  type FormStatus,
  type SafeParseLike,
  type SubmitFailure,
  type Translate,
  type Validated,
  type ValidationIssue,
} from "./core/validation";

export {
  contactChannel,
  telHref,
  whatsappHref,
  type ContactChannel,
} from "./core/contact";

export {
  JsonLd,
  geoCoordinates,
  ldCompact,
  localBusiness,
  postalAddress,
  type GeoInput,
  type JsonLdNode,
  type LocalBusinessInput,
  type PostalAddressInput,
} from "./core/json-ld";
