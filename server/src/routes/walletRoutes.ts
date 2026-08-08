import { Router } from 'express';
import {
  walletController,
  linkWalletSchema,
  claimDepositSchema,
  requestWithdrawalSchema,
} from '../controllers/walletController.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireAuth } from '../middleware/auth.js';
import { idempotency } from '../middleware/idempotency.js';
import { kycGate } from '../middleware/kycGate.js';

export const walletRoutes = Router();

walletRoutes.use(requireAuth);

walletRoutes.post('/link', idempotency(), validateBody(linkWalletSchema), asyncHandler(walletController.link));
walletRoutes.get('/', asyncHandler(walletController.getWallet));
walletRoutes.get('/ledger', asyncHandler(walletController.getLedger));
walletRoutes.post('/deposits/claim', idempotency(), validateBody(claimDepositSchema), asyncHandler(walletController.claimDeposit));
walletRoutes.post(
  '/withdrawals',
  idempotency(),
  kycGate('full'),
  validateBody(requestWithdrawalSchema),
  asyncHandler(walletController.requestWithdrawal),
);
walletRoutes.get('/withdrawals/:id', asyncHandler(walletController.getWithdrawal));
walletRoutes.get('/deposit-info', asyncHandler(walletController.getDepositInfo));
