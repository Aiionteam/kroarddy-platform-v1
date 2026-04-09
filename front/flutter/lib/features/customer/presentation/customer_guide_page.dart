import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/kroaddy_colors.dart";

/// 웹 `/customer/guide` — 카드별 항목은 웹 `ko.json` `customer.guide.cards` 구조와 동일
class CustomerGuidePage extends StatelessWidget {
  const CustomerGuidePage({super.key});

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
          "customer.guide.title".tr(),
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
            "customer.guide.subtitle".tr(),
            style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
          ),
          const SizedBox(height: 16),
          _HeroCard(),
          const SizedBox(height: 20),
          const _GuideCard(cardKey: "tourstar", route: "/tourstar"),
          const _GuideCard(cardKey: "planner", route: "/planner"),
          const _GuideCard(cardKey: "schedule", route: "/planner/schedule"),
          const _GuideCard(cardKey: "discover", route: "/guide"),
          const _GuideCard(cardKey: "groupchat", route: "/chat"),
        ],
      ),
    );
  }
}

class _HeroCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            KroaddyColors.primary.withValues(alpha: 0.12),
            Colors.white,
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "customer.guide.hero.kicker".tr(),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: KroaddyColors.primary,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "customer.guide.hero.title".tr(),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: Color(0xFF1F2937),
              height: 1.35,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _chip("customer.guide.hero.steps.planner".tr()),
              _chip("customer.guide.hero.steps.schedule".tr()),
              _chip("customer.guide.hero.steps.guide".tr()),
              _chip("customer.guide.hero.steps.social".tr()),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              FilledButton(
                onPressed: () {
                  context.pop();
                  context.go("/planner");
                },
                style: FilledButton.styleFrom(
                  backgroundColor: KroaddyColors.primary,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                child: Text("customer.guide.hero.cta_planner".tr(), style: const TextStyle(fontSize: 12)),
              ),
              const SizedBox(width: 8),
              OutlinedButton(
                onPressed: () {
                  context.pop();
                  context.go("/chat");
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: KroaddyColors.primary,
                  side: const BorderSide(color: KroaddyColors.primary),
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                ),
                child: Text("customer.guide.hero.cta_groupchat".tr(), style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static Widget _chip(String text) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

class _GuideCard extends StatelessWidget {
  const _GuideCard({required this.cardKey, required this.route});

  final String cardKey;
  final String route;

  @override
  Widget build(BuildContext context) {
    final base = "customer.guide.cards.$cardKey";
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
        ),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          title: Text(
            "$base.title".tr(),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1F2937),
            ),
          ),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              "$base.subtitle".tr(),
              style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.35),
            ),
          ),
          children: [
            ..._itemsForCard(base),
            if (_tipExists(base)) _tipBlock(base),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () {
                  context.pop();
                  context.go(route);
                },
                child: Text("$base.cta".tr()),
              ),
            ),
          ],
        ),
      ),
    );
  }

  bool _tipExists(String base) {
    return cardKey == "tourstar" || cardKey == "schedule";
  }

  Widget _tipBlock(String base) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: const Color(0xFFF3F4F6),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "$base.tip.title".tr(),
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: Color(0xFF374151),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              "$base.tip.body".tr(),
              style: const TextStyle(fontSize: 12, height: 1.35, color: Color(0xFF4B5563)),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _itemsForCard(String base) {
    switch (cardKey) {
      case "tourstar":
        return [
          _numberedBlock(base, "1"),
          _numberedBlock(base, "2"),
          _numberedBlock(base, "3"),
        ];
      case "planner":
        return [
          _labelBody(base, "1"),
          _labelBody(base, "2"),
          _bodyOnly(base, "3"),
        ];
      case "schedule":
        return [
          _numberedBlock(base, "1"),
          _numberedBlock(base, "2"),
          _numberedBlock(base, "3"),
        ];
      case "discover":
        return [
          _numberedBlock(base, "1"),
          _numberedBlock(base, "2"),
          _bodyOnly(base, "3"),
        ];
      case "groupchat":
        return [
          _numberedBlock(base, "1"),
          _numberedBlock(base, "2"),
          _numberedBlock(base, "3"),
        ];
      default:
        return [];
    }
  }

  static Widget _numberedBlock(String base, String i) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            "$base.items.$i.title".tr(),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "$base.items.$i.body".tr(),
            style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF4B5563)),
          ),
        ],
      ),
    );
  }

  static Widget _labelBody(String base, String i) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text.rich(
        TextSpan(
          style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF4B5563)),
          children: [
            TextSpan(
              text: "$base.items.$i.label".tr(),
              style: const TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF374151)),
            ),
            TextSpan(text: "$base.items.$i.body".tr()),
          ],
        ),
      ),
    );
  }

  static Widget _bodyOnly(String base, String i) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Text(
        "$base.items.$i.body".tr(),
        style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF4B5563)),
      ),
    );
  }
}
