import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { useState, act } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ErrorBoundary,
  ErrorMonitoringProvider,
} from '../src/react/index.js';
import type {
  ErrorSink,
  SentryLike,
} from '../src/index.js';
import type { BrowserSentryLike } from '../src/react/index.js';

function Boom(): ReactNode {
  throw new Error('kaboom');
}

let container: HTMLDivElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

function mount(node: ReactNode): { root: ReturnType<typeof createRoot> } {
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  return { root };
}

function fakeBrowserSentry(): BrowserSentryLike & {
  init: ReturnType<typeof vi.fn>;
  addIntegration: ReturnType<typeof vi.fn>;
  replayIntegration: ReturnType<typeof vi.fn>;
  captureException: ReturnType<typeof vi.fn>;
} {
  return {
    init: vi.fn(),
    addIntegration: vi.fn(),
    replayIntegration: vi.fn(() => ({ kind: 'replay' })),
    captureException: vi.fn(),
  };
}

describe('ErrorBoundary', () => {
  it('reports to the sink with { componentStack }, calls onError, renders fallback', () => {
    const reportError = vi.fn();
    const sink: ErrorSink = { reportError };
    const onError = vi.fn();

    // React logs caught errors to console.error; silence it for a clean run.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <ErrorBoundary
        sink={sink}
        onError={onError}
        fallback={<div>fallback ui</div>}
      >
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(container.textContent).toContain('fallback ui');

    expect(reportError).toHaveBeenCalledTimes(1);
    const [err, ctx] = reportError.mock.calls[0]!;
    expect((err as Error).message).toBe('kaboom');
    expect(ctx).toHaveProperty('componentStack');

    expect(onError).toHaveBeenCalledTimes(1);
    const [oErr] = onError.mock.calls[0]!;
    expect((oErr as Error).message).toBe('kaboom');
  });

  it('renders children when nothing throws', () => {
    mount(
      <ErrorBoundary fallback={<div>fallback ui</div>}>
        <div>healthy</div>
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('healthy');
    expect(container.textContent).not.toContain('fallback ui');
  });

  it('supports a render-prop fallback receiving the error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <ErrorBoundary fallback={(error) => <div>{error.message}</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    expect(container.textContent).toContain('kaboom');
  });

  it('wraps a `sentry` SDK as the sink when no explicit sink is given', () => {
    const captureException = vi.fn();
    const sentry: SentryLike = { captureException };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <ErrorBoundary sentry={sentry} fallback={<div>boom-fallback</div>}>
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();

    expect(captureException).toHaveBeenCalledTimes(1);
    const [err, hint] = captureException.mock.calls[0]!;
    expect((err as Error).message).toBe('kaboom');
    expect(hint).toHaveProperty('extra');
    expect((hint as { extra: Record<string, unknown> }).extra).toHaveProperty(
      'componentStack',
    );
  });

  it('falls back to the noop sink when neither sink nor sentry is given (no throw)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      mount(
        <ErrorBoundary fallback={<div>silent</div>}>
          <Boom />
        </ErrorBoundary>,
      ),
    ).not.toThrow();
    spy.mockRestore();
    expect(container.textContent).toContain('silent');
  });

  it('renders null fallback by default after catching', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mount(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    spy.mockRestore();
    expect(container.textContent).toBe('');
  });

  it('does not report on a normal render — only on catch', () => {
    const reportError = vi.fn();
    const sink: ErrorSink = { reportError };
    mount(
      <ErrorBoundary sink={sink}>
        <div>healthy</div>
      </ErrorBoundary>,
    );
    expect(reportError).not.toHaveBeenCalled();
  });

  it('reset() clears the error and re-renders the recovered subtree', () => {
    // A child that throws on its first render, then renders fine after reset.
    let shouldThrow = true;
    function Flaky(): ReactNode {
      const [, force] = useState(0);
      if (shouldThrow) throw new Error('first render fails');
      void force;
      return <div>recovered</div>;
    }

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let resetFn: (() => void) | undefined;
    mount(
      <ErrorBoundary
        fallback={(_error, reset) => {
          resetFn = reset;
          return <div>fallback</div>;
        }}
      >
        <Flaky />
      </ErrorBoundary>,
    );
    expect(container.textContent).toContain('fallback');

    shouldThrow = false;
    act(() => {
      resetFn!();
    });
    spy.mockRestore();
    expect(container.textContent).toContain('recovered');
  });
});

describe('ErrorMonitoringProvider', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', undefined);
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', undefined);
    vi.stubEnv('NODE_ENV', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders its children verbatim', () => {
    const sentry = fakeBrowserSentry();
    mount(
      <ErrorMonitoringProvider sentry={sentry}>
        <div>child content</div>
      </ErrorMonitoringProvider>,
    );
    expect(container.textContent).toContain('child content');
  });

  it('initialises the injected SDK with env-derived defaults', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const sentry = fakeBrowserSentry();

    mount(
      <ErrorMonitoringProvider sentry={sentry}>
        <div>x</div>
      </ErrorMonitoringProvider>,
    );

    expect(sentry.init).toHaveBeenCalledTimes(1);
    const arg = sentry.init.mock.calls[0]![0] as {
      dsn?: string;
      environment?: string;
      tracesSampleRate?: number;
      replaysOnErrorSampleRate?: number;
      replaysSessionSampleRate?: number;
    };
    expect(arg.dsn).toBeUndefined();
    expect(arg.environment).toBe('development');
    expect(arg.tracesSampleRate).toBe(0.1); // NODE_ENV=production
    expect(arg.replaysOnErrorSampleRate).toBe(1.0);
    expect(arg.replaysSessionSampleRate).toBe(0.05);
  });

  it('reads NEXT_PUBLIC_* env and lets options override them', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://env@host/1');
    vi.stubEnv('NEXT_PUBLIC_APP_ENV', 'staging');
    const sentry = fakeBrowserSentry();

    mount(
      <ErrorMonitoringProvider
        sentry={sentry}
        options={{ environment: 'override-env', tracesSampleRate: 0.42 }}
      >
        <div>x</div>
      </ErrorMonitoringProvider>,
    );

    const arg = sentry.init.mock.calls[0]![0] as {
      dsn?: string;
      environment?: string;
      tracesSampleRate?: number;
    };
    expect(arg.dsn).toBe('https://env@host/1'); // from env (no option override)
    expect(arg.environment).toBe('override-env'); // option wins
    expect(arg.tracesSampleRate).toBe(0.42); // option wins
  });

  it('adds the replay integration in a window (jsdom) environment', () => {
    const sentry = fakeBrowserSentry();
    mount(
      <ErrorMonitoringProvider sentry={sentry}>
        <div>x</div>
      </ErrorMonitoringProvider>,
    );
    // jsdom defines `window`, so the replay integration is registered.
    expect(sentry.replayIntegration).toHaveBeenCalledTimes(1);
    expect(sentry.addIntegration).toHaveBeenCalledWith({ kind: 'replay' });
  });

  it('initialises only once across re-renders', () => {
    const sentry = fakeBrowserSentry();
    const { root } = mount(
      <ErrorMonitoringProvider sentry={sentry}>
        <div>first</div>
      </ErrorMonitoringProvider>,
    );
    act(() => {
      root.render(
        <ErrorMonitoringProvider sentry={sentry}>
          <div>second</div>
        </ErrorMonitoringProvider>,
      );
    });
    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('second');
  });
});
