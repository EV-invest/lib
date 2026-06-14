import { describe, expect, it } from 'vitest';

import { assertNever } from '../src/match';
import type { DomainEvent, EventEnvelope } from '../src/event';

type BlogEvent =
  | { kind: 'blog.published'; slug: string }
  | { kind: 'blog.archived'; reason: string };

// Compile-time check: every BlogEvent variant is assignable to DomainEvent.
const _sampleEvent: BlogEvent = { kind: 'blog.published', slug: 'hello' };
const _isDomainEvent: DomainEvent = _sampleEvent;

describe('EventEnvelope', () => {
  it('round-trips through JSON', () => {
    const envelope: EventEnvelope<BlogEvent> = {
      id: '00000000-0000-0000-0000-000000000000',
      occurredAt: '1970-01-01T00:00:00Z',
      payload: { kind: 'blog.published', slug: 'hello' },
    };

    const back = JSON.parse(JSON.stringify(envelope)) as EventEnvelope<BlogEvent>;

    expect(back.id).toBe(envelope.id);
    expect(back.occurredAt).toBe(envelope.occurredAt);
    expect(back.payload).toEqual(envelope.payload);
  });
});

describe('assertNever', () => {
  function describeEvent(event: BlogEvent): string {
    switch (event.kind) {
      case 'blog.published':
        return `published ${event.slug}`;
      case 'blog.archived':
        return `archived: ${event.reason}`;
      default:
        return assertNever(event);
    }
  }

  it('drives exhaustive handling of a discriminated union', () => {
    expect(describeEvent({ kind: 'blog.published', slug: 'x' })).toBe('published x');
    expect(describeEvent({ kind: 'blog.archived', reason: 'stale' })).toBe('archived: stale');
  });

  it('throws if an unhandled variant ever reaches it at runtime', () => {
    const rogue = { kind: 'blog.unknown' } as unknown as never;
    expect(() => assertNever(rogue)).toThrow(/Unexpected variant/);
  });
});
