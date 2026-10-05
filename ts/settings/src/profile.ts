/**
 * The deployment profile — what {@link requiredIn} compares against, mirroring
 * `ev_lib::settings::PROFILE_VAR` / `DEFAULT_PROFILE`.
 */

import { DEFAULT_PROFILE, PROFILE_VAR } from './generated/contract';

export { DEFAULT_PROFILE, PROFILE_VAR } from './generated/contract';

/**
 * Resolve the active profile from an explicit override, else the environment
 * record, else {@link DEFAULT_PROFILE}. The empty string counts as unset, like
 * every other variable.
 *
 * The override exists because Next.js deployments name their environment
 * `NODE_ENV`, which the framework owns: `profile: process.env.NODE_ENV` keeps
 * one source of truth instead of a second, drifting `APP_ENV`.
 */
export function activeProfile(
  runtimeEnv: Readonly<Record<string, string | undefined>>,
  override?: string,
): { readonly profile: string; readonly fromVar: boolean } {
  const overridden = override !== undefined && override !== '';
  const raw = overridden ? override : runtimeEnv[PROFILE_VAR];
  return {
    profile: raw === undefined || raw === '' ? DEFAULT_PROFILE : raw,
    // Whether an error may point at PROFILE_VAR: with an override in play,
    // naming APP_ENV would send whoever reads it to the wrong variable.
    fromVar: !overridden,
  };
}
