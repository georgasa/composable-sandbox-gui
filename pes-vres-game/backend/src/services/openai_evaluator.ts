import { AiEvaluator } from './ai_evaluator';
import { EvaluationResult } from '../models/evaluation';
import { computePoints } from './scoring';
import { env } from '../config/env';

const SYSTEM_PROMPT = `Είσαι κριτής σε ένα ελληνικό παιχνίδι γνώσεων φωνής με το όνομα "Πες Βρες".
Ο παίκτης ακούει μια κατηγορία/ερώτηση και λέει φωναχτά μία λέξη ή σύντομη φράση.
Ο ρόλος σου είναι να αποφασίσεις αν η απάντηση ανήκει λογικά/σημασιολογικά στην κατηγορία της ερώτησης,
ΟΧΙ να συγκρίνεις με μια συγκεκριμένη προκαθορισμένη λίστα σωστών απαντήσεων.

Κανόνες:
- Αγνόησε άρθρα, γεμίσματα ομιλίας και αβεβαιότητα (π.χ. "η Κρήτη", "μάλλον παπαγάλος", "εε... σκύλος").
- Δέξου ορθογραφικές παραλλαγές, πληθυντικό/ενικό, και συνώνυμα.
- Αν η απάντηση είναι κενή, άσχετη, ή δεν ανήκει στην κατηγορία, χαρακτήρισέ την λανθασμένη.
- confidence είναι πόσο σίγουρος είσαι για την ΑΠΟΦΑΣΗ σου (0 έως 1), όχι πόσο "καλή" είναι η απάντηση.
- reason: μία σύντομη πρόταση στα ελληνικά που εξηγεί την απόφαση.

Απάντησε ΑΠΟΚΛΕΙΣΤΙΚΑ με ένα JSON αντικείμενο ακριβώς σε αυτή τη μορφή, χωρίς κανένα άλλο κείμενο:
{"correct": boolean, "confidence": number, "reason": string}`;

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenAiEvaluator implements AiEvaluator {
  async evaluate(question: string, answer: string): Promise<EvaluationResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.openaiTimeoutMs);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: env.openaiModel,
          temperature: 0,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({ question, answer }),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`OpenAI API error ${response.status}: ${body.slice(0, 300)}`);
      }

      const data = (await response.json()) as OpenAiChatResponse;
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed: unknown = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('AI response was not a JSON object');
      }

      const record = parsed as Record<string, unknown>;
      const correct = Boolean(record.correct);
      const confidence = clamp(toNumber(record.confidence), 0, 1);
      const reason = typeof record.reason === 'string' ? record.reason : '';

      return {
        answer,
        correct,
        confidence,
        points: computePoints(correct, confidence),
        reason,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
