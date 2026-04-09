import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/locale/language_picker_sheet.dart";
import "../../../core/theme/kroaddy_colors.dart";

const _faqIds = [
  "login_help",
  "first_steps",
  "update_notes",
  "refund_flow",
  "emergency_help",
];

/// 웹 `/customer` — 고객센터 허브
class CustomerCenterPage extends StatefulWidget {
  const CustomerCenterPage({super.key});

  @override
  State<CustomerCenterPage> createState() => _CustomerCenterPageState();
}

class _CustomerCenterPageState extends State<CustomerCenterPage> {
  String _search = "";

  @override
  Widget build(BuildContext context) {
    final q = _search.trim().toLowerCase();
    final faqs = _faqIds.map((id) {
      final cat = "customer.faq.items.$id.category".tr();
      final question = "customer.faq.items.$id.question".tr();
      final answer = "customer.faq.items.$id.answer".tr();
      return _FaqItem(id: id, category: cat, question: question, answer: answer);
    }).toList();
    final filtered = faqs.where((f) {
      if (q.isEmpty) return true;
      return f.category.toLowerCase().contains(q) ||
          f.question.toLowerCase().contains(q) ||
          f.answer.toLowerCase().contains(q);
    }).toList();

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
          "customer.center.title".tr(),
          style: const TextStyle(
            color: Color(0xFF1F2937),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.language, color: KroaddyColors.primary),
            tooltip: "common.language".tr(),
            onPressed: () => showAppLanguagePicker(context),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
        children: [
          Text(
            "customer.center.subtitle".tr(),
            style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
          ),
          const SizedBox(height: 16),
          Text(
            "customer.search.label".tr(),
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: Color(0xFF374151),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            decoration: InputDecoration(
              hintText: "customer.search.placeholder".tr(),
              filled: true,
              fillColor: Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Color(0xFFD1D5DB)),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: KroaddyColors.primary, width: 1.5),
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            onChanged: (v) => setState(() => _search = v),
          ),
          const SizedBox(height: 24),
          Text(
            "customer.categories.title".tr(),
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 10),
          _CategoryTile(
            icon: Icons.help_outline_rounded,
            titleKey: "customer.categories.items.inquiry.title",
            descKey: "customer.categories.items.inquiry.desc",
            wide: true,
            onTap: () => context.push("/customer/inquiry"),
          ),
          _CategoryTile(
            icon: Icons.menu_book_outlined,
            titleKey: "customer.categories.items.guide.title",
            descKey: "customer.categories.items.guide.desc",
            onTap: () => context.push("/customer/guide"),
          ),
          _CategoryTile(
            icon: Icons.notifications_none_rounded,
            titleKey: "customer.categories.items.notices.title",
            descKey: "customer.categories.items.notices.desc",
            onTap: () => context.push("/customer/notices"),
          ),
          _CategoryTile(
            icon: Icons.credit_card_outlined,
            titleKey: "customer.categories.items.payment.title",
            descKey: "customer.categories.items.payment.desc",
            onTap: () => context.push("/customer/subscription"),
          ),
          _CategoryTile(
            icon: Icons.warning_amber_rounded,
            titleKey: "customer.categories.items.emergency.title",
            descKey: "customer.categories.items.emergency.desc",
            onTap: () => context.push("/customer/emergency"),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                "customer.faq.title".tr(),
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF1F2937),
                ),
              ),
              Text(
                "customer.faq.count".tr(namedArgs: {"count": "${filtered.length}"}),
                style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (filtered.isEmpty)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 24),
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                "customer.faq.no_results".tr(),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
              ),
            )
          else
            ...filtered.map(
              (f) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: _FaqCard(item: f),
              ),
            ),
        ],
      ),
    );
  }
}

class _FaqItem {
  _FaqItem({
    required this.id,
    required this.category,
    required this.question,
    required this.answer,
  });

  final String id;
  final String category;
  final String question;
  final String answer;
}

class _FaqCard extends StatelessWidget {
  const _FaqCard({required this.item});

  final _FaqItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE5E7EB)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: KroaddyColors.primary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              item.category,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w700,
                color: KroaddyColors.primary,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            item.question,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1F2937),
            ),
          ),
          const SizedBox(height: 6),
          Text(
            item.answer,
            style: const TextStyle(fontSize: 13, height: 1.4, color: Color(0xFF4B5563)),
          ),
        ],
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.icon,
    required this.titleKey,
    required this.descKey,
    required this.onTap,
    this.wide = false,
  });

  final IconData icon;
  final String titleKey;
  final String descKey;
  final VoidCallback onTap;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(16),
          child: Container(
            width: wide ? double.infinity : null,
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: const Color(0xFF4B5563), size: 22),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        titleKey.tr(),
                        style: const TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Color(0xFF1F2937),
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        descKey.tr(),
                        style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280), height: 1.35),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right, color: Color(0xFF9CA3AF)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
