import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { randomToken } from '../utils/crypto.js';
import { userRepo } from '../repositories/userRepo.js';
import { walletRepo } from '../repositories/walletRepo.js';
import { emailService } from './emailService.js';
import type { AccessTokenPayload, RefreshTokenPayload } from '../types/auth.js';

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
  ip?: string | null;
}

function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'] });
}

function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${env.JWT_REFRESH_TTL_DAYS}d` });
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await userRepo.findByEmail(input.email);
    if (existing) throw new AppError('CONFLICT', 'An account with that email already exists');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    const emailVerificationToken = randomToken();

    const session = await mongoose.startSession();
    let userId: string;
    try {
      await session.withTransaction(async () => {
        const user = await userRepo.create(
          {
            email: input.email.toLowerCase(),
            passwordHash,
            displayName: input.displayName,
            emailVerificationToken,
          },
          session,
        );
        await walletRepo.createForUser(String(user._id), session);
        userId = String(user._id);
      });
    } finally {
      await session.endSession();
    }

    await emailService.sendVerificationEmail(input.email, emailVerificationToken);
    return { userId: userId! };
  },

  async verifyEmail(userId: string, token: string) {
    const user = await userRepo.findByIdWithVerificationToken(userId);
    if (!user) throw new AppError('NOT_FOUND', 'User not found');
    if (user.emailVerifiedAt) return; // already verified, idempotent
    if (!user.emailVerificationToken || user.emailVerificationToken !== token) {
      throw new AppError('VALIDATION_ERROR', 'Invalid or expired verification token');
    }
    await userRepo.updateById(userId, { emailVerifiedAt: new Date(), emailVerificationToken: null });
  },

  async login(input: LoginInput) {
    const user = await userRepo.findByEmail(input.email, { withPasswordHash: true });
    if (!user) throw new AppError('UNAUTHORIZED', 'Invalid email or password');
    if (user.status !== 'active') throw new AppError('FORBIDDEN', `Account is ${user.status}`);

    const ok = await argon2.verify(user.passwordHash, input.password);
    if (!ok) throw new AppError('UNAUTHORIZED', 'Invalid email or password');

    const family = randomUUID();
    await userRepo.setRefreshTokenVersion(String(user._id), family, 0);
    await userRepo.updateById(String(user._id), { lastLoginAt: new Date(), lastLoginIp: input.ip ?? null });

    const accessToken = signAccessToken({ sub: String(user._id), role: user.role as never, email: user.email });
    const refreshToken = signRefreshToken({ sub: String(user._id), family, version: 0 });
    return { accessToken, refreshToken, user };
  },

  async refresh(refreshToken: string) {
    let payload: RefreshTokenPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Invalid refresh token');
    }
    // refreshTokenFamily/refreshTokenVersion are `select: false` on the User
    // schema (not returned by a plain findById), so a dedicated lookup is
    // required here — otherwise both fields come back `undefined` and never
    // match payload.family/version, making every refresh look like reuse of
    // a rotated-out token and revoking the family on the very first call.
    const user = await userRepo.findByIdWithRefreshTokenFields(payload.sub);
    if (!user) throw new AppError('UNAUTHORIZED', 'Invalid refresh token');
    if (user.refreshTokenFamily !== payload.family || user.refreshTokenVersion !== payload.version) {
      // Reuse of a rotated-out token: revoke the whole family defensively.
      await userRepo.setRefreshTokenVersion(String(user._id), '', -1);
      throw new AppError('UNAUTHORIZED', 'Refresh token has been rotated or revoked');
    }

    const nextVersion = payload.version + 1;
    await userRepo.setRefreshTokenVersion(String(user._id), payload.family, nextVersion);

    const accessToken = signAccessToken({ sub: String(user._id), role: user.role as never, email: user.email });
    const newRefreshToken = signRefreshToken({ sub: String(user._id), family: payload.family, version: nextVersion });
    return { accessToken, refreshToken: newRefreshToken, user };
  },

  async logout(userId: string) {
    await userRepo.setRefreshTokenVersion(userId, '', -1);
  },

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
    } catch {
      throw new AppError('UNAUTHORIZED', 'Invalid or expired access token');
    }
  },
};
