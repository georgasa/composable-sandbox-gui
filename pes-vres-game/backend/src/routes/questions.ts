import { Router } from 'express';
import { QUESTIONS } from '../services/questions_data';

export const questionsRouter = Router();

questionsRouter.get('/questions', (_req, res) => {
  res.json({ questions: QUESTIONS });
});
