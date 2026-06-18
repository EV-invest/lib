import { describe, it, expect, vi } from 'vitest';
import {
  createSentrySink,
  noopErrorSink,
  defaultTracesSampleRate,
} from '../src/index.js';
import type { SentryLike } from '../src/index.js';

describe('createSentrySink', () => {
  it('delegates reportError to captureException with { extra: context }', () => {
    const captureException = vi.fn();
    const fake: SentryLike = { captureException };
    const sink = createSentrySink(fake);

    const err = new Error('boom');
    const ctx = { userId: 'u_1' };
    sink.reportError(err, ctx);

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(err, { extra: ctx });
  });

  it('passes undefined hint when no context is given', () => {
    const captureException = vi.fn();
    const fake: SentryLike = { captureException };
    const sink = createSentrySink(fake);

    const err = new Error('boom');
    sink.reportError(err);

    expect(captureException).toHaveBeenCalledWith(err, undefined);
  });
});

describe('noopErrorSink', () => {
  it('does nothing', () => {
    expect(() => noopErrorSink().reportError(new Error('x'), { a: 1 })).not.toThrow();
  });
});

describe('defaultTracesSampleRate', () => {
  it('is 0.1 in production and 1.0 otherwise', () => {
    expect(defaultTracesSampleRate('production')).toBe(0.1);
    expect(defaultTracesSampleRate('development')).toBe(1.0);
    expect(defaultTracesSampleRate(undefined)).toBe(1.0);
  });
});
