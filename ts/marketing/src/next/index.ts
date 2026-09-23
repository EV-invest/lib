/**
 * `@evinvest/marketing/next` — build-time switches for a Next app.
 *
 * Plain functions over the config object, so this entry imports nothing from
 * `next` and runs in `next.config.ts` as is.
 */

/** Which implementation `@evinvest/marketing/motion` resolves to. */
export type MotionEngine = "js" | "css";

const MOTION = "@evinvest/marketing/motion";
const MOTION_CSS = "@evinvest/marketing/motion-css";

/** The slice of a Next config this touches; everything else passes through. */
interface ConfigSlice {
  turbopack?: { resolveAlias?: Record<string, unknown> } & Record<string, unknown>;
  webpack?: ((config: WebpackConfig, context: unknown) => WebpackConfig) | null;
}

interface WebpackConfig {
  resolve?: { alias?: Record<string, unknown> | unknown[] } & Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Picks the motion engine for the whole build. `"js"` leaves the config as it
 * is (`motion`, scroll-triggered once, ~30 KB gz). `"css"` aliases
 * `@evinvest/marketing/motion` to `@evinvest/marketing/motion-css`: the same
 * primitives as Server Components animated by `@evinvest/marketing/motion.css`,
 * and no animation runtime in the bundle.
 *
 * It is a build-time flag on purpose. A runtime switch could choose which
 * component renders but not what the browser downloads — the bytes are the
 * point. Set it from the environment to compare the two:
 *
 * ```ts
 * export default withMotionEngine(config, process.env.MOTION_ENGINE === "js" ? "js" : "css");
 * ```
 *
 * Only imports of `@evinvest/marketing/motion` are swapped; the `./react`
 * barrel still carries the JS primitives.
 */
export function withMotionEngine<C extends object>(config: C, engine: MotionEngine): C {
  if (engine === "js") return config;
  const c = config as C & ConfigSlice;
  const previousWebpack = c.webpack;
  return {
    ...config,
    turbopack: {
      ...c.turbopack,
      resolveAlias: { ...c.turbopack?.resolveAlias, [MOTION]: MOTION_CSS },
    },
    webpack(wp: WebpackConfig, context: unknown) {
      const out = previousWebpack ? previousWebpack(wp, context) : wp;
      const alias = out.resolve?.alias;
      if (Array.isArray(alias)) {
        alias.push({ name: MOTION, alias: MOTION_CSS, onlyModule: true });
      } else {
        // `$`: the exact specifier only, not `./motion-css` by prefix.
        out.resolve = { ...out.resolve, alias: { ...alias, [`${MOTION}$`]: MOTION_CSS } };
      }
      return out;
    },
  };
}
