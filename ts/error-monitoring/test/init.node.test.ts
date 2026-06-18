import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// initServer/initEdge dynamic-import "@sentry/node"; mock it so we can assert
// the resolved init options without a real SDK or network.
const init = vi.fn();
vi.mock('@sentry/node', () => ({ init }));

type InitArg = {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: number;
};

function lastInitArg(): InitArg {
  return init.mock.calls[init.mock.calls.length - 1]![0] as InitArg;
}

describe('initServer / initEdge', () => {
  beforeEach(() => {
    init.mockClear();
    // Model a truly-unset environment so the default branches are exercised.
    vi.stubEnv('SENTRY_DSN', undefined);
    vi.stubEnv('APP_ENV', undefined);
    vi.stubEnv('NODE_ENV', undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('initServer uses defaults: undefined dsn, development env, tracing 1.0', async () => {
    const { initServer } = await import('../src/node/index.js');
    await initServer({});
    const arg = lastInitArg();
    expect(arg.dsn).toBeUndefined();
    expect(arg.environment).toBe('development');
    expect(arg.tracesSampleRate).toBe(1.0);
  });

  it('initServer reads SENTRY_DSN / APP_ENV / NODE_ENV from the environment', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://k@host/1');
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('NODE_ENV', 'production');
    const { initServer } = await import('../src/node/index.js');
    await initServer({});
    const arg = lastInitArg();
    expect(arg.dsn).toBe('https://k@host/1');
    expect(arg.environment).toBe('staging');
    expect(arg.tracesSampleRate).toBe(0.1); // production → defaultTracesSampleRate
  });

  it('initServer: explicit opts override env defaults', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://env@host/1');
    vi.stubEnv('APP_ENV', 'staging');
    vi.stubEnv('NODE_ENV', 'production');
    const { initServer } = await import('../src/node/index.js');
    await initServer({
      dsn: 'https://explicit@host/2',
      environment: 'qa',
      tracesSampleRate: 0.5,
    });
    const arg = lastInitArg();
    expect(arg.dsn).toBe('https://explicit@host/2');
    expect(arg.environment).toBe('qa');
    expect(arg.tracesSampleRate).toBe(0.5);
  });

  it('initServer: tracesSampleRate 0 (falsy) is respected, not replaced by the default', async () => {
    const { initServer } = await import('../src/node/index.js');
    await initServer({ tracesSampleRate: 0 });
    // `?? defaultTracesSampleRate` must keep an explicit 0 (nullish coalescing,
    // not `||`), otherwise an intentional "no tracing" gets silently flipped.
    expect(lastInitArg().tracesSampleRate).toBe(0);
  });

  it('initEdge defaults tracing to 0 while keeping dsn/env defaults', async () => {
    const { initEdge } = await import('../src/node/index.js');
    await initEdge({});
    const arg = lastInitArg();
    expect(arg.dsn).toBeUndefined();
    expect(arg.environment).toBe('development');
    expect(arg.tracesSampleRate).toBe(0);
  });

  it('initEdge reads dsn/env from the environment but still defaults tracing to 0', async () => {
    vi.stubEnv('SENTRY_DSN', 'https://k@host/9');
    vi.stubEnv('APP_ENV', 'production');
    vi.stubEnv('NODE_ENV', 'production');
    const { initEdge } = await import('../src/node/index.js');
    await initEdge({});
    const arg = lastInitArg();
    expect(arg.dsn).toBe('https://k@host/9');
    expect(arg.environment).toBe('production');
    expect(arg.tracesSampleRate).toBe(0); // edge ignores defaultTracesSampleRate
  });

  it('initEdge: explicit tracesSampleRate overrides the 0 default', async () => {
    const { initEdge } = await import('../src/node/index.js');
    await initEdge({ tracesSampleRate: 0.3 });
    expect(lastInitArg().tracesSampleRate).toBe(0.3);
  });
});
