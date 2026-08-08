import { randomUUID } from 'node:crypto';
import { env } from '../../config/env.js';
import type { KycDecision, KycProvider, KycSession } from './KycProvider.js';

/**
 * Auto-approves (or auto-rejects, if `forceDecision` is passed - handy for
 * tests) after being "reviewed". No network calls, no PII persisted beyond
 * a provider reference id.
 */
export class MockKycProvider implements KycProvider {
  private readonly pendingDecisions = new Map<string, KycDecision>();

  async createSession(_userId: string, opts?: { forceDecision?: KycDecision }): Promise<KycSession> {
    const providerRefId = `mock_kyc_${randomUUID()}`;
    const decision = opts?.forceDecision ?? (env.KYC_MOCK_AUTO_APPROVE ? 'approved' : 'rejected');
    this.pendingDecisions.set(providerRefId, decision);
    return { providerRefId, sessionToken: randomUUID(), redirectUrl: `mock://kyc/${providerRefId}` };
  }

  async handleWebhook(payload: unknown): Promise<{ providerRefId: string; decision: KycDecision; reason?: string }> {
    const body = payload as { providerRefId?: string; decision?: KycDecision };
    if (!body.providerRefId) throw new Error('Missing providerRefId in webhook payload');
    const decision = body.decision ?? this.pendingDecisions.get(body.providerRefId) ?? 'approved';
    return { providerRefId: body.providerRefId, decision, reason: decision === 'rejected' ? 'mock_rejection' : undefined };
  }
}
