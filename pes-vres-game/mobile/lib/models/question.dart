class Question {
  final String id;
  final String category;
  final String text;

  const Question({required this.id, required this.category, required this.text});

  factory Question.fromJson(Map<String, dynamic> json) => Question(
        id: json['id'] as String,
        category: json['category'] as String,
        text: json['text'] as String,
      );
}
