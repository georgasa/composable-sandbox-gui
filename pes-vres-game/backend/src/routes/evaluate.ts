import { Router } from 'express';
import { getEvaluator } from '../services/evaluator_factory';
import { EvaluatorConfigError } from '../services/ai_evaluator';
import { AiMode } from '../config/env';

export const evaluateRouter = Router();

function parseModeOverride(value: unknown): AiMode | undefined {
  if (value === 'mock' || value === 'real') return value;
  return undefined;
}

evaluateRouter.post('/evaluate', async (req, res) => {
  const body = req.body ?? {};
  const { question, answer } = body as { question?: unknown; answer?: unknown };

  if (typeof question !== 'string' || !question.trim()) {
    res.status(400).json({ error: 'Το πεδίο "question" είναι υποχρεωτικό.' });
    return;
  }
  if (typeof answer !== 'string') {
    res.status(400).json({ error: 'Το πεδίο "answer" είναι υποχρεωτικό.' });
    return;
  }

  const trimmedQuestion = question.trim();
  const trimmedAnswer = answer.trim();

  // Empty / noise answers are handled without ever calling the AI.
  if (!trimmedAnswer) {
    res.json({
      answer: '',
      correct: false,
      confidence: 1,
      points: 0,
      reason: 'Δεν δόθηκε απάντηση.',
    });
    return;
  }

  const modeOverride = parseModeOverride((body as { mode?: unknown }).mode);

  try {
    const evaluator = getEvaluator(modeOverride);
    const result = await evaluator.evaluate(trimmedQuestion, trimmedAnswer);
    res.json(result);
  } catch (err) {
    if (err instanceof EvaluatorConfigError) {
      console.warn('Evaluator config error:', err.message);
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Evaluation failed:', err);
    res.status(503).json({
      error: 'Δεν κατάφερα να αξιολογήσω την απάντηση. Ξαναπροσπάθησε.',
    });
  }
});
