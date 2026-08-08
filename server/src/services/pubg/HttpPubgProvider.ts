import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { PubgMatchSummary, PubgPlatform, PubgProvider } from './PubgProvider.js';

interface JsonApiResource {
  type: string;
  id: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | { id: string; type: string }[] }>;
}

interface JsonApiDoc {
  data: JsonApiResource | JsonApiResource[];
  included?: JsonApiResource[];
}

/** Real PUBG API client. Used only when PUBG_API_KEY is configured (see services/pubg/index.ts). */
export class HttpPubgProvider implements PubgProvider {
  private async request(path: string): Promise<JsonApiDoc> {
    const url = `${env.PUBG_API_BASE_URL}${path}`;
    let attempt = 0;
    for (;;) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${env.PUBG_API_KEY}`,
          Accept: 'application/vnd.api+json',
        },
      });
      if (res.status === 429) {
        attempt += 1;
        const backoffMs = Math.min(2 ** attempt * 500, 15000);
        logger.warn({ url, attempt, backoffMs }, 'PUBG API rate limited, backing off');
        await new Promise((r) => setTimeout(r, backoffMs));
        if (attempt < 5) continue;
      }
      if (!res.ok) {
        throw new Error(`PUBG API request failed: ${res.status} ${res.statusText} (${path})`);
      }
      return (await res.json()) as JsonApiDoc;
    }
  }

  async getCurrentDisplayName(platform: PubgPlatform, pubgAccountId: string): Promise<string | null> {
    const doc = await this.request(`/shards/${platform}/players/${pubgAccountId}`);
    const resource = Array.isArray(doc.data) ? doc.data[0] : doc.data;
    const name = resource?.attributes?.name;
    return typeof name === 'string' ? name : null;
  }

  async getRecentMatches(platform: PubgPlatform, playerIds: string[]): Promise<Map<string, string[]>> {
    const filter = encodeURIComponent(playerIds.join(','));
    const doc = await this.request(`/shards/${platform}/players?filter[playerIds]=${filter}`);
    const resources = Array.isArray(doc.data) ? doc.data : [doc.data];
    const out = new Map<string, string[]>();
    for (const resource of resources) {
      const matches = resource.relationships?.matches?.data;
      const ids = (Array.isArray(matches) ? matches : matches ? [matches] : []).map((m) => m.id);
      out.set(resource.id, ids);
    }
    return out;
  }

  async getMatch(platform: PubgPlatform, matchId: string): Promise<PubgMatchSummary | null> {
    const doc = await this.request(`/shards/${platform}/matches/${matchId}`);
    const included = doc.included ?? [];
    const participants = included.filter((r) => r.type === 'participant');
    const createdAt = !Array.isArray(doc.data) ? (doc.data.attributes?.createdAt as string | undefined) : undefined;

    return {
      matchId,
      createdAt: createdAt ?? new Date().toISOString(),
      participants: participants.map((p) => {
        const stats = (p.attributes?.stats ?? {}) as Record<string, unknown>;
        return {
          pubgPlayerId: (stats.playerId as string) ?? p.id,
          placement: Number(stats.winPlace ?? 0),
          kills: Number(stats.kills ?? 0),
          damage: Number(stats.damageDealt ?? 0),
          timeSurvived: Number(stats.timeSurvived ?? 0),
        };
      }),
    };
  }
}
