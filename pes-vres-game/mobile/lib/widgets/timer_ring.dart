import 'package:flutter/material.dart';

class TimerRing extends StatelessWidget {
  final int remainingSeconds;
  final int totalSeconds;

  const TimerRing({super.key, required this.remainingSeconds, this.totalSeconds = 10});

  @override
  Widget build(BuildContext context) {
    final progress = (remainingSeconds / totalSeconds).clamp(0.0, 1.0);
    final low = remainingSeconds <= 3;

    return SizedBox(
      width: 72,
      height: 72,
      child: Stack(
        alignment: Alignment.center,
        children: [
          SizedBox(
            width: 72,
            height: 72,
            child: CircularProgressIndicator(
              value: progress,
              strokeWidth: 6,
              backgroundColor: Colors.white24,
              valueColor: AlwaysStoppedAnimation<Color>(low ? Colors.redAccent : Colors.greenAccent),
            ),
          ),
          Text(
            '00:${remainingSeconds.toString().padLeft(2, '0')}',
            style: TextStyle(
              color: low ? Colors.redAccent : Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
          ),
        ],
      ),
    );
  }
}
