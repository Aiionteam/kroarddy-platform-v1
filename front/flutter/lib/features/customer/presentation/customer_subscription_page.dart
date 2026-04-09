import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/kroaddy_colors.dart";

/// 웹 `/customer/subscription` — 데모 UI
class CustomerSubscriptionPage extends StatefulWidget {
  const CustomerSubscriptionPage({super.key});

  @override
  State<CustomerSubscriptionPage> createState() => _CustomerSubscriptionPageState();
}

class _CustomerSubscriptionPageState extends State<CustomerSubscriptionPage> {
  bool _monthly = true;
  bool _a1 = true;
  bool _a2 = true;

  @override
  Widget build(BuildContext context) {
    final planKey = _monthly ? "plan_monthly" : "plan_yearly";
    final base = "customer.subscription.$planKey";

    return Scaffold(
      backgroundColor: const Color(0xFFF3F4F6),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Color(0xFF1F2937)),
          onPressed: () => context.pop(),
        ),
        title: Text(
          "customer.subscription.title".tr(),
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
            "customer.subscription.subtitle".tr(),
            style: const TextStyle(fontSize: 13, color: Color(0xFF6B7280)),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.verified_user_outlined, size: 18, color: Color(0xFF6B7280)),
              const SizedBox(width: 6),
              Expanded(
                child: Text(
                  "customer.subscription.safety".tr(),
                  style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFE5E7EB)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "customer.subscription.free.kicker".tr(),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  "customer.subscription.free.note".tr(),
                  style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(child: _planPicker(left: true)),
                    Expanded(child: _planPicker(left: false)),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFE5E7EB)),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "customer.subscription.selected.title".tr(),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              _monthly
                                  ? "customer.subscription.selected.includes".tr()
                                  : "${"customer.subscription.selected.compare".tr()} ${"customer.subscription.plan_yearly.oldPrice".tr()}",
                              style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
                            ),
                          ],
                        ),
                      ),
                      Text(
                        "$base.price".tr(),
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                ...List.generate(3, (i) {
                  final k = "${i + 1}";
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.check_circle, color: Color(0xFF22C55E), size: 18),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            "$base.features.$k".tr(),
                            style: const TextStyle(fontSize: 13, height: 1.35),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
                const SizedBox(height: 12),
                CheckboxListTile(
                  value: _a1,
                  onChanged: (v) => setState(() => _a1 = v ?? true),
                  title: Text(
                    "customer.subscription.agree.service_title".tr(),
                    style: const TextStyle(fontSize: 12),
                  ),
                  subtitle: Text(
                    "customer.subscription.agree.service_desc".tr(),
                    style: const TextStyle(fontSize: 11),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                ),
                CheckboxListTile(
                  value: _a2,
                  onChanged: (v) => setState(() => _a2 = v ?? true),
                  title: Text(
                    "customer.subscription.agree.billing_title".tr(),
                    style: const TextStyle(fontSize: 12),
                  ),
                  subtitle: Text(
                    "customer.subscription.agree.billing_desc".tr(),
                    style: const TextStyle(fontSize: 11),
                  ),
                  controlAffinity: ListTileControlAffinity.leading,
                  contentPadding: EdgeInsets.zero,
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text("customer.subscription.demo_alert".tr())),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: KroaddyColors.primary,
                    minimumSize: const Size(double.infinity, 48),
                  ),
                  child: Text(
                    _monthly
                        ? "customer.subscription.cta_monthly".tr()
                        : "customer.subscription.cta_yearly".tr(),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  "customer.subscription.demo_note".tr(),
                  style: const TextStyle(fontSize: 10, color: Color(0xFF9CA3AF)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _planPicker({required bool left}) {
    final sel = left == _monthly;
    final key = left ? "plan_monthly" : "plan_yearly";
    final b = "customer.subscription.$key";
    return Material(
      color: sel ? KroaddyColors.primary.withValues(alpha: 0.08) : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: () => setState(() => _monthly = left),
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: sel ? KroaddyColors.primary : const Color(0xFFE5E7EB),
              width: sel ? 1.5 : 1,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      "$b.title".tr(),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: sel ? KroaddyColors.primary : const Color(0xFFF3F4F6),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      "$b.badge".tr(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        color: sel ? Colors.white : const Color(0xFF4B5563),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                "$b.price".tr(),
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w900),
              ),
              Text(
                "$b.note".tr(),
                style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
