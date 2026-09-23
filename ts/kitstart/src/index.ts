/**
 * `@evinvest/kitstart` — the core. Pure: no React, no Next, no `node:*`, so
 * the proxy (edge), a client island and a server module can all import it.
 * Runtime-bound halves live on their own subpaths.
 */

export {
  bakedPlace,
  contactOf,
  defineSite,
  ogLocaleOf,
  perLocale,
  type BrandFacts,
  type LegacyRedirect,
  type PageSuffix,
  type Site,
  type SiteConfig,
  type Topology,
} from "./core/site";

export {
  createPlaceView,
  freshRating,
  parseInstant,
  isPublished,
  mergeLive,
  parsePlaceLive,
  placeHref,
  placeOrigin,
  placeUrl,
  publicationGaps,
  RATING_MAX_AGE_DAYS,
  servedLocalities,
  SERVICE_AREA_GATE,
  siteOrigin,
  STOREFRONT_GATE,
  storefrontOf,
  type DayOfWeek,
  type Geo,
  type LinkBase,
  type LinkMode,
  type OpeningHours,
  type OriginFacts,
  type Place,
  type PlaceLive,
  type PlaceView,
  type PostalAddress,
  type Presence,
  type PublicationField,
  type PublicationPolicy,
  type Rating,
  type ServiceArea,
} from "./core/place/index";

export {
  createRouting,
  GONE,
  GONE_HEADER,
  gonePath,
  goneHeader,
  HOST_MARK,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  parseGoneHeader,
  parsePlaceParam,
  PASS_PATHS,
  placeParam,
  pointSuffixes,
  THANKS,
  type Decision,
  type RequestFacts,
  type Routing,
} from "./core/routing";

export {
  LEAD_SCHEMA_VERSION,
  MAX_FIELD,
  readCandidate,
  validateCandidate,
  type Lead,
  type LeadCandidate,
  type LeadExtra,
  type LeadSchema,
  type LeadStore,
  type LeadWire,
  type SpamVerdict,
} from "./core/lead";

export {
  checkTiming,
  HONEYPOT_FIELD,
  LEGACY_HONEYPOT_FIELDS,
  MIN_FILL_MS,
  RATE_LIMIT_MAX_KEYS,
  RateLimiter,
  RENDERED_AT_FIELD,
  screen,
  type Screening,
} from "./core/antispam";

export {
  createAcceptLead,
  FORM_ID_FIELD,
  LOCALE_FIELD,
  LOCATION_FIELD,
  type AcceptDeps,
  type Outcome,
} from "./core/accept";

export {
  areaServedNodes,
  breadcrumbNode,
  businessId,
  businessNode,
  faqPageNode,
  offerNodes,
  organizationId,
  organizationNode,
  placeGraph,
  websiteId,
  type OfferInput,
  type PageGraphCopy,
  type QuestionAnswer,
} from "./core/seo/ld";

export {
  AI_CRAWLERS,
  ogImageUrl,
  robotsFor,
  sitemapFor,
  type RobotsFile,
  type RobotsRule,
  type SitemapEntry,
} from "./core/seo/sitemap";

export {
  ALLOWED_PROPS,
  analyticsSink,
  countsAsPageView,
  EVENTS,
  type AnalyticsTarget,
  type IntentChannel,
} from "./core/analytics";

export type {
  CallBarText,
  CopySlice,
  CoreText,
  PageMetaCopy,
  QuoteFormCopy,
  Said,
  StatusAction,
  StatusCopy,
  StatusScreenText,
} from "./core/content";


// A landing needs these beside the machinery; re-exported by name so a brand
// imports one package and the list here is the whole surface.
export { createLocaleRegistry, type LocaleRegistry } from "@evinvest/i18n";
export {
  contactChannel,
  ldCompact,
  localBusiness,
  telHref,
  whatsappHref,
  type ContactChannel,
  type JsonLdNode,
} from "@evinvest/marketing";
export { createBeaconSink, noopSink, type AnalyticsSink } from "@evinvest/analytics";
