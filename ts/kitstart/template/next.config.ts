import { withLanding } from "@evinvest/kitstart/next/config";

// Everything shared is in `withLanding` (standalone output, the card inlined,
// ISR bounds, no image optimiser); what is left here is the brand's own.
export default withLanding({}, { root: process.cwd(), ogFiles: ["./assets/fonts/*.ttf"] });
