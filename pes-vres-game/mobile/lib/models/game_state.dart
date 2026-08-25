import 'evaluation_result.dart';
import 'question.dart';

enum GamePhase {
  home,
  ready,
  listening,
  evaluating,
  result,
  error,
}

/// Dev toggle for which evaluator the backend should use for this request.
/// The mobile app never talks to OpenAI directly and never holds an API key -
/// this only tells the backend which of its own evaluators to use.
enum AiMode { mock, real }

extension AiModeApi on AiMode {
  String get apiValue => this == AiMode.real ? 'real' : 'mock';
}

class GameState {
  final GamePhase phase;
  final int score;
  final Question? currentQuestion;
  final int remainingSeconds;
  final String liveTranscript;
  final EvaluationResult? lastResult;
  final String? errorMessage;
  final AiMode aiMode;

  const GameState({
    this.phase = GamePhase.home,
    this.score = 0,
    this.currentQuestion,
    this.remainingSeconds = 10,
    this.liveTranscript = '',
    this.lastResult,
    this.errorMessage,
    this.aiMode = AiMode.mock,
  });

  GameState copyWith({
    GamePhase? phase,
    int? score,
    Question? currentQuestion,
    int? remainingSeconds,
    String? liveTranscript,
    EvaluationResult? lastResult,
    String? errorMessage,
    bool clearError = false,
    bool clearResult = false,
    AiMode? aiMode,
  }) {
    return GameState(
      phase: phase ?? this.phase,
      score: score ?? this.score,
      currentQuestion: currentQuestion ?? this.currentQuestion,
      remainingSeconds: remainingSeconds ?? this.remainingSeconds,
      liveTranscript: liveTranscript ?? this.liveTranscript,
      lastResult: clearResult ? null : (lastResult ?? this.lastResult),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      aiMode: aiMode ?? this.aiMode,
    );
  }
}
