import { EvaluationResult } from '../models/evaluation';

export interface AiEvaluator {
  evaluate(question: string, answer: string): Promise<EvaluationResult>;
}

/** Thrown when the requested mode cannot be served (e.g. real mode without an API key). */
export class EvaluatorConfigError extends Error {}
