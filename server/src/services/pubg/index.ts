import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpPubgProvider } from './HttpPubgProvider.js';
import { MockPubgProvider } from './MockPubgProvider.js';
import type { PubgProvider } from './PubgProvider.js';

// Toggle between the mock and real PUBG API purely by presence of
// PUBG_API_KEY in env — no code change needed to switch it on later.
const usingMock = !env.PUBG_API_KEY;
if (usingMock) {
  logger.info('PUBG_API_KEY not set - using MockPubgProvider (deterministic fake match data). Set PUBG_API_KEY in server/.env to switch to the real API.');
}

export const pubgProvider: PubgProvider = usingMock ? new MockPubgProvider() : new HttpPubgProvider();
export * from './PubgProvider.js';
