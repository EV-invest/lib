import { defineSectionSuite } from "@evinvest/kitstart/testing/e2e";

// One visual baseline per section at both breakpoints; adding a section is one
// line. Each is reached by a `#` the site links to, never by scrolling.
defineSectionSuite([
  { name: "hero", url: "/fr", selector: "main > section >> nth=0" },
  { name: "quote", url: "/fr#quote", selector: "#quote-band" },
  { name: "areas", url: "/fr#areas", selector: "#areas" },
  { name: "callbar", url: "/fr", selector: "#callbar", mobileOnly: true, bare: true },
]);
