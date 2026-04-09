import "package:easy_localization/easy_localization.dart";

import "state/tourstar_state.dart";

/// [TourstarState.statusMessage] is an i18n key (`screens.tourstar.*`) with optional [TourstarState.statusMessageParams].
String tourstarStatusLine(TourstarState state) {
  final raw = state.statusMessage;
  if (raw.isEmpty) return "";
  if (raw.startsWith("screens.tourstar.")) {
    return raw.tr(namedArgs: state.statusMessageParams);
  }
  return raw;
}
