import { logger } from '../config/logger.js';

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
}

/**
 * STUB: logs instead of sending. Swap for a real provider (SES/Postmark/etc)
 * by implementing EmailService and wiring it in services/index or a DI
 * container. No env var currently selects a real provider because none is
 * configured in this environment.
 */
class ConsoleEmailService implements EmailService {
  async sendVerificationEmail(to: string, token: string): Promise<void> {
    logger.info({ to }, `[stub email] Verification token (would be emailed): ${token}`);
  }
  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    logger.info({ to }, `[stub email] Password reset token (would be emailed): ${token}`);
  }
}

export const emailService: EmailService = new ConsoleEmailService();
