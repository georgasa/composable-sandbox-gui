import express from 'express';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { questionsRouter } from './routes/questions';
import { evaluateRouter } from './routes/evaluate';
import { errorHandler } from './middleware/error_handler';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api', healthRouter);
  app.use('/api', questionsRouter);
  app.use('/api', evaluateRouter);

  app.use(errorHandler);

  return app;
}
