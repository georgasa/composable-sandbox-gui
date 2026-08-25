import 'dart:math';

import 'package:permission_handler/permission_handler.dart';

import '../models/evaluation_result.dart';
import '../models/local_questions.dart';
import '../models/question.dart';
import 'api_service.dart';
import 'speech_recognition_service.dart';

/// Coordinates the non-UI parts of a game session: loading questions,
/// driving the speech recognizer, and asking the backend to evaluate an
/// answer. GameProvider (the ChangeNotifier UI adapter) owns the countdown
/// timer and screen state; this class owns everything that talks to a
/// service outside the widget tree.
class GameService {
  final ApiService apiService;
  final SpeechRecognitionService speechService;
  final Random _random = Random();

  List<Question> _questions = List.of(kLocalQuestions);
  final List<Question> _upcoming = [];

  GameService({ApiService? apiService, SpeechRecognitionService? speechService})
      : apiService = apiService ?? const ApiService(),
        speechService = speechService ?? NativeSpeechRecognitionService();

  /// Tries to refresh the question set from the backend; keeps the bundled
  /// local questions if the network isn't reachable yet, so a first-run
  /// player still sees something.
  Future<void> loadQuestions() async {
    try {
      final remote = await apiService.fetchQuestions();
      if (remote.isNotEmpty) {
        _questions = remote;
      }
    } catch (_) {
      // Keep local fallback questions; game can still start.
    }
  }

  /// Explicitly requests the microphone permission (rather than relying on
  /// the speech plugin to ask implicitly) so the app can show a clear
  /// Greek error message if the player denies it.
  Future<bool> ensureMicPermission() async {
    final status = await Permission.microphone.request();
    return status.isGranted;
  }

  Future<bool> initSpeech() => speechService.initialize();

  /// Picks the next question without immediately repeating the last one.
  Question nextQuestion() {
    if (_upcoming.isEmpty) {
      _upcoming
        ..addAll(_questions)
        ..shuffle(_random);
    }
    return _upcoming.removeLast();
  }

  Future<void> startListening({
    required void Function(String text, bool isFinal) onResult,
    required void Function(String message) onError,
  }) {
    return speechService.startListening(onResult: onResult, onError: onError);
  }

  Future<void> stopListening() => speechService.stopListening();

  bool get isListening => speechService.isListening;

  Future<EvaluationResult> evaluate({
    required String question,
    required String answer,
    required String mode,
  }) {
    return apiService.evaluate(question: question, answer: answer, mode: mode);
  }
}
