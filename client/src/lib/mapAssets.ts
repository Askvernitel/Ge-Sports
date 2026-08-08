import heroField from '@/assets/maps/hero-field.jpg';
import legendTerrain from '@/assets/maps/legend-terrain.jpg';
// LOCAL-ONLY, not committed to git (see .gitignore) — this is an actual
// PUBG in-game Miramar (desert) render, used here purely for local
// development per explicit instruction that this build stays on localhost
// and is never hosted/distributed. Do not reference this file if the app is
// ever deployed publicly — swap back to a licensed/original image first.
import authHero from '@/assets/maps/auth-hero-local.avif';
import mapErangel from '@/assets/maps/map-erangel.jpg';
import mapMiramar from '@/assets/maps/map-miramar.jpg';
import mapSanhok from '@/assets/maps/map-sanhok.jpg';
import mapVikendi from '@/assets/maps/map-vikendi.jpg';
import type { RoomMap } from './types';

// Real photo (Unsplash License, free for commercial use — a lone stone ruin
// on a hilltop grain field under a stormy sky, Valensole, France, by Elliot
// Gouy, https://unsplash.com/photos/an-old-abandoned-building-in-a-field-of-grass--P7yLbwxMj8)
// for the Home hero — ground-level ruin + open field + dramatic sky reads
// close to Erangel's own look. The existing left-to-right dark scrim (see
// HomePage.tsx) keeps the text side readable while leaving the field visible
// on the right.
export const heroTerrainSrc = heroField;
// Real photo (Unsplash License, free for commercial use — aerial farmland
// sector patterns by Bernd Dittrich, https://unsplash.com/photos/ZqikUPAU68c)
// for the Rooms page legend rail's "EU sector" map thumbnail.
export const legendTerrainSrc = legendTerrain;
// Sign-in/sign-up side panel — see the import comment above for the
// local-only caveat.
export const authHeroSrc = authHero;

export const mapImages: Record<Exclude<RoomMap, 'any'>, string> = {
  erangel: mapErangel,
  miramar: mapMiramar,
  sanhok: mapSanhok,
  vikendi: mapVikendi,
};

export function mapImageFor(map: RoomMap): string {
  if (map === 'any') return mapErangel;
  return mapImages[map];
}
