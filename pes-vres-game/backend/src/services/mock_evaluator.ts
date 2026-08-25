import { AiEvaluator } from './ai_evaluator';
import { EvaluationResult } from '../models/evaluation';

/**
 * Deterministic, no-network evaluator used in AI_MODE=mock (or when a request
 * asks for mode "mock"). It is NOT a semantic judge - it exists purely so the
 * full game flow (recording, scoring, UI) can be tested without spending
 * real AI API credits. It deliberately does not keep any hardcoded list of
 * "correct answers" for specific questions.
 */
export class MockEvaluator implements AiEvaluator {
  async evaluate(question: string, answer: string): Promise<EvaluationResult> {
    const trimmed = answer.trim();
    const normalizedQuestion = normalize(question);
    const normalizedAnswer = normalize(trimmed);

    if (!trimmed) {
      return {
        answer: trimmed,
        correct: false,
        confidence: 1,
        points: 0,
        reason: '[MOCK] Δεν δόθηκε απάντηση.',
      };
    }

    if (normalizedAnswer === normalizedQuestion || normalizedAnswer.length < 2) {
      return {
        answer: trimmed,
        correct: false,
        confidence: 0.95,
        points: 0,
        reason: '[MOCK] Η απάντηση δεν φαίνεται σχετική με την ερώτηση.',
      };
    }

    return {
      answer: trimmed,
      correct: true,
      confidence: 0.9,
      points: 100,
      reason: '[MOCK] Αποδεκτή απάντηση για δοκιμαστικούς σκοπούς (δεν έγινε πραγματική σημασιολογική αξιολόγηση).',
    };
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
