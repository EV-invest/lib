import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DUR, RISE, SETTLE_OPACITY, STAGGER } from "../src/core/motion-tokens";
import * as css from "../src/motion-css/index";
import * as js from "../src/motion/index";
import { withMotionEngine } from "../src/next/index";

const { CountUp, Reveal, Settle, SplitText, Stagger, StaggerItem } = css;
const html = (node: React.ReactNode) => renderToStaticMarkup(<>{node}</>);
const stylesheet = readFileSync(join(import.meta.dirname, "../styles/motion.css"), "utf8");

describe("the CSS motion engine", () => {
  it("renders on the server with no client code — it is what the flag swaps in", () => {
    const out = html(
      <Reveal onMount delay={0.1} from="left" className="x">
        a
      </Reveal>,
    );
    expect(out).toBe(
      '<div data-ev-motion="mount" style="--ev-from-x:16px;--ev-dur:700ms;--ev-delay:100ms" class="x">a</div>',
    );
  });

  it("offers every primitive the JS engine does, by the same name", () => {
    // `useReduceMotion` is a hook over a media query: CSS reads the query itself.
    const jsNames = Object.keys(js).filter(n => n !== "useReduceMotion").sort();
    expect(Object.keys(css).sort()).toEqual(jsNames);
  });

  it("reveals on scroll by default, on mount only when asked", () => {
    expect(html(<Reveal>a</Reveal>)).toContain('data-ev-motion="view"');
    expect(html(<Settle>a</Settle>)).toContain('data-ev-motion="settle"');
  });

  it("numbers stagger items in order, skipping what is not an item", () => {
    const out = html(
      <Stagger onMount step={0.1}>
        <StaggerItem>a</StaggerItem>
        <p>not an item</p>
        {["b", "c"].map(k => (
          <StaggerItem key={k}>{k}</StaggerItem>
        ))}
      </Stagger>,
    );
    expect(out).toContain('data-ev-stagger="mount" style="--ev-delay:0ms;--ev-step:100ms"');
    expect([...out.matchAll(/--ev-i:(\d)/g)].map(m => m[1])).toEqual(["0", "1", "2"]);
    expect(out).toContain("<p>not an item</p>");
  });

  it("keeps the split headline readable as one sentence", () => {
    const out = html(<SplitText>Fuite d’eau ?</SplitText>);
    expect(out).toContain(">Fuite d’eau ?</span>");
    expect(out.match(/aria-hidden="true" data-ev-motion="word"/g)).toHaveLength(3);
  });

  it("renders the final figure where the JS counter would count", () => {
    expect(html(<CountUp value={1234.5} locale="fr-FR" decimals={1} suffix=" €" />)).toBe(
      "<span>1 234,5 €</span>",
    );
  });
});

describe("motion.css", () => {
  it("mirrors the motion tokens", () => {
    const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(stylesheet)?.[1]?.trim();
    expect(token("--ev-motion-dur-base")).toBe(`${DUR.base * 1000}ms`);
    expect(token("--ev-motion-dur-slow")).toBe(`${DUR.slow * 1000}ms`);
    expect(token("--ev-motion-rise")).toBe(`${RISE}px`);
    expect(token("--ev-motion-settle-opacity")).toBe(String(SETTLE_OPACITY));
    expect(token("--ev-motion-stagger")).toBe(`${Math.round(STAGGER * 1000)}ms`);
  });

  it("hides nothing outside a keyframe — a browser running none of it shows everything", () => {
    const outsideKeyframes = stylesheet.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
    expect(outsideKeyframes).not.toMatch(/(?<![-\w])opacity\s*:/);
  });

  it("answers the reduced-motion preference for both triggers", () => {
    expect(stylesheet.match(/@media \(prefers-reduced-motion: reduce\)/g)).toHaveLength(2);
  });
});

describe("withMotionEngine", () => {
  it("leaves the config alone for the JS engine", () => {
    const config = { poweredByHeader: false };
    expect(withMotionEngine(config, "js")).toBe(config);
  });

  it("aliases the motion entry to the CSS one for Turbopack and webpack, keeping what was there", () => {
    const config = withMotionEngine(
      {
        turbopack: { resolveAlias: { a: "b" } },
        webpack: (c: { resolve?: { alias?: Record<string, unknown> } }) => ({ ...c, marked: true }),
      },
      "css",
    );
    expect(config.turbopack.resolveAlias).toEqual({ a: "b", "@evinvest/marketing/motion": "@evinvest/marketing/motion-css" });
    const webpack = config.webpack as (c: object, context: object) => object;
    const wp = webpack({ resolve: { alias: { x: "y" } } }, {});
    expect(wp).toMatchObject({
      marked: true,
      resolve: { alias: { x: "y", "@evinvest/marketing/motion$": "@evinvest/marketing/motion-css" } },
    });
  });
});
