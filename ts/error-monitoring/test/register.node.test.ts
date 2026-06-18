import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// initServer/initEdge dynamic-import "@sentry/node" — mock it so we can assert
// which runtime branch register() takes without a real SDK.
const init = vi.fn();
vi.mock('@sentry/node', () => ({ init }));

// src/next re-exports captureRequestError from "@sentry/nextjs" at module load;
// stub it so importing the module under test doesn't boot the real Next SDK.
const captureRequestError = vi.fn();
const withSentryConfig = vi.fn((c: unknown, _o: unknown) => ({ wrapped: c }));
vi.mock('@sentry/nextjs', () => ({
  captureRequestError,
  withSentryConfig,
}));

describe('register()', () => {
  const original = process.env['NEXT_RUNTIME'];

  beforeEach(() => {
    init.mockClear();
  });

  afterEach(() => {
    if (original === undefined) delete process.env['NEXT_RUNTIME'];
    else process.env['NEXT_RUNTIME'] = original;
    vi.resetModules();
  });

  it('initialises the server runtime when NEXT_RUNTIME === "nodejs"', async () => {
    process.env['NEXT_RUNTIME'] = 'nodejs';
    const { register } = await import('../src/next/index.js');
    await register();

    expect(init).toHaveBeenCalledTimes(1);
    // server default: tracing sampled (not the edge 0)
    const arg = init.mock.calls[0]![0] as { tracesSampleRate: number };
    expect(arg.tracesSampleRate).not.toBe(0);
  });

  it('initialises the edge runtime when NEXT_RUNTIME === "edge"', async () => {
    process.env['NEXT_RUNTIME'] = 'edge';
    const { register } = await import('../src/next/index.js');
    await register();

    expect(init).toHaveBeenCalledTimes(1);
    const arg = init.mock.calls[0]![0] as { tracesSampleRate: number };
    expect(arg.tracesSampleRate).toBe(0);
  });

  it('does nothing for an unknown runtime', async () => {
    process.env['NEXT_RUNTIME'] = 'browser';
    const { register } = await import('../src/next/index.js');
    await register();

    expect(init).not.toHaveBeenCalled();
  });

  it('does nothing when NEXT_RUNTIME is unset', async () => {
    delete process.env['NEXT_RUNTIME'];
    const { register } = await import('../src/next/index.js');
    await register();

    expect(init).not.toHaveBeenCalled();
  });

  it('forwards opts to the matching runtime initialiser', async () => {
    process.env['NEXT_RUNTIME'] = 'nodejs';
    const { register } = await import('../src/next/index.js');
    await register({ dsn: 'https://forwarded@host/1', environment: 'qa' });

    expect(init).toHaveBeenCalledTimes(1);
    const arg = init.mock.calls[0]![0] as { dsn: string; environment: string };
    expect(arg.dsn).toBe('https://forwarded@host/1');
    expect(arg.environment).toBe('qa');
  });
});

describe('next re-exports & withSentry', () => {
  afterEach(() => {
    withSentryConfig.mockClear();
    vi.resetModules();
  });

  it('re-exports captureRequestError from @sentry/nextjs', async () => {
    const mod = await import('../src/next/index.js');
    expect(mod.captureRequestError).toBe(captureRequestError);
  });

  it('withSentry passes config and opts through to withSentryConfig', async () => {
    const { withSentry } = await import('../src/next/index.js');
    const cfg = { reactStrictMode: true };
    const opts = { org: 'acme', project: 'web' };
    const result = await withSentry(cfg, opts);

    expect(withSentryConfig).toHaveBeenCalledTimes(1);
    expect(withSentryConfig).toHaveBeenCalledWith(cfg, opts);
    expect(result).toEqual({ wrapped: cfg });
  });

  it('withSentry defaults opts to {}', async () => {
    const { withSentry } = await import('../src/next/index.js');
    const cfg = { reactStrictMode: false };
    await withSentry(cfg);

    expect(withSentryConfig).toHaveBeenCalledWith(cfg, {});
  });
});
