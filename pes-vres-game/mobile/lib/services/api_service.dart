import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;

import '../models/evaluation_result.dart';
import '../models/question.dart';

/// Friendly, already-Greek error message meant to be shown directly to the
/// player - callers never need to inspect the underlying exception.
class ApiException implements Exception {
  final String message;
  const ApiException(this.message);

  @override
  String toString() => message;
}

/// Talks to the Pes Vres backend. The backend URL is configurable at build
/// time with `--dart-define=API_BASE_URL=http://<ip>:3000` so the app can
/// point at a backend running on your computer while you play on a real
/// phone. Defaults to the Android emulator's alias for the host machine.
class ApiService {
  final String baseUrl;
  final Duration timeout;

  const ApiService({
    this.baseUrl = const String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://10.0.2.2:3000',
    ),
    this.timeout = const Duration(seconds: 12),
  });

  Future<EvaluationResult> evaluate({
    required String question,
    required String answer,
    required String mode,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/api/evaluate'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'question': question, 'answer': answer, 'mode': mode}),
          )
          .timeout(timeout);

      final body = _decodeJson(response.bodyBytes);

      if (response.statusCode != 200) {
        final serverMessage = body?['error'] as String?;
        throw ApiException(serverMessage ?? 'Ο διακομιστής επέστρεψε σφάλμα (${response.statusCode}).');
      }

      if (body == null) {
        throw const ApiException('Δεν κατάλαβα την απάντηση του διακομιστή.');
      }

      return EvaluationResult.fromJson(body);
    } on TimeoutException {
      throw const ApiException('Η σύνδεση άργησε πολύ. Ξαναπροσπάθησε.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw const ApiException('Πρόβλημα σύνδεσης δικτύου. Ξαναπροσπάθησε.');
    }
  }

  Future<List<Question>> fetchQuestions() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/questions')).timeout(timeout);
      final body = _decodeJson(response.bodyBytes);
      if (response.statusCode != 200 || body == null) {
        throw const ApiException('Δεν κατάφερα να φορτώσω τις ερωτήσεις.');
      }
      final list = (body['questions'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>()
          .map(Question.fromJson)
          .toList();
      return list;
    } on TimeoutException {
      throw const ApiException('Η σύνδεση άργησε πολύ. Ξαναπροσπάθησε.');
    } on ApiException {
      rethrow;
    } catch (_) {
      throw const ApiException('Πρόβλημα σύνδεσης δικτύου. Ξαναπροσπάθησε.');
    }
  }

  Map<String, dynamic>? _decodeJson(List<int> bytes) {
    try {
      return jsonDecode(utf8.decode(bytes)) as Map<String, dynamic>;
    } catch (_) {
      return null;
    }
  }
}
