import heroTerrain from '@/assets/maps/hero-terrain.png';
import lobbyTerrain from '@/assets/maps/lobby-terrain.png';
import legendTerrain from '@/assets/maps/legend-terrain.jpg';
import authHero from '@/assets/maps/auth-hero.jpg';
import mapErangel from '@/assets/maps/map-erangel.jpg';
import mapMiramar from '@/assets/maps/map-miramar.jpg';
import mapSanhok from '@/assets/maps/map-sanhok.jpg';
import mapVikendi from '@/assets/maps/map-vikendi.jpg';
import type { RoomMap } from './types';

export const heroTerrainSrc = heroTerrain;
export const lobbyTerrainSrc = lobbyTerrain;
// Real photo (Unsplash License, free for commercial use — aerial farmland
// sector patterns by Bernd Dittrich, https://unsplash.com/photos/ZqikUPAU68c)
// for the Rooms page legend rail's "EU sector" map thumbnail.
export const legendTerrainSrc = legendTerrain;
// Real photo (Unsplash License, free for commercial use — three parachutists
// descending over farmland by Kamil Pietrzak,
// https://unsplash.com/photos/AlA8S9tALAs) for the sign-in/sign-up side panel.
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
