import { describe, expect, it } from 'vitest';

import { Id } from '../src/identifier';

// u128 in Rust → bigint in TS (a `number` would silently lose precision past 2^53).
type AccountId = Id<'account', bigint>;
type TransferId = Id<'transfer', bigint>;

describe('Id', () => {
  it('round-trips through raw', () => {
    const id = Id.fromRaw<'account', bigint>(99n);
    expect(Id.raw(id)).toBe(99n);
  });

  it('equality is by value within a tag (=== on the branded primitive)', () => {
    const one: AccountId = Id.fromRaw<'account', bigint>(1n);
    const alsoOne: AccountId = Id.fromRaw<'account', bigint>(1n);
    const two: AccountId = Id.fromRaw<'account', bigint>(2n);
    expect(one === alsoOne).toBe(true);
    expect(one === two).toBe(false);
  });

  it('works as a Map key without a custom hash', () => {
    const byAccount = new Map<AccountId, string>();
    byAccount.set(Id.fromRaw<'account', bigint>(1n), 'a');
    expect(byAccount.get(Id.fromRaw<'account', bigint>(1n))).toBe('a');
    // A TransferId is a different type entirely — no accidental collision.
    const _t: TransferId = Id.fromRaw<'transfer', bigint>(1n);
    expect(byAccount.has(_t as unknown as AccountId)).toBe(true); // same primitive value 1n
  });

  it('preserves precision far beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = 2n ** 100n + 1n; // not exactly representable as an f64
    const id = Id.fromRaw<'account', bigint>(huge);
    expect(Id.raw(id)).toBe(huge);
    // The trap the bigint mapping avoids: routing through a double rounds the
    // low bit away, so the value would come back wrong.
    expect(BigInt(Number(huge))).not.toBe(huge);
    expect(BigInt(Number(huge))).toBe(2n ** 100n);
  });

  describe('UUID-backed ids (the default underlying)', () => {
    type DocId = Id<'doc'>;

    it('serializes transparently to JSON (the bare string, like Rust serde(transparent))', () => {
      const id: DocId = Id.fromRaw<'doc', string>('11111111-2222-3333-4444-555555555555');
      expect(JSON.stringify(id)).toBe('"11111111-2222-3333-4444-555555555555"');
      const back = JSON.parse(JSON.stringify(id)) as string;
      expect(Id.fromRaw<'doc', string>(back)).toBe(id);
    });

    it('mints unique v4 UUIDs', () => {
      expect(Id.newUuid<'doc'>()).not.toBe(Id.newUuid<'doc'>());
      expect(Id.newUuid<'doc'>()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });
  });

  it('bigint ids do NOT pass through JSON.stringify directly (documented divergence)', () => {
    const id = Id.fromRaw<'account', bigint>(42n);
    // Unlike Rust's serde(transparent) u128 → JSON number, JS cannot stringify a
    // bigint. Encode it as a string on the wire to keep full precision.
    expect(() => JSON.stringify(id)).toThrow(TypeError);
    const wire = Id.raw(id).toString();
    expect(wire).toBe('42');
    expect(Id.fromRaw<'account', bigint>(BigInt(wire))).toBe(id);
  });
});
