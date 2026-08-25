import 'package:flutter/material.dart';

import '../models/evaluation_result.dart';

/// Shown in place of the question/mic view once an answer has been
/// evaluated. Not a separate route - GameScreen swaps it in with an
/// AnimatedSwitcher so the transition is smooth.
class ResultView extends StatelessWidget {
  final EvaluationResult result;
  final int score;
  final VoidCallback onNext;

  const ResultView({
    super.key,
    required this.result,
    required this.score,
    required this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final correct = result.correct;
    final color = correct ? Colors.greenAccent : Colors.redAccent;

    return Column(
      key: const ValueKey('result'),
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text(
          result.answer.isEmpty ? '(καμία απάντηση)' : result.answer.toUpperCase(),
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 30,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 24),
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 0, end: 1),
          duration: const Duration(milliseconds: 400),
          curve: Curves.elasticOut,
          builder: (context, value, child) => Transform.scale(scale: value, child: child),
          child: Icon(
            correct ? Icons.check_circle : Icons.cancel,
            color: color,
            size: 84,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          correct ? 'ΣΩΣΤΟ!' : 'ΛΑΘΟΣ',
          style: TextStyle(color: color, fontSize: 28, fontWeight: FontWeight.w900),
        ),
        if (result.reason.isNotEmpty) ...[
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Text(
              result.reason,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white60, fontSize: 13),
            ),
          ),
        ],
        const SizedBox(height: 20),
        Text(
          result.points > 0 ? '+${result.points}' : '+0',
          style: TextStyle(color: color, fontSize: 24, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        Text(
          'Σκορ: $score',
          style: const TextStyle(color: Colors.white70, fontSize: 16),
        ),
        const SizedBox(height: 40),
        ElevatedButton(
          onPressed: onNext,
          style: ElevatedButton.styleFrom(
            backgroundColor: Colors.orangeAccent,
            foregroundColor: Colors.black,
            padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 16),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
            textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          child: const Text('ΕΠΟΜΕΝΗ ➜'),
        ),
      ],
    );
  }
}
