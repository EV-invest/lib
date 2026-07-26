/**
 * `@evinvest/types` — shared domain types with validation.
 *
 * Zero runtime deps for the core; the optional `./react` subpath ships
 * input-binding hooks for React.
 *
 * @example
 * ```ts
 * import { PhoneNumber } from '@evinvest/types';
 *
 * const pn = PhoneNumber.from('+12345678901');
 * PhoneNumber.format(pn); // '+1 234 567 8901'
 * ```
 *
 * @example
 * ```ts
 * import { Email } from '@evinvest/types';
 *
 * const e = Email.from('User@Example.com');
 * Email.raw(e); // 'user@example.com'
 * ```
 */

export { Brand } from './brand';
export type { Branded } from './brand';

// PhoneNumber is both a type (Branded<string, 'PhoneNumber'>) and a value
// (the companion const). The single value export covers both — TypeScript
// disambiguates by context. The other names are type-only.
export { PhoneNumber, validatePhoneNumber } from './phone-number';
export type { PhoneNumberError, PhoneNumberOk, PhoneNumberValidation } from './phone-number';

// Email — same pattern: a single export name serves as both the branded type
// and the companion const.
export { Email, validateEmail } from './email';
export type { EmailError, EmailOk, EmailValidation } from './email';
