export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INSUFFICIENT_BALANCE'
  | 'KYC_REQUIRED'
  | 'ROOM_FULL'
  | 'ROOM_NOT_JOINABLE'
  | 'IDEMPOTENCY_MISMATCH'
  | 'INTERNAL_ERROR'
  | 'SETTLEMENT_INVARIANT_VIOLATION'
  | 'CHAIN_ERROR'
  | 'SELF_EXCLUDED';

const statusByCode: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INSUFFICIENT_BALANCE: 400,
  KYC_REQUIRED: 403,
  ROOM_FULL: 409,
  ROOM_NOT_JOINABLE: 409,
  IDEMPOTENCY_MISMATCH: 409,
  INTERNAL_ERROR: 500,
  SETTLEMENT_INVARIANT_VIOLATION: 500,
  CHAIN_ERROR: 502,
  SELF_EXCLUDED: 403,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly publicMessage: string;
  public readonly details?: unknown;

  constructor(code: ErrorCode, publicMessage: string, details?: unknown) {
    super(publicMessage);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = statusByCode[code];
    this.publicMessage = publicMessage;
    this.details = details;
  }
}
