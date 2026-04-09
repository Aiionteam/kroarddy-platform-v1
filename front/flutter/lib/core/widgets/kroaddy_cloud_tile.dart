import "dart:math" as math;

import "package:flutter/material.dart";

/// 홈 화면 아이콘 타일처럼 사각형에 가까운 영역을 **구름처럼 꾸불한 실루엣**으로 클립합니다.
/// [phase]로 타일마다 물결 위상을 달리해 나란히 둬도 똑같이 보이지 않게 할 수 있습니다.
class KroaddyCloudTileClip extends StatelessWidget {
  const KroaddyCloudTileClip({
    super.key,
    required this.width,
    required this.height,
    required this.child,
    this.phase = 0,
    this.showDropShadow = true,
    this.shadowColor = Colors.black,
    this.shadowOpacity = 0.06,
    this.shadowBlur = 8,
    this.shadowOffset = const Offset(0, 2),
  });

  final double width;
  final double height;
  final Widget child;
  /// 타일별 물결 위상 (라디안 스케일에 더해짐)
  final double phase;
  final bool showDropShadow;
  final Color shadowColor;
  final double shadowOpacity;
  final double shadowBlur;
  final Offset shadowOffset;

  @override
  Widget build(BuildContext context) {
    final clipper = _CloudBlobClipper(
      size: Size(width, height),
      phase: phase,
    );

    return SizedBox(
      width: width,
      height: height,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          if (showDropShadow)
            Transform.translate(
              offset: shadowOffset,
              child: ClipPath(
                clipper: clipper,
                child: Container(
                  width: width,
                  height: height,
                  color: shadowColor.withValues(alpha: shadowOpacity),
                ),
              ),
            ),
          ClipPath(
            clipper: clipper,
            child: SizedBox(width: width, height: height, child: child),
          ),
        ],
      ),
    );
  }
}

class _CloudBlobClipper extends CustomClipper<Path> {
  _CloudBlobClipper({required this.size, this.phase = 0});

  final Size size;
  final double phase;

  @override
  Path getClip(Size size) => _cloudBlobPath(size, phase);

  @override
  bool shouldReclip(covariant _CloudBlobClipper old) =>
      old.size != size || old.phase != phase;
}

/// 직사각형에 꽉 차도록 타원을 기준으로 반경을 살짝 흔들어 구름 실루엣을 만든다.
Path _cloudBlobPath(Size size, double phase) {
  final w = size.width;
  final h = size.height;
  final cx = w / 2;
  final cy = h / 2;
  final rx = w * 0.48;
  final ry = h * 0.48;
  const segments = 72;

  final path = Path();
  for (var i = 0; i <= segments; i++) {
    final t = (i / segments) * 2 * math.pi;
    final wave = 1.0 +
        0.058 * math.sin(t * 4 + phase) +
        0.036 * math.cos(t * 7 + phase * 1.3) +
        0.018 * math.sin(t * 11 + phase * 0.7);
    final x = cx + rx * wave * math.cos(t);
    final y = cy + ry * wave * math.sin(t);
    if (i == 0) {
      path.moveTo(x, y);
    } else {
      path.lineTo(x, y);
    }
  }
  path.close();
  return path;
}
