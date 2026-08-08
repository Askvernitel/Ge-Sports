export type PubgPlatform = 'steam' | 'kakao' | 'psn' | 'xbox';

export interface PubgMatchParticipantStats {
  pubgPlayerId: string;
  placement: number;
  kills: number;
  damage: number;
  timeSurvived: number;
}

export interface PubgMatchSummary {
  matchId: string;
  createdAt: string; // ISO
  participants: PubgMatchParticipantStats[];
}

/**
 * Clean seam between our match-verification logic and PUBG's API. Swap
 * MockPubgProvider for HttpPubgProvider by setting PUBG_API_KEY (see
 * services/pubg/index.ts) without touching any calling code.
 */
export interface PubgProvider {
  /** Current in-game display name, used for the display-name-suffix ownership check. */
  getCurrentDisplayName(platform: PubgPlatform, pubgAccountId: string): Promise<string | null>;

  /** Recent match IDs for a set of players (GET /shards/{platform}/players?filter[playerIds]=...). */
  getRecentMatches(platform: PubgPlatform, playerIds: string[]): Promise<Map<string, string[]>>;

  /** Full match detail (GET /shards/{platform}/matches/{id}). */
  getMatch(platform: PubgPlatform, matchId: string): Promise<PubgMatchSummary | null>;
}
