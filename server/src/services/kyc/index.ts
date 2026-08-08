import { MockKycProvider } from './MockKycProvider.js';
import type { KycProvider } from './KycProvider.js';

// No real KYC vendor is configured in this environment; always mock. A real
// integration would branch on an env var here, same pattern as services/pubg.
export const kycProvider: KycProvider = new MockKycProvider();
export * from './KycProvider.js';
