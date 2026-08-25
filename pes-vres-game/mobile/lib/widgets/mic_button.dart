import 'package:flutter/material.dart';

/// Big microphone button. Pulses while listening so the player gets clear
/// "I'm recording" feedback.
class MicButton extends StatefulWidget {
  final bool isListening;
  final bool enabled;
  final VoidCallback onTap;

  const MicButton({
    super.key,
    required this.isListening,
    required this.onTap,
    this.enabled = true,
  });

  @override
  State<MicButton> createState() => _MicButtonState();
}

class _MicButtonState extends State<MicButton> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.enabled ? widget.onTap : null,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final scale = widget.isListening ? 1.0 + (_controller.value * 0.15) : 1.0;
          return Transform.scale(scale: scale, child: child);
        },
        child: Container(
          width: 96,
          height: 96,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: widget.isListening ? Colors.redAccent : Theme.of(context).colorScheme.primary,
            boxShadow: [
              BoxShadow(
                color: (widget.isListening ? Colors.redAccent : Theme.of(context).colorScheme.primary)
                    .withOpacity(0.4),
                blurRadius: 24,
                spreadRadius: widget.isListening ? 6 : 2,
              ),
            ],
          ),
          child: Icon(
            widget.isListening ? Icons.mic : Icons.mic_none,
            color: Colors.white,
            size: 44,
          ),
        ),
      ),
    );
  }
}
