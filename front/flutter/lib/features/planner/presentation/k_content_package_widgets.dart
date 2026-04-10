import "package:flutter/material.dart";

import "../../../core/theme/kroaddy_colors.dart";
import "../data/k_content_itinerary_text.dart";

const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);

/// 웹 `ItineraryCard` — `KF_CAFE` 일 때 설명으로 `vibe_reason` 우선
class KContentItineraryCard extends StatelessWidget {
  const KContentItineraryCard({
    super.key,
    required this.packageId,
    required this.item,
    required this.lang,
    required this.descriptionFallback,
  });

  final String packageId;
  final Map<String, dynamic> item;
  final String lang;
  final String descriptionFallback;

  bool get _isKfCafe => packageId.toUpperCase() == "KF_CAFE";

  @override
  Widget build(BuildContext context) {
    final title = item["title"]?.toString() ?? "";
    final place = item["place"]?.toString() ?? "";
    final time = item["time"]?.toString();
    final rawDesc = item["description"]?.toString();
    final vibeReason = item["vibe_reason"]?.toString();
    final tips = item["tips"]?.toString();
    final cost = item["estimated_cost"]?.toString();
    final source = item["source"]?.toString();
    final descForLocalization =
        _isKfCafe && (vibeReason ?? "").trim().isNotEmpty ? vibeReason! : (rawDesc ?? "");

    final placeForFallback = place.isNotEmpty ? place : title;
    final fallback = descriptionFallback.contains("{place}")
        ? descriptionFallback.replaceAll("{place}", placeForFallback)
        : descriptionFallback;
    final descriptionText = getLocalizedDescription(
      description: descForLocalization,
      tips: tips,
      place: place.isNotEmpty ? place : title,
      source: source,
      lang: lang,
      fallbackDescription: fallback,
    );
    final tipText = localizeTip(tips, lang);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 4,
            offset: const Offset(0, 1),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (time != null && time.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 6, top: 2),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEEF2FF),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(time, style: const TextStyle(fontSize: 11, color: Color(0xFF818CF8))),
                  ),
                ),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: _textPrimary),
                ),
              ),
              if (source == "db")
                Padding(
                  padding: const EdgeInsets.only(left: 6),
                  child: Text(
                    "Kroaddy PICK",
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: KroaddyColors.primary,
                    ),
                  ),
                ),
              if (cost != null && cost.isNotEmpty)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(cost, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFF059669))),
                ),
            ],
          ),
          if (place.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text("📍 $place", style: const TextStyle(fontSize: 12, color: Color(0xFF6366F1), fontWeight: FontWeight.w600)),
            ),
          if (descriptionText.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(descriptionText, style: const TextStyle(fontSize: 13, color: _textSecondary, height: 1.35)),
            ),
          if (tipText.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text("💡 $tipText", style: const TextStyle(fontSize: 11, color: Color(0xFF92400E))),
              ),
            ),
        ],
      ),
    );
  }
}
