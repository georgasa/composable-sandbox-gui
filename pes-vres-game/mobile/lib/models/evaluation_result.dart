/// Structured result returned by the backend's AI evaluator. The app never
/// has to interpret free text - it just renders these fields.
class EvaluationResult {
  final String answer;
  final bool correct;
  final double confidence;
  final int points;
  final String reason;

  const EvaluationResult({
    required this.answer,
    required this.correct,
    required this.confidence,
    required this.points,
    required this.reason,
  });

  factory EvaluationResult.fromJson(Map<String, dynamic> json) => EvaluationResult(
        answer: json['answer'] as String? ?? '',
        correct: json['correct'] as bool? ?? false,
        confidence: (json['confidence'] as num?)?.toDouble() ?? 0.0,
        points: (json['points'] as num?)?.toInt() ?? 0,
        reason: json['reason'] as String? ?? '',
      );
}
