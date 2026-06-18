import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { abProxy, createAbMiddleware } from '../src/next/index';
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
});
