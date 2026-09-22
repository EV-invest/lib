import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock `next/headers` so `getVariant` can run outside a request scope: the mock
// reads from a per-test cookie jar instead of a real Next request.
const cookieStore = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name) } : undefined,
  }),
}));

import { abProxy, createAbMiddleware, getVariant } from '../src/next/index';
import { pickVariantFor, type ExperimentConfig } from '../src/index';

const config = {
  hero: { variants: ['a', 'b'], weights: [1, 0] }, // weight forces "a"
} as const satisfies ExperimentConfig;

function makeRequest(cookie?: string, url = 'https://example.com/'): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(url, { headers });
}

describe('abProxy', () => {
  it('assigns a sticky cookie on first visit, writing request + response', () => {
    const request = makeRequest();
    const response = abProxy(config, request);

    // Written to the response so the browser persists it (30-day max-age).
    const set = response.cookies.get('ab_hero');
    expect(set?.value).toBe('a');
    expect(set?.maxAge).toBe(60 * 60 * 24 * 30);
    expect(set?.sameSite).toBe('lax');
    expect(set?.path).toBe('/');

    // Written to the forwarded request so this render's cookies() sees it.
    expect(request.cookies.get('ab_hero')?.value).toBe('a');
  });

  it('is sticky on return visits — no reassignment when the cookie exists', () => {
    const request = makeRequest('ab_hero=b');
    const response = abProxy(config, request);

    // No new assignment, so nothing is written to the response.
    expect(response.cookies.get('ab_hero')).toBeUndefined();
    // The existing request cookie is untouched.
    expect(request.cookies.get('ab_hero')?.value).toBe('b');
  });

  it('createAbMiddleware returns a handler with the same behaviour', () => {
    const handler = createAbMiddleware(config);
    const request = makeRequest();
    const response = handler(request);
    expect(response.cookies.get('ab_hero')?.value).toBe('a');
    expect(request.cookies.get('ab_hero')?.value).toBe('a');
  });

  it('forwards the incoming request headers onto the response', () => {
    const request = makeRequest();
    const response = abProxy(config, request);
    // NextResponse.next is built with the request headers, so the proxy is a
    // pass-through except for the assigned cookies — no error is thrown and a
    // response is produced.
    expect(response).toBeDefined();
    expect(response.cookies.get('ab_hero')?.value).toBe('a');
  });

  it('only assigns experiments whose cookie is absent', () => {
    const multi = {
      hero: { variants: ['a', 'b'], weights: [1, 0] },
      team: { variants: ['x', 'y'], weights: [1, 0] },
    } as const satisfies ExperimentConfig;
    // hero already set → untouched; team absent → assigned.
    const request = makeRequest('ab_hero=b');
    const response = abProxy(multi, request);

    expect(response.cookies.get('ab_hero')).toBeUndefined();
    expect(request.cookies.get('ab_hero')?.value).toBe('b');
    expect(response.cookies.get('ab_team')?.value).toBe('x');
    expect(request.cookies.get('ab_team')?.value).toBe('x');
  });
});

describe('getVariant', () => {
  afterEach(() => cookieStore.clear());

  it('resolves the assigned variant from the cookie jar', async () => {
    cookieStore.set('ab_hero', 'b');
    expect(await getVariant(config, 'hero')).toBe('b');
  });

  it('falls back to the control when the cookie is missing', async () => {
    expect(await getVariant(config, 'hero')).toBe('a');
  });

  it('falls back to the control when the cookie holds an unknown value', async () => {
    cookieStore.set('ab_hero', 'garbage');
    expect(await getVariant(config, 'hero')).toBe('a');
  });
});

describe('abProxy options', () => {
  const split = {
    hero: { variants: ['a', 'b'], weights: [0.5, 0.5] },
  } as const satisfies ExperimentConfig;

  it('uses the injected rng for new assignments', () => {
    const request = makeRequest();
    const response = abProxy(split, request, { rng: () => 0.9 });
    expect(response.cookies.get('ab_hero')?.value).toBe('b');
  });

  it('with a subject sets no cookie and forwards the per-subject variant', () => {
    const request = makeRequest('ab_hero=zzz');
    const response = abProxy(split, request, { subject: () => 'loc-7' });
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(request.cookies.get('ab_hero')?.value).toBe(pickVariantFor(split, 'hero', 'loc-7'));
  });

  it('falls back to the cookie flow when the subject resolver returns undefined', () => {
    const request = makeRequest();
    const response = abProxy(config, request, { subject: () => undefined });
    expect(response.cookies.get('ab_hero')?.value).toBe('a');
  });

  it('applies cookie prefix, maxAge, path, domain and sameSite', () => {
    const request = makeRequest();
    const response = abProxy(config, request, {
      cookie: { prefix: 'x_', maxAge: 60, path: '/fr', domain: '.brand.com', sameSite: 'strict' },
    });
    const set = response.cookies.get('x_hero');
    expect(set?.value).toBe('a');
    expect(set?.maxAge).toBe(60);
    expect(set?.path).toBe('/fr');
    expect(set?.domain).toBe('.brand.com');
    expect(set?.sameSite).toBe('strict');
    expect(response.cookies.get('ab_hero')).toBeUndefined();
  });

  it('does nothing for skipped requests', () => {
    const request = makeRequest();
    const response = abProxy(config, request, { skip: () => true });
    expect(response.cookies.getAll()).toHaveLength(0);
    expect(request.cookies.get('ab_hero')).toBeUndefined();
  });

  it('does not assign a disabled experiment', () => {
    const off = {
      hero: { variants: ['a', 'b'], weights: [1, 0], enabled: false },
    } as const satisfies ExperimentConfig;
    const request = makeRequest();
    const response = abProxy(off, request);
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it('forces a valid variant from the query, overriding and persisting it', () => {
    const request = makeRequest('ab_hero=a', 'https://example.com/?ab_hero=b');
    const response = abProxy(config, request, { forceParam: 'ab_' });
    expect(request.cookies.get('ab_hero')?.value).toBe('b');
    expect(response.cookies.get('ab_hero')?.value).toBe('b');
  });

  it('ignores an invalid forced variant', () => {
    const request = makeRequest('ab_hero=b', 'https://example.com/?ab_hero=zzz');
    const response = abProxy(config, request, { forceParam: 'ab_' });
    expect(request.cookies.get('ab_hero')?.value).toBe('b');
    expect(response.cookies.get('ab_hero')).toBeUndefined();
  });

  it('ignores the query unless forceParam is set', () => {
    const request = makeRequest(undefined, 'https://example.com/?ab_hero=b');
    const response = abProxy(config, request);
    expect(response.cookies.get('ab_hero')?.value).toBe('a');
  });

  it('forces in subject mode without setting a cookie', () => {
    const request = makeRequest(undefined, 'https://example.com/?force_hero=b');
    const response = abProxy(config, request, { subject: () => 'loc-1', forceParam: 'force_' });
    expect(request.cookies.get('ab_hero')?.value).toBe('b');
    expect(response.cookies.getAll()).toHaveLength(0);
  });

  it('createAbMiddleware forwards its options', () => {
    const request = makeRequest();
    const response = createAbMiddleware(split, { rng: () => 0.9 })(request);
    expect(response.cookies.get('ab_hero')?.value).toBe('b');
  });
});

describe('getVariant options', () => {
  afterEach(() => cookieStore.clear());

  const split = {
    hero: { variants: ['a', 'b'], weights: [0.5, 0.5] },
  } as const satisfies ExperimentConfig;

  it('with a subject ignores the cookie and matches pickVariantFor', async () => {
    cookieStore.set('ab_hero', 'zzz');
    expect(await getVariant(split, 'hero', { subject: 'loc-3' })).toBe(
      pickVariantFor(split, 'hero', 'loc-3'),
    );
  });

  it('reads the cookie under a custom prefix', async () => {
    cookieStore.set('x_hero', 'b');
    expect(await getVariant(split, 'hero', { cookie: { prefix: 'x_' } })).toBe('b');
  });

  it('honours a valid force and ignores an invalid one', async () => {
    cookieStore.set('ab_hero', 'a');
    expect(await getVariant(split, 'hero', { force: 'b' })).toBe('b');
    expect(await getVariant(split, 'hero', { force: 'zzz' })).toBe('a');
  });

  it('returns the control for a disabled experiment despite the cookie', async () => {
    const off = {
      hero: { variants: ['a', 'b'], weights: [1, 1], enabled: false },
    } as const satisfies ExperimentConfig;
    cookieStore.set('ab_hero', 'b');
    expect(await getVariant(off, 'hero')).toBe('a');
    expect(await getVariant(off, 'hero', { force: 'b' })).toBe('a');
  });
});
