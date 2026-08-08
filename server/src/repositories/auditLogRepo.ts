import { AuditLog } from '../models/AuditLog.js';

export const auditLogRepo = {
  async record(entry: {
    actorUserId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Record<string, unknown>;
    ip?: string | null;
  }) {
    return AuditLog.create({ ...entry, ip: entry.ip ?? null, metadata: entry.metadata ?? {} });
  },
};
