import { ApiError } from '@/lib/http';

/**
 * Maps backend AppError codes (see server/src/utils/AppError.ts) to
 * player-facing copy that matches the design spec's copy voice: flat,
 * specific, tells the player what to do next. Never render `error.message`
 * (the raw backend string) directly in the UI.
 */
const CODE_COPY: Record<string, string> = {
  UNAUTHORIZED: 'Sign in to join this room.',
  KYC_REQUIRED: 'Complete ID verification to join a room.',
  SELF_EXCLUDED: 'Self-exclusion is active on this account. Room entry is blocked until it ends.',
  FORBIDDEN: "You don't have permission to do that.",
  INSUFFICIENT_BALANCE: "You don't have enough available balance for this entry fee. Deposit more to join.",
  ROOM_FULL: 'This room is full.',
  ROOM_NOT_JOINABLE: 'This room is no longer open.',
  CONFLICT: "You've already joined this room.",
  NOT_FOUND: 'This room could not be found.',
  RATE_LIMITED: 'Too many attempts — wait a moment and try again.',
  VALIDATION_ERROR: 'That request was invalid. Check the details and try again.',
};

const FALLBACK = 'Something went wrong. Try again.';

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code && CODE_COPY[error.code]) return CODE_COPY[error.code];
    // Unmapped codes/status still shouldn't leak raw backend text.
    if (error.status === 401) return CODE_COPY.UNAUTHORIZED!;
    if (error.status === 403) return CODE_COPY.FORBIDDEN!;
    if (error.status === 404) return CODE_COPY.NOT_FOUND!;
    return FALLBACK;
  }
  return FALLBACK;
}
