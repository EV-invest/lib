// The package has no @types/jsdom; this is the one call the hydration half of
// `field.rsc.test.tsx` makes. Delete it if @types/jsdom is ever installed.
declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string);
    readonly window: Window & typeof globalThis;
  }
}
