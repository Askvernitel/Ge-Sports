import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { timingSafeEqualStr } from '../utils/crypto.js';
import { kycRepo } from '../repositories/kycRepo.js';
import { kycProvider } from './kyc/index.js';
import type { KycDecision } from './kyc/KycProvider.js';

export const kycService = {
  async createSession(userId: string, forceDecision?: KycDecision) {
    const session = await kycProvider.createSession(userId, forceDecision ? { forceDecision } : undefined);
    await kycRepo.create({
      userId,
      provider: 'mock',
      providerRefId: session.providerRefId,
      level: 'basic',
      status: 'pending',
    });
    return session;
  },

  async getStatus(userId: string) {
    const record = await kycRepo.findLatestForUser(userId);
    if (!record) return { level: 'none', status: 'not_started' };
    return { level: record.level, status: record.status, rejectionReason: record.rejectionReason };
  },

  async handleWebhook(sharedSecretHeader: string | undefined, payload: unknown) {
    if (!sharedSecretHeader || !timingSafeEqualStr(sharedSecretHeader, env.KYC_SHARED_SECRET)) {
      throw new AppError('UNAUTHORIZED', 'Invalid webhook signature');
    }
    const result = await kycProvider.handleWebhook(payload);
    const record = await kycRepo.findByProviderRef(result.providerRefId);
    if (!record) throw new AppError('NOT_FOUND', 'No KYC record for this provider reference');

    await kycRepo.updateById(String(record._id), {
      status: result.decision,
      level: result.decision === 'approved' ? 'full' : record.level,
      rejectionReason: result.decision === 'rejected' ? result.reason : null,
      reviewedAt: new Date(),
      sanctionsChecked: true,
    });
    return { ok: true };
  },
};
