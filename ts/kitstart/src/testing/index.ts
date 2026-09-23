/**
 * `@evinvest/kitstart/testing` — the suites a brand runs from its own vitest:
 * the landing contract over its site config, the lead store contract over any
 * adapter, and fixtures in both place shapes. `vitest` is not a peer: the
 * brand installs it in its own `devDependencies`, like `@playwright/test` for
 * `./testing/e2e`.
 * The Playwright half is `./testing/e2e`.
 */
export { describeLandingContract, type LandingContractOptions } from "./landing-contract";
export { describeLeadStoreContract, type LeadStoreHarness } from "./lead-store-contract";
export { serviceAreaPlace, storefrontPlace, testLead } from "./fixtures";
