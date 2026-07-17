/**
 * Aggregate settings failure — every missing/invalid variable found in one
 * pass, mirroring `SettingsError` of the Rust `settings` feature. The message
 * format is kept in step with the Rust `Display` impl:
 *
 * ```text
 * invalid settings (2 problems)
 *   - DATABASE_URL: missing
 *   - PORT: invalid value "abc": expected an integer
 * ```
 */

/** What went wrong with one variable. */
export type SettingsIssueKind = 'missing' | 'invalid';

/** One problem with one variable. */
export interface SettingsIssue {
  /** The env var name as it was looked up. */
  readonly key: string;
  readonly kind: SettingsIssueKind;
  /** For `invalid` issues: what went wrong while parsing. */
  readonly detail?: string;
  /** The offending raw value. Omitted for `secret(...)` settings. */
  readonly value?: string;
}

/**
 * Thrown by {@link createSettings} when any variable is missing or invalid.
 * Carries every problem at once — fix the whole list in one edit instead of
 * replaying the boot loop per variable.
 */
export class SettingsError extends Error {
  readonly issues: readonly SettingsIssue[];

  constructor(issues: readonly SettingsIssue[]) {
    super(formatIssues(issues));
    this.name = 'SettingsError';
    this.issues = issues;
  }
}

function formatIssues(issues: readonly SettingsIssue[]): string {
  const noun = issues.length === 1 ? 'problem' : 'problems';
  const lines = issues.map((issue) => `  - ${formatIssue(issue)}`);
  return [`invalid settings (${issues.length} ${noun})`, ...lines].join('\n');
}

function formatIssue(issue: SettingsIssue): string {
  if (issue.kind === 'missing') return `${issue.key}: missing`;
  // JSON.stringify quotes/escapes like Rust's `{:?}` for printable values
  // (control characters escape differently — cosmetic, not part of the contract).
  const value = issue.value === undefined ? '' : ` ${JSON.stringify(issue.value)}`;
  return `${issue.key}: invalid value${value}: ${issue.detail ?? 'failed to parse'}`;
}
