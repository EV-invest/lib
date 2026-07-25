# `@evinvest/types`

Shared domain types with validation — TypeObjects for phone numbers, emails,
and other canonical value objects. Zero runtime deps for the core; the optional
`./react` subpath ships input-binding hooks for React.

## Install

```bash
npm install @evinvest/types
```

## PhoneNumber

An E.164 phone number as a branded string (TypeObject). The canonical form is
`+<country code><subscriber number>` — just `+` and digits, no spaces or
separators. Validation follows ITU-T E.164: 7–15 digits after the `+`, with a
valid country code.

### Construction

```ts
import { PhoneNumber } from '@evinvest/types';

// Validated construction — throws on invalid input.
const pn = PhoneNumber.from('+12345678901');

// Unvalidated — for trusted sources (DB, API).
const pn2 = PhoneNumber.fromUnsafe('+12345678901');

// Parse loosely-formatted user input.
const pn3 = PhoneNumber.parseInput('+1 (234) 567-8901');
// → PhoneNumber('+12345678901')
```

### Validation

```ts
// Non-throwing — returns { ok: true } | { ok: false, code, message }.
const result = PhoneNumber.validate('+12345678901');
if (result.ok) {
  // valid
} else {
  console.log(result.code); // 'too_short' | 'too_long' | 'invalid_country_code' | …
}
```

### Type guard

```ts
if (PhoneNumber.isPhoneNumber(value)) {
  // value is PhoneNumber here
}
```

### Formatting

```ts
PhoneNumber.format(pn);       // '+1 234 567 8901'
PhoneNumber.format(pn, '-');  // '+1-234-567-8901'
PhoneNumber.formatLocal(pn);  // '00 1 234 567 8901'
```

### Raw access

```ts
PhoneNumber.raw(pn); // '+12345678901'
```

## React hook

```tsx
import { usePhoneNumber } from '@evinvest/types/react';

function PhoneField({ onValid }: { onValid: (pn: PhoneNumber) => void }) {
  const { inputProps, value, error } = usePhoneNumber({ onValid });

  return (
    <div>
      <input {...inputProps} placeholder="+1 234 567 8901" />
      {error && <p role="alert">{error.message}</p>}
    </div>
  );
}
```

The hook owns the input's display state:

- **While typing** — the raw keystrokes are shown (no reformatting mid-edit).
- **On blur** — reformats to canonical international form when valid.
- **Validation** — runs on every keystroke; `value` is `undefined` until the
  input is a complete valid number.
- **Accessibility** — sets `aria-invalid` when the input is non-empty and
  invalid.

### API

```ts
function usePhoneNumber(options?: {
  initial?: string | PhoneNumber;
  onValid?: (pn: PhoneNumber) => void;
}): {
  inputProps: {
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    'aria-invalid': true | undefined;
  };
  value: PhoneNumber | undefined;
  displayValue: string;
  error: PhoneNumberError | null;
  isValid: boolean;
  reset: (value?: string | PhoneNumber) => void;
};
```

## Brand (generic helper)

The `Branded<T, B>` type and its `Brand` companion are the building block for
any custom TypeObject:

```ts
import { Brand, type Branded } from '@evinvest/types';

type Email = Branded<string, 'Email'>;

const Email = {
  from(value: string): Email {
    if (!value.includes('@')) throw new Error('invalid email');
    return Brand.fromRaw<string, 'Email'>(value);
  },
  raw(email: Email): string {
    return Brand.raw(email);
  },
};
```

## Rust counter-part

This is the TypeScript mirror of the `types` Cargo feature of the
[`ev_lib`](https://github.com/EV-invest/lib) Rust crate. The Rust side defines
`PhoneNumber` as a `#[wasm_bindgen]`-compatible newtype with the same validation
semantics and the same E.164 country-code table, so validation is byte-identical
on both sides.
