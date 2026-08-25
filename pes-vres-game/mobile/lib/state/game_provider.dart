import 'dart:async';

import 'package:flutter/foundation.dart';

import '../models/game_state.dart';
import '../services/api_service.dart';
import '../services/game_service.dart';

const int kRoundSeconds = 10;

/// UI-facing state notifier. Owns the countdown timer and screen phase;
/// delegates everything else (speech recognition, backend calls, question
/// selection) to [GameService].
class GameProvider extends ChangeNotifier {
  final GameService _gameService;
  Timer? _timer;
  GameState _state = const GameState();
  bool _ready = false;
  bool _micPermissionGranted = false;

  GameProvider({GameService? gameService}) : _gameService = gameService ?? GameService();

  GameState get state => _state;
  bool get isReady => _ready;

  void _update(GameState Function(GameState current) transform) {
    _state = transform(_state);
    notifyListeners();
  }

  /// Loads questions and warms up the speech recognizer / mic permission
  /// prompt once, before the player ever taps ΠΑΙΞΕ.
  Future<void> prepare() async {
    _micPermissionGranted = await _gameService.ensureMicPermission();
    await _gameService.loadQuestions();
    if (_micPermissionGranted) {
      await _gameService.initSpeech();
    }
    _ready = true;
    notifyListeners();
  }

  void setAiMode(AiMode mode) => _update((s) => s.copyWith(aiMode: mode));

  void startGame() {
    _update((s) => GameState(aiMode: s.aiMode));
    _goToNextQuestion();
  }

  void _goToNextQuestion() {
    final question = _gameService.nextQuestion();
    _update((s) => s.copyWith(
          phase: GamePhase.ready,
          currentQuestion: question,
          remainingSeconds: kRoundSeconds,
          liveTranscript: '',
          clearResult: true,
          clearError: true,
        ));
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      final remaining = _state.remainingSeconds - 1;
      if (remaining <= 0) {
        timer.cancel();
        _handleTimeout();
      } else {
        _update((s) => s.copyWith(remainingSeconds: remaining));
      }
    });
  }

  Future<void> _handleTimeout() async {
    if (_state.phase == GamePhase.listening) {
      await _gameService.stopListening();
      await _submitAnswer(_state.liveTranscript);
    } else if (_state.phase == GamePhase.ready) {
      await _submitAnswer('');
    }
  }

  Future<void> startListening() async {
    if (_state.phase != GamePhase.ready) return;

    if (!_micPermissionGranted) {
      _timer?.cancel();
      _update((s) => s.copyWith(
            phase: GamePhase.error,
            errorMessage: 'Χρειάζομαι πρόσβαση στο μικρόφωνο για να παίξεις. '
                'Δώσε την άδεια από τις ρυθμίσεις της συσκευής.',
          ));
      return;
    }

    _update((s) => s.copyWith(phase: GamePhase.listening));
    await _gameService.startListening(
      onResult: (text, isFinal) {
        if (_state.phase != GamePhase.listening) return;
        _update((s) => s.copyWith(liveTranscript: text));
        if (isFinal && text.trim().isNotEmpty) {
          _timer?.cancel();
          _submitAnswer(text);
        }
      },
      onError: (message) {
        _timer?.cancel();
        _update((s) => s.copyWith(phase: GamePhase.error, errorMessage: message));
      },
    );
  }

  /// Player tapped the mic again to stop recording manually.
  Future<void> stopListeningAndSubmit() async {
    if (_state.phase != GamePhase.listening) return;
    _timer?.cancel();
    await _gameService.stopListening();
    await _submitAnswer(_state.liveTranscript);
  }

  Future<void> _submitAnswer(String answer) async {
    final question = _state.currentQuestion;
    if (question == null) return;

    _update((s) => s.copyWith(phase: GamePhase.evaluating));

    try {
      final result = await _gameService.evaluate(
        question: question.text,
        answer: answer,
        mode: _state.aiMode.apiValue,
      );
      _update((s) => s.copyWith(
            phase: GamePhase.result,
            lastResult: result,
            score: s.score + result.points,
          ));
    } on ApiException catch (e) {
      _update((s) => s.copyWith(phase: GamePhase.error, errorMessage: e.message));
    } catch (_) {
      _update((s) => s.copyWith(
            phase: GamePhase.error,
            errorMessage: 'Κάτι πήγε στραβά. Ξαναπροσπάθησε.',
          ));
    }
  }

  void nextQuestion() => _goToNextQuestion();

  /// After a technical error (network/API/speech failure), let the player
  /// retry the same question with a fresh 10s window rather than losing
  /// their turn.
  Future<void> retryCurrentQuestion() async {
    if (_state.currentQuestion == null) {
      goHome();
      return;
    }
    if (!_micPermissionGranted) {
      _micPermissionGranted = await _gameService.ensureMicPermission();
      if (_micPermissionGranted) {
        await _gameService.initSpeech();
      }
    }
    _update((s) => s.copyWith(
          phase: GamePhase.ready,
          remainingSeconds: kRoundSeconds,
          liveTranscript: '',
          clearError: true,
        ));
    _startTimer();
  }

  void goHome() {
    _timer?.cancel();
    _update((s) => GameState(aiMode: s.aiMode));
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }
}
