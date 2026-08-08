import { http } from '@/lib/http';
import type { KycRecord } from '@/lib/types';

// Wired to POST /kyc/session, GET /kyc/status, POST /kyc/webhook.
// server/README.md: KYC vendor is stubbed with MockKycProvider, which
// auto-approves once a session is "reviewed" — but the review step only
// actually flips KycRecord.status when the webhook fires (real vendors call
// this from their own servers; here we call it directly from the client to
// simulate that callback, same as the backend agent's own smoke test did).
// The webhook checks a constant-time shared-secret header instead of a JWT
// since it's designed for an external caller — dev-only value, matches
// server/.env.example's KYC_SHARED_SECRET default.
const KYC_SHARED_SECRET = import.meta.env.VITE_KYC_SHARED_SECRET ?? 'dev-kyc-webhook-secret';

export async function fetchKycStatus(): Promise<KycRecord> {
  const status = await http.get<{ level: KycRecord['level']; status: KycRecord['status']; rejectionReason?: string | null }>(
    '/kyc/status',
  );
  return {
    level: status.level,
    status: status.status,
    countryCode: null,
    documentType: null,
    rejectionReason: status.rejectionReason ?? null,
  };
}

export async function submitKycStep(_patch: Partial<KycRecord>): Promise<KycRecord> {
  const { session } = await http.post<{ session: { providerRefId: string } }>('/kyc/session', {
    forceDecision: 'approved',
  });

  await fetch(`${(import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:4000'}/kyc/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Kyc-Signature': KYC_SHARED_SECRET },
    body: JSON.stringify({ providerRefId: session.providerRefId, decision: 'approved' }),
  });

  return fetchKycStatus();
}
