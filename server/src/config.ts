/**
 * Server-wide runtime configuration.
 *
 * Set GAME_ENV=staging to enable fast-forward mode (all timers ÷ 10).
 * This is purely server-side — the constant never ships to the browser.
 */

export const IS_STAGING = process.env.GAME_ENV === 'staging';

/**
 * Divide all player-facing timers by this value.
 *
 * staging  → 10  (adventures ~30s, construction ~minutes, energy regen ~36s/pt)
 * default  →  1  (production timings)
 */
export const TIMER_DIVISOR: number = IS_STAGING ? 10 : 1;

/** Scale a duration (in seconds) for the current environment. */
export function scaleDuration(seconds: number): number {
  return Math.max(1, Math.round(seconds / TIMER_DIVISOR));
}

// ─── JWT ─────────────────────────────────────────────────────────────────────
// Hard-fail at startup if JWT_SECRET is not set — never fall back to a default.
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
export const JWT_SECRET    = process.env.JWT_SECRET as string;
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? '7d';

