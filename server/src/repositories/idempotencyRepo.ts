import { IdempotencyRecord } from '../models/IdempotencyRecord.js';

export const idempotencyRepo = {
  async find(key: string, method: string, path: string) {
    return IdempotencyRecord.findOne({ key, method, path }).exec();
  },
  async save(entry: {
    key: string;
    userId?: string | null;
    method: string;
    path: string;
    requestHash: string;
    responseStatus: number;
    responseBody: unknown;
    ttlMs: number;
  }) {
    try {
      return await IdempotencyRecord.create({
        key: entry.key,
        userId: entry.userId ?? null,
        method: entry.method,
        path: entry.path,
        requestHash: entry.requestHash,
        responseStatus: entry.responseStatus,
        responseBody: entry.responseBody,
        expiresAt: new Date(Date.now() + entry.ttlMs),
      });
    } catch (err) {
      // Duplicate key race - another concurrent request already saved it. Fine.
      if ((err as { code?: number }).code === 11000) return null;
      throw err;
    }
  },
};
