import 'question.dart';

/// Fallback question set used only when the backend's /api/questions
/// can't be reached (e.g. no network yet at app start), so the player can
/// still see the game screen. Answer evaluation still needs the backend.
const List<Question> kLocalQuestions = [
  Question(id: 'q01', category: 'animals', text: 'Πες ένα ζώο που πετάει'),
  Question(id: 'q02', category: 'food', text: 'Πες ένα φρούτο'),
  Question(id: 'q03', category: 'home', text: 'Πες κάτι που υπάρχει σε μία κουζίνα'),
  Question(id: 'q04', category: 'geography', text: 'Πες ένα ελληνικό νησί'),
  Question(id: 'q05', category: 'jobs', text: 'Πες ένα επάγγελμα'),
  Question(id: 'q06', category: 'vehicles', text: 'Πες κάτι που μπορεί να βρεις σε ένα αυτοκίνητο'),
  Question(id: 'q07', category: 'sports', text: 'Πες ένα άθλημα'),
  Question(id: 'q08', category: 'colors', text: 'Πες ένα χρώμα'),
  Question(id: 'q09', category: 'animals', text: 'Πες ένα ζώο που ζει στη θάλασσα'),
  Question(id: 'q10', category: 'school', text: 'Πες κάτι που χρησιμοποιούμε στο σχολείο'),
  Question(id: 'q11', category: 'food', text: 'Πες ένα λαχανικό'),
  Question(id: 'q12', category: 'animals', text: 'Πες ένα ζώο που ζει στη ζούγκλα'),
  Question(id: 'q13', category: 'home', text: 'Πες κάτι που υπάρχει σε ένα σαλόνι'),
  Question(id: 'q14', category: 'geography', text: 'Πες μια ελληνική πόλη'),
  Question(id: 'q15', category: 'clothes', text: 'Πες κάτι που φοράμε στο κρύο'),
  Question(id: 'q16', category: 'weather', text: 'Πες κάτι που σχετίζεται με τη βροχή'),
  Question(id: 'q17', category: 'music', text: 'Πες ένα μουσικό όργανο'),
  Question(id: 'q18', category: 'body', text: 'Πες ένα μέρος του ανθρώπινου σώματος'),
  Question(id: 'q19', category: 'nature', text: 'Πες κάτι που θα έβρισκες σε ένα δάσος'),
  Question(id: 'q20', category: 'tech', text: 'Πες μια ηλεκτρονική συσκευή'),
];
