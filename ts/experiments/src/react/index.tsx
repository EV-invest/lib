/**
 * @module @evinvest/experiments/react
 *
 * The React island for A/B experiments — a `"use client"` bundle (it uses
 * `createContext`, hooks, and `document.cookie`). It builds on the zero-dep
 * core ({@link select}, {@link cookieName}, {@link nextVariant}) and emits
 * events through an injected {@link CaptureFn} sink so it never depends on an
 * analytics SDK.
 *
 * Mirror of the `experiments` Cargo feature's client surface.
 */
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  cookieName,
  select,
  type CaptureFn,
  type ExperimentConfig,
  type ExperimentKey,
  type Variant,
} from '../index';

export type { CaptureFn } from '../index';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, matches `./next`'s abProxy

/**
 * Selects a React node by variant — {@link select} specialised to `ReactNode`.
 *
 * TypeScript enforces exhaustiveness: every variant of the union must appear as
 * a branch, so adding a variant to the config without updating a `match` call
 * is a compile-time error.
 *
 * @typeParam V - The variant union (e.g. `"a" | "b"`).
 * @param variant  - The active variant (e.g. from `getVariant`).
 * @param branches - A map from every valid variant to a React node.
 * @returns The node for the active variant.
 *
 * @example
 * ```tsx
 * const variant = await getVariant(config, "hero");
 * return match(variant, { a: <HeroA />, b: <HeroB /> });
 * ```
 */
export function match<V extends string>(
  variant: V,
  branches: { [K in V]: ReactNode },
): ReactNode {
  return select(variant, branches);
}

/**
 * Reads a cookie value by name from `document.cookie`. Client-only — lives in
 * this subpath because `document` is browser-only and the `./next` subpath must
 * stay server-safe.
 *
 * @param name - The cookie name (e.g. from {@link cookieName}).
 * @returns The cookie value, or `undefined` when it is not set.
 */
export function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${name}=`))
    ?.split('=')[1];
}

/**
 * Writes the chosen variant to the `ab_<key>` cookie (the same shape the Next
 * `abProxy` sets), so the next server render picks it up. Client-only; callers
 * typically follow with a router refresh to re-render the new variant.
 *
 * @param key   - The experiment key.
 * @param value - The variant value to persist.
 */
export function writeVariant(key: string, value: string): void {
  document.cookie = `${cookieName(key)}=${value};path=/;max-age=${COOKIE_MAX_AGE};samesite=lax`;
}

type ExperimentCtx = { experiment: string; variant: string; onEvent: CaptureFn };

const ExperimentContext = createContext<ExperimentCtx | null>(null);

/**
 * Props for {@link ExperimentTracker}.
 */
export interface ExperimentTrackerProps {
  /** The experiment key this subtree belongs to. */
  experiment: string;
  /** The variant served to this visitor (e.g. from `getVariant`). */
  variant: string;
  /**
   * The injected event sink. `${experiment}_exposed` is fired through this on
   * mount, and every {@link useExperimentEvent} `track` call routes through it.
   * Wire your analytics capture here — this package never imports one.
   */
  onEvent: CaptureFn;
  /** The variant's rendered content (kept out of the client bundle). */
  children: ReactNode;
}

/**
 * Client island that marks a section's A/B boundary.
 *
 * Fires `${experiment}_exposed` exactly once on mount through the injected
 * {@link CaptureFn} `onEvent` sink, so the consumer's analytics records which
 * variant was served. Provides `{ experiment, variant, onEvent }` context to
 * every {@link useExperimentEvent} call inside the subtree.
 *
 * Place it in the section's **server wrapper** and pass server-rendered
 * children — the children-prop pattern keeps the variant content out of the
 * client bundle.
 *
 * @param props - See {@link ExperimentTrackerProps}.
 *
 * @example
 * ```tsx
 * // server wrapper
 * export async function Hero() {
 *   const variant = await getVariant(config, "hero");
 *   return (
 *     <ExperimentTracker experiment="hero" variant={variant} onEvent={capture}>
 *       {match(variant, { a: <HeroA />, b: <HeroB /> })}
 *     </ExperimentTracker>
 *   );
 * }
 * ```
 */
export function ExperimentTracker({
  experiment,
  variant,
  onEvent,
  children,
}: ExperimentTrackerProps): ReactNode {
  useEffect(() => {
    onEvent(`${experiment}_exposed`, { variant });
  }, [experiment, variant, onEvent]);

  return (
    <ExperimentContext.Provider value={{ experiment, variant, onEvent }}>
      {children}
    </ExperimentContext.Provider>
  );
}

/**
 * The `track` function returned by {@link useExperimentEvent}.
 *
 * @param action  - Event action suffix — emitted as `${experiment}_${action}`.
 * @param props   - Extra primitive, non-PII props merged into the payload.
 * @param handler - When provided, called with `fire` instead of firing
 *                   directly; the handler decides when `fire()` runs relative
 *                   to its own side effects.
 */
export type TrackFn = (
  action: string,
  props?: Record<string, unknown>,
  handler?: (fire: () => void) => void,
) => void;

/**
 * Returns a `track` function scoped to the nearest {@link ExperimentTracker}.
 *
 * The emitted event name is `${experiment}_${action}` and the active `variant`
 * is merged into props automatically, so callers never thread the variant down
 * by hand. Events route through the {@link CaptureFn} `onEvent` sink the
 * tracker was given.
 *
 * @returns A {@link TrackFn} bound to the surrounding experiment context.
 * @throws {Error} When called outside an `<ExperimentTracker>` subtree.
 *
 * @example
 * ```tsx
 * const track = useExperimentEvent();
 *
 * // Fire immediately:
 * track("cta_clicked", { cta: "explore" });
 *
 * // Fire + side effect — the handler controls the order:
 * track("cta_clicked", { cta: "explore" }, (fire) => {
 *   fire();
 *   doSomethingElse();
 * });
 * ```
 */
export function useExperimentEvent(): TrackFn {
  const ctx = useContext(ExperimentContext);
  if (!ctx)
    throw new Error('useExperimentEvent must be used inside <ExperimentTracker>');

  const { experiment, variant, onEvent } = ctx;

  return function track(action, props, handler) {
    const fire = () => onEvent(`${experiment}_${action}`, { variant, ...props });
    if (handler) {
      handler(fire);
    } else {
      fire();
    }
  };
}

/**
 * Props for {@link DevAbPanel}.
 */
export interface DevAbPanelProps {
  /** The experiments config to enumerate buttons from. */
  config: ExperimentConfig;
  /**
   * Called when a variant button is clicked. Typically writes the cookie (via
   * {@link writeVariant}) and triggers a server re-render (e.g. a Next router
   * refresh) — the panel is prop-driven and imports no router itself.
   */
  onSelect: (key: string, variant: string) => void;
  /** Optional: called once after mount, e.g. to read current cookie values. */
  onRefresh?: () => void;
  /** Optional extra class on the root element. */
  className?: string;
}

const panelStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 12,
  right: 12,
  zIndex: 2147483647,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  borderRadius: 8,
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'rgba(0,0,0,0.9)',
  color: 'rgba(255,255,255,0.8)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: 10,
  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
};

/**
 * Development-only floating panel for overriding experiment variants.
 *
 * Renders a button per experiment × variant pair; clicking one calls
 * {@link DevAbPanelProps.onSelect}. The panel is fully prop-driven: it imports
 * no `next/navigation` and uses minimal inline styles (no Tailwind tokens), so
 * it drops into any app. Returns `null` outside `NODE_ENV === "development"`,
 * so it costs nothing in production.
 *
 * @param props - See {@link DevAbPanelProps}.
 *
 * @example
 * ```tsx
 * "use client";
 * import { useRouter } from "next/navigation";
 * import { DevAbPanel, writeVariant } from "@evinvest/experiments/react";
 *
 * export function AbPanel() {
 *   const router = useRouter();
 *   return (
 *     <DevAbPanel
 *       config={config}
 *       onSelect={(key, variant) => {
 *         writeVariant(key, variant);
 *         router.refresh();
 *       }}
 *     />
 *   );
 * }
 * ```
 */
export function DevAbPanel({
  config,
  onSelect,
  onRefresh,
  className,
}: DevAbPanelProps): ReactNode {
  useEffect(() => {
    onRefresh?.();
  }, [onRefresh]);

  if (process.env['NODE_ENV'] !== 'development') return null;

  const keys = Object.keys(config) as ExperimentKey<ExperimentConfig>[];

  return (
    <div
      {...(className !== undefined ? { className } : {})}
      style={panelStyle}
    >
      <span style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }}>A/B</span>
      {keys.map((key) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 64,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              opacity: 0.5,
            }}
          >
            {key}
          </span>
          {config[key]?.variants.map((v: Variant<ExperimentConfig, string>) => (
            <button
              key={v}
              type="button"
              onClick={() => onSelect(key, v)}
              style={{
                borderRadius: 4,
                padding: '2px 8px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: 'inherit',
                font: 'inherit',
              }}
            >
              {v}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
