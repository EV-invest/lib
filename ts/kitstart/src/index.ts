/**
 * `@evinvest/kitstart` — the core. Pure: no React, no Next, no `node:*`, so
 * the proxy (edge), a client island and a server module can all import it.
 * Runtime-bound halves live on their own subpaths.
 */

export {
  assertLaunchable,
  bakedPlace,
  cardFact,
  contactOf,
  defineSite,
  ogLocaleOf,
  openLaunchBlockers,
  perLocale,
  type BrandFacts,
  type LegacyRedirect,
  type OwnerTodo,
  type PageSuffix,
  type Site,
  type SiteConfig,
  type Topology,
} from "./core/site";

export {
  createPlaceView,
  DEFAULT_TIME_ZONE,
  freshRating,
  isOpenAt,
  nextOpening,
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
  type Opening,
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
  NON_PAGE_ROUTES,
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
  CARD_FIELD,
  CARD_ID,
  CHANNEL_FIELD,
  channelOf,
  CONSENT_FIELD,
  LEAD_CHANNELS,
  LEAD_ERROR_PARAM,
  LEAD_SCHEMA_VERSION,
  MAX_CONSENT,
  MAX_FIELD,
  readCandidate,
  rejectionOf,
  SUBMISSION_FIELD,
  SUBMISSION_ID,
  validateCallbackLead,
  validateCandidate,
  validateLead,
  type Lead,
  type LeadCandidate,
  type LeadChannel,
  type LeadConsent,
  type LeadExtra,
  type LeadRejection,
  type LeadSchema,
  type LeadStore,
  type LeadVerdict,
  type LeadWire,
  type SpamVerdict,
} from "./core/lead";

export { isMobilePhone, isPlausiblePhone, normalizePhone, phoneProblem } from "./core/phone";

export { LEAD_CAPTURE_TEXT, type LeadCaptureText } from "./core/lead-capture-text";
export { fillText, openingText } from "./core/lead-capture-format";

export {
  channelHref,
  resolveChannels,
  smsHref,
  type CaptureChannel,
  type ChannelFacts,
  type ChannelOptions,
  type ResolvedChannels,
} from "./core/channels";

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
  EXPERIMENT_FIELD,
  FORM_ID_FIELD,
  LOCALE_FIELD,
  LOCATION_FIELD,
  VARIANT_FIELD,
  type AcceptDeps,
  type Outcome,
  type SubmitTags,
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
  EXPERIMENT_SLUG,
  experimentProps,
  type AnalyticsTarget,
  type IntentChannel,
  type LeadField,
  type LeadStep,
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


export { brandStatusTarget, statusTarget, thanksChannel, thanksSuffix, type StatusTarget } from "./core/status";

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
