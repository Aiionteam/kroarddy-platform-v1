import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/kroaddy_colors.dart";

const _catKeys = [
  "passport",
  "lost",
  "safety",
  "medical",
  "disaster",
  "immigration",
  "interpreter",
];

/// 웹 `/customer/emergency`
class CustomerEmergencyPage extends StatelessWidget {
  const CustomerEmergencyPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8F7FF),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1F2937)),
          onPressed: () => context.pop(),
        ),
        title: Text(
          "customer.emergency.title".tr(),
          style: const TextStyle(
            color: Color(0xFF1F2937),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(
            "customer.emergency.subtitle".tr(),
            style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280), height: 1.4),
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "customer.emergency.consulate.title".tr(),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 6),
                Text(
                  "customer.emergency.consulate.callcenter".tr(),
                  style: const TextStyle(fontSize: 13, height: 1.4),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          Text(
            "customer.emergency.categories.title".tr(),
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 10),
          ..._catKeys.map((k) => _EmergencyTile(catKey: k)),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFFEFF6FF),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "customer.emergency.detail.badge".tr(),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF1D4ED8)),
                ),
                const SizedBox(height: 8),
                _hotlineRow(Icons.local_police_outlined, "customer.emergency.detail.call_police".tr()),
                _hotlineRow(Icons.medical_services_outlined, "customer.emergency.detail.call_119".tr()),
                _hotlineRow(Icons.phone_in_talk_outlined, "customer.emergency.detail.call_1339".tr()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  static Widget _hotlineRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        children: [
          Icon(icon, size: 18, color: const Color(0xFF1D4ED8)),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
        ],
      ),
    );
  }
}

class _EmergencyTile extends StatelessWidget {
  const _EmergencyTile({required this.catKey});

  final String catKey;

  @override
  Widget build(BuildContext context) {
    final base = "customer.emergency.categories.items.$catKey";
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          title: Text(
            "$base.title".tr(),
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1F2937),
            ),
          ),
          subtitle: Text(
            "$base.short".tr(),
            style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
          ),
          children: [
            for (var i = 1; i <= 3; i++) _stepLine(base, i),
          ],
        ),
      ),
    );
  }

  Widget _stepLine(String base, int i) {
    final key = "$base.steps.$i";
    final text = key.tr();
    if (text.isEmpty || text.startsWith("customer.")) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "$i.",
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w800,
              color: KroaddyColors.primary,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(text, style: const TextStyle(fontSize: 13, height: 1.45)),
          ),
        ],
      ),
    );
  }
}
