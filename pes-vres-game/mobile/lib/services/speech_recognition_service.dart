import 'package:flutter/foundation.dart';
import 'package:speech_to_text/speech_to_text.dart';

/// Abstraction so the rest of the app never depends on a concrete speech
/// engine. Today [NativeSpeechRecognitionService] uses the device's native
/// Android/iOS speech recognizer (via the `speech_to_text` plugin). Later
/// this can be swapped for an implementation backed by OpenAI's
/// speech-to-text API, or any other STT provider, without touching
/// GameService or the UI.
abstract class SpeechRecognitionService {
  Future<bool> initialize();

  Future<void> startListening({
    required void Function(String text, bool isFinal) onResult,
    required void Function(String message) onError,
    String localeId = 'el_GR',
  });

  Future<void> stopListening();

  bool get isListening;
  bool get isAvailable;
}

class NativeSpeechRecognitionService implements SpeechRecognitionService {
  final SpeechToText _speech = SpeechToText();
  bool _available = false;

  @override
  Future<bool> initialize() async {
    try {
      _available = await _speech.initialize(
        onError: (error) => debugPrint('Speech recognition error: ${error.errorMsg}'),
        onStatus: (status) => debugPrint('Speech recognition status: $status'),
      );
    } catch (_) {
      _available = false;
    }
    return _available;
  }

  @override
  Future<void> startListening({
    required void Function(String text, bool isFinal) onResult,
    required void Function(String message) onError,
    String localeId = 'el_GR',
  }) async {
    if (!_available) {
      onError('Η αναγνώριση φωνής δεν είναι διαθέσιμη σε αυτή τη συσκευή.');
      return;
    }

    try {
      await _speech.listen(
        localeId: localeId,
        onResult: (result) => onResult(result.recognizedWords, result.finalResult),
        listenFor: const Duration(seconds: 10),
        pauseFor: const Duration(seconds: 3),
        cancelOnError: true,
        partialResults: true,
      );
    } catch (_) {
      onError('Δεν κατάφερα να σε ακούσω. Ξαναπροσπάθησε.');
    }
  }

  @override
  Future<void> stopListening() async {
    if (_speech.isListening) {
      await _speech.stop();
    }
  }

  @override
  bool get isListening => _speech.isListening;

  @override
  bool get isAvailable => _available;
}
