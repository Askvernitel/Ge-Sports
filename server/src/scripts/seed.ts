/**
 * Seeds demo rooms + a few bot players so the app isn't empty on first boot.
 * Idempotent-ish: skips creating a bot user if its email already exists,
 * and only tops up rooms if fewer than SEED_ROOM_COUNT open/live rooms exist.
 *
 * Run with: npm run seed  (from server/)
 */
import mongoose from 'mongoose';
import { connectMongo } from '../config/mongo.js';
import { userRepo } from '../repositories/userRepo.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { kycRepo } from '../repositories/kycRepo.js';
import { roomRepo } from '../repositories/roomRepo.js';
import { roomService } from '../services/roomService.js';
import { walletService } from '../services/walletService.js';
import argon2 from 'argon2';

const BOTS = [
  { email: 'seed.raven@example.com', name: 'Raven' },
  { email: 'seed.harbor@example.com', name: 'Harbor' },
  { email: 'seed.tundra@example.com', name: 'Tundra' },
  { email: 'seed.kite@example.com', name: 'Kite' },
  { email: 'seed.ember@example.com', name: 'Ember' },
  { email: 'seed.silo@example.com', name: 'Silo' },
];

const ROOM_SPECS = [
  { mode: 'squad', map: 'erangel', region: 'EU', entryFee: '50', maxPlayers: 16, minPlayers: 4, payoutStructure: 'top3', joiners: 11 },
  { mode: 'solo', map: 'miramar', region: 'NA', entryFee: '20', maxPlayers: 8, minPlayers: 2, payoutStructure: 'winner_take_all', joiners: 5 },
  { mode: 'duo', map: 'sanhok', region: 'AS', entryFee: '35', maxPlayers: 12, minPlayers: 2, payoutStructure: 'top3', joiners: 8 },
  { mode: 'squad', map: 'vikendi', region: 'EU', entryFee: '80', maxPlayers: 16, minPlayers: 4, payoutStructure: 'placement_points', joiners: 3 },
  { mode: 'solo', map: 'erangel', region: 'SA', entryFee: '15', maxPlayers: 10, minPlayers: 2, payoutStructure: 'winner_take_all', joiners: 6 },
  { mode: 'duo', map: 'miramar', region: 'OCE', entryFee: '40', maxPlayers: 12, minPlayers: 2, payoutStructure: 'top3', joiners: 2 },
  { mode: 'squad', map: 'sanhok', region: 'NA', entryFee: '25', maxPlayers: 16, minPlayers: 4, payoutStructure: 'top3', joiners: 16 },
] as const;

async function ensureBot(email: string, displayName: string) {
  const existing = await userRepo.findByEmail(email);
  if (existing) return String(existing._id);

  const passwordHash = await argon2.hash('seed-password-not-real', { type: argon2.argon2id });
  const session = await mongoose.startSession();
  let userId = '';
  try {
    await session.withTransaction(async () => {
      const user = await userRepo.create(
        { email, passwordHash, displayName, emailVerificationToken: null },
        session,
      );
      user.emailVerifiedAt = new Date();
      await user.save({ session });
      await walletRepo.createForUser(String(user._id), session);
      userId = String(user._id);
    });
  } finally {
    await session.endSession();
  }

  await walletService.devFaucet(userId, '5000');
  // Rooms require 'basic' KYC to join — write an approved record directly
  // rather than going through the session/webhook round trip.
  await kycRepo.create({
    userId,
    provider: 'mock',
    providerRefId: `seed_${userId}`,
    level: 'basic',
    status: 'approved',
  });
  return userId;
}

async function main() {
  await connectMongo();

  const existingRoomCount = await roomRepo.list({}, 1, 1, async () => ({}));
  if (existingRoomCount.total >= ROOM_SPECS.length) {
    console.log(`Already have ${existingRoomCount.total} rooms — skipping seed.`);
    await mongoose.disconnect();
    return;
  }

  console.log('Seeding bot players...');
  const botIds: string[] = [];
  for (const bot of BOTS) {
    botIds.push(await ensureBot(bot.email, bot.name));
  }
  const ownerId = botIds[0];
  if (!ownerId) throw new Error('No bot users were created');

  console.log('Seeding rooms...');
  for (const spec of ROOM_SPECS) {
    const room = await roomService.create(ownerId, {
      mode: spec.mode,
      perspective: 'tpp',
      map: spec.map,
      region: spec.region,
      entryFee: spec.entryFee,
      maxPlayers: spec.maxPlayers,
      minPlayers: spec.minPlayers,
      payoutStructure: spec.payoutStructure,
      scheduledStartAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    });

    const joinerPool = botIds.filter((id) => id !== ownerId);
    const joinCount = Math.min(spec.joiners, joinerPool.length + 1);
    // owner counts as one joiner slot too, so join with owner first if room wants >0
    const joiners = [ownerId, ...joinerPool].slice(0, joinCount);
    for (const uid of joiners) {
      try {
        await roomService.join(uid, String(room._id));
      } catch (err) {
        console.warn(`  join failed for room ${room.code}:`, (err as Error).message);
      }
    }
    console.log(`  created ${room.code} (${spec.map}/${spec.mode}, ${joinCount}/${spec.maxPlayers} filled)`);
  }

  console.log('Done.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
