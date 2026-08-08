import { Worker, type Job } from 'bullmq';
import { bullConnectionOptions } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { QUEUE_NAMES } from './queues.js';
import { verifyRoomMatch } from '../services/matchService.js';
import { getSettlementQueue } from './queues.js';
import { roomRepo } from '../repositories/roomRepo.js';

interface MatchVerificationJobData {
  roomId: string;
}

async function process(job: Job<MatchVerificationJobData>) {
  const { roomId } = job.data;
  await verifyRoomMatch(roomId);

  const room = await roomRepo.findById(roomId);
  if (room?.status === 'settling') {
    await getSettlementQueue().add('settle-room', { roomId }, { jobId: `settle-${roomId}`, attempts: 3 });
  }
}

export function startMatchVerificationWorker(): Worker {
  const worker = new Worker<MatchVerificationJobData>(QUEUE_NAMES.matchVerification, process, {
    ...bullConnectionOptions(),
    concurrency: 2,
  });
  worker.on('failed', (job, err) => logger.error({ jobId: job?.id, err: err.message }, 'Match verification job failed'));
  return worker;
}
