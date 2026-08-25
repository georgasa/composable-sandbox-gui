import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../models/game_state.dart';
import '../state/game_provider.dart';
import 'game_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<GameProvider>();

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
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(flex: 2),
                const Text(
                  'ΠΕΣ ΒΡΕΣ',
                  style: TextStyle(
                    fontSize: 48,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: 2,
                  ),
                ),
                const SizedBox(height: 12),
                const Text(
                  'Πες μια λέξη. Δες αν το AI τη βρίσκει σωστή.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 16),
                ),
                const Spacer(flex: 2),
                ElevatedButton(
                  onPressed: provider.isReady
                      ? () {
                          provider.startGame();
                          Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const GameScreen()),
                          );
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.orangeAccent,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 56, vertical: 20),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(32)),
                    textStyle: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
                  ),
                  child: provider.isReady
                      ? const Text('ΠΑΙΞΕ')
                      : const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black),
                        ),
                ),
                const Spacer(flex: 1),
                _AiModeToggle(provider: provider),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Dev toggle: lets you test the full app without spending real AI API
/// credits (Mock), or switch to the real semantic evaluator (Real) once the
/// backend has an OPENAI_API_KEY configured. The mobile app never sees or
/// stores that key - it only sends which mode it's asking the backend for.
class _AiModeToggle extends StatelessWidget {
  final GameProvider provider;

  const _AiModeToggle({required this.provider});

  @override
  Widget build(BuildContext context) {
    final mode = provider.state.aiMode;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.08),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('AI MODE', style: TextStyle(color: Colors.white54, fontSize: 12)),
          const SizedBox(width: 12),
          _modeChip(context, 'Mock', AiMode.mock, mode),
          const SizedBox(width: 8),
          _modeChip(context, 'Real', AiMode.real, mode),
        ],
      ),
    );
  }

  Widget _modeChip(BuildContext context, String label, AiMode value, AiMode current) {
    final selected = value == current;
    return GestureDetector(
      onTap: () => provider.setAiMode(value),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: selected ? Colors.orangeAccent : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? Colors.black : Colors.white70,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ),
    );
  }
}
