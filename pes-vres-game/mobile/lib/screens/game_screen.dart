import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/game_state.dart';
import '../state/game_provider.dart';
import '../widgets/mic_button.dart';
import '../widgets/score_badge.dart';
import '../widgets/timer_ring.dart';
import 'result_screen.dart';

class GameScreen extends StatelessWidget {
  const GameScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<GameProvider>();
    final state = provider.state;

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Color(0xFF6A3DE8), Color(0xFF2C0B5B)],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.home, color: Colors.white70),
                      onPressed: () {
                        provider.goHome();
                        Navigator.of(context).pop();
                      },
                    ),
                    ScoreBadge(score: state.score),
                  ],
                ),
              ),
              Expanded(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 350),
                  child: _buildBody(context, provider, state),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBody(BuildContext context, GameProvider provider, GameState state) {
    switch (state.phase) {
      case GamePhase.result:
        final result = state.lastResult;
        if (result == null) break;
        return ResultView(
          key: const ValueKey('result'),
          result: result,
          score: state.score,
          onNext: provider.nextQuestion,
        );
      case GamePhase.error:
        return _ErrorView(
          key: const ValueKey('error'),
          message: state.errorMessage ?? 'Κάτι πήγε στραβά.',
          onRetry: provider.retryCurrentQuestion,
        );
      case GamePhase.evaluating:
        return const Center(
          key: ValueKey('evaluating'),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(color: Colors.white),
              SizedBox(height: 16),
              Text('Το AI αξιολογεί...', style: TextStyle(color: Colors.white70)),
            ],
          ),
        );
      case GamePhase.ready:
      case GamePhase.listening:
        break;
      case GamePhase.home:
        return const SizedBox.shrink(key: ValueKey('empty'));
    }

    return _QuestionView(key: const ValueKey('question'), provider: provider, state: state);
  }
}

class _QuestionView extends StatelessWidget {
  final GameProvider provider;
  final GameState state;

  const _QuestionView({super.key, required this.provider, required this.state});

  @override
  Widget build(BuildContext context) {
    final listening = state.phase == GamePhase.listening;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            state.currentQuestion?.text ?? '',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 26,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 28),
          TimerRing(remainingSeconds: state.remainingSeconds),
          const SizedBox(height: 32),
          SizedBox(
            height: 32,
            child: Text(
              listening ? state.liveTranscript : '',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 18, fontStyle: FontStyle.italic),
            ),
          ),
          const SizedBox(height: 24),
          MicButton(
            isListening: listening,
            onTap: () {
              if (listening) {
                provider.stopListeningAndSubmit();
              } else {
                provider.startListening();
              }
            },
          ),
          const SizedBox(height: 16),
          Text(
            listening ? 'ΣΕ ΑΚΟΥΩ...' : 'ΠΑΤΑ ΚΑΙ ΠΕΣ',
            style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.bold, letterSpacing: 1),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;
  final VoidCallback onRetry;

  const _ErrorView({super.key, required this.message, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, color: Colors.white70, size: 56),
          const SizedBox(height: 16),
          Text(
            message,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 18),
          ),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: onRetry,
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orangeAccent,
              foregroundColor: Colors.black,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            ),
            child: const Text('ΞΑΝΑΠΡΟΣΠΑΘΗΣΕ'),
          ),
        ],
      ),
    );
  }
}
