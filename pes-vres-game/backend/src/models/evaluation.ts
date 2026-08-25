export interface EvaluationRequest {
  question: string;
  answer: string;
  /** Optional per-request override of the AI mode; falls back to the server's AI_MODE. */
  mode?: 'mock' | 'real';
}

/**
 * Structured result the AI evaluator (mock or real) must produce.
 * The mobile app never has to parse natural language - it just renders this.
 */
export interface EvaluationResult {
  answer: string;
  correct: boolean;
  confidence: number;
  points: number;
  reason: string;
}
