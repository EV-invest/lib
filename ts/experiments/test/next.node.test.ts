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
import { type ExperimentConfig } from '../src/index';

const config = {
  hero: { variants: ['a', 'b'], weights: [1, 0] }, // weight forces "a"
} as const satisfies ExperimentConfig;

function makeRequest(cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest('https://example.com/', { headers });
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
