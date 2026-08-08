export interface KycSession {
  providerRefId: string;
  sessionToken: string;
  redirectUrl?: string;
}

export type KycDecision = 'approved' | 'rejected';

/**
 * Clean seam for a real KYC/AML vendor (Persona, Onfido, Sumsub, etc). Only
 * MockKycProvider is implemented here since no vendor credentials exist in
 * this environment. A real implementation would create a hosted verification
 * session, receive a signed webhook, and never let raw documents touch Mongo.
 */
export interface KycProvider {
  createSession(userId: string, opts?: { forceDecision?: KycDecision }): Promise<KycSession>;
  handleWebhook(payload: unknown): Promise<{ providerRefId: string; decision: KycDecision; reason?: string }>;
}
