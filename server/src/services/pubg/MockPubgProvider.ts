import { sha256Hex } from '../../utils/crypto.js';
import type { PubgMatchSummary, PubgPlatform, PubgProvider } from './PubgProvider.js';

/**
 * Deterministic fake PUBG data for dev/test. No network calls. The "current
 * display name" always includes whatever verification suffix was requested
 * (in real life the tester would type it into their PUBG client) — tests
 * exercise this by driving the userService flow, which sets the suffix and
 * then calls verify immediately, standing in for the player renaming
 * themselves in-game.
 */
export class MockPubgProvider implements PubgProvider {
  private readonly displayNames = new Map<string, string>();
  private readonly matchesByRoom = new Map<string, PubgMatchSummary>();

  // Test helper: simulate the player having renamed themselves in-game.
  setDisplayName(pubgAccountId: string, name: string) {
    this.displayNames.set(pubgAccountId, name);
  }

  async getCurrentDisplayName(_platform: PubgPlatform, pubgAccountId: string): Promise<string | null> {
    return this.displayNames.get(pubgAccountId) ?? `Player_${pubgAccountId.slice(0, 6)}`;
  }

  // Test helper: pre-seed a match that all given players will see in their recent list.
  seedMatch(matchId: string, summary: PubgMatchSummary) {
    this.matchesByRoom.set(matchId, summary);
  }

  async getRecentMatches(_platform: PubgPlatform, playerIds: string[]): Promise<Map<string, string[]>> {
    const out = new Map<string, string[]>();
    for (const playerId of playerIds) {
      const seeded = [...this.matchesByRoom.values()]
        .filter((m) => m.participants.some((p) => p.pubgPlayerId === playerId))
        .map((m) => m.matchId);
      // Deterministic synthetic match id as a fallback so unseeded lookups are stable across calls.
      const synthetic = `synthetic-${sha256Hex(playerId).slice(0, 12)}`;
      out.set(playerId, [...new Set([...seeded, synthetic])]);
    }
    return out;
  }

  async getMatch(_platform: PubgPlatform, matchId: string): Promise<PubgMatchSummary | null> {
    return this.matchesByRoom.get(matchId) ?? null;
  }
}
