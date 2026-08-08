import { userRepo } from '../repositories/userRepo.js';
import { AppError } from '../utils/AppError.js';
import { randomToken } from '../utils/crypto.js';
import { pubgProvider } from './pubg/index.js';

export interface LinkPubgInput {
  pubgAccountId: string;
  pubgPlatform: 'steam' | 'kakao' | 'psn' | 'xbox';
  pubgIgn: string;
}

export const userService = {
  async getById(userId: string) {
    const user = await userRepo.findById(userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return user;
  },

  async updateProfile(userId: string, patch: { displayName?: string }) {
    const user = await userRepo.updateById(userId, patch);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    return user;
  },

  /**
   * Step 1 of ownership verification (spec section 5): the user claims a PUBG
   * account/IGN and we hand back a one-time suffix they must append to their
   * in-game name before calling /verify. This avoids trusting a typed-in name
   * outright, and does not require a live PUBG API key to implement — the
   * real API lookup plugs into `verifyPubgAccount` below.
   */
  async linkPubgAccount(userId: string, input: LinkPubgInput) {
    const existingOwner = await userRepo.findByPubgAccount(input.pubgAccountId, input.pubgPlatform);
    if (existingOwner && String(existingOwner._id) !== userId) {
      throw new AppError('CONFLICT', 'That PUBG account is already linked to another user');
    }

    const suffix = randomToken(3).toUpperCase(); // short, goes in the in-game name
    await userRepo.updateById(userId, {
      pubgAccountId: input.pubgAccountId,
      pubgPlatform: input.pubgPlatform,
      pubgIgn: input.pubgIgn,
      pubgLinkedAt: new Date(),
      pubgLinkVerificationToken: suffix,
      pubgLinkVerifiedAt: null,
    });
    return { verificationSuffix: suffix, instructions: `Append #${suffix} to your PUBG in-game name, then call verify.` };
  },

  /**
   * Step 2: confirm the suffix is actually present on the account's current
   * PUBG name via the provider. Real HttpPubgProvider would call
   * GET /shards/{platform}/players?filter[playerNames]=... here; the mock
   * provider simulates it deterministically for dev/test.
   */
  async verifyPubgAccount(userId: string) {
    const user = await userRepo.findByIdWithVerificationToken(userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    if (!user.pubgAccountId || !user.pubgPlatform || !user.pubgLinkVerificationToken) {
      throw new AppError('VALIDATION_ERROR', 'No pending PUBG account link to verify');
    }

    const currentName = await pubgProvider.getCurrentDisplayName(user.pubgPlatform, user.pubgAccountId);
    const expectedSuffix = `#${user.pubgLinkVerificationToken}`;
    if (!currentName || !currentName.includes(expectedSuffix)) {
      throw new AppError('VALIDATION_ERROR', `PUBG display name does not contain verification suffix ${expectedSuffix} yet`);
    }

    return userRepo.updateById(userId, { pubgLinkVerifiedAt: new Date(), pubgLinkVerificationToken: null });
  },

  async selfExclude(userId: string, untilDate: Date | null) {
    await userRepo.updateById(userId, {
      status: 'self_excluded',
      selfExcludedUntil: untilDate,
    });
  },
};
