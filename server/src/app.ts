import express, { type Express, type Request } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { rootRouter } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => (req as unknown as { requestId?: string }).requestId ?? '',
      autoLogging: { ignore: (req: Request) => req.url === '/health' },
    }),
  );

  app.use('/', rootRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
