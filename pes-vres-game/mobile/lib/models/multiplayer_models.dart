import 'evaluation_result.dart';
import 'question.dart';

/// Not wired up yet - kept ready for a future WebSocket-based multiplayer
/// mode (several Players racing on the same Round in a Room) without having
/// to reshape the single-player GameState.
class Player {
  final String id;
  final String name;
  final int score;

  const Player({required this.id, required this.name, this.score = 0});
}

class Answer {
  final String playerId;
  final String text;
  final EvaluationResult? result;
  final DateTime submittedAt;

  const Answer({
    required this.playerId,
    required this.text,
    this.result,
    required this.submittedAt,
  });
}

class Round {
  final String id;
  final Question question;
  final Map<String, Answer> answers;
  final DateTime startedAt;
  final Duration duration;

  const Round({
    required this.id,
    required this.question,
    this.answers = const {},
    required this.startedAt,
    this.duration = const Duration(seconds: 10),
  });
}

enum RoomStatus { lobby, inProgress, finished }

class Room {
  final String id;
  final String code;
  final List<Player> players;
  final List<Round> rounds;
  final int currentRoundIndex;
  final RoomStatus status;

  const Room({
    required this.id,
    required this.code,
    this.players = const [],
    this.rounds = const [],
    this.currentRoundIndex = 0,
    this.status = RoomStatus.lobby,
  });
}
