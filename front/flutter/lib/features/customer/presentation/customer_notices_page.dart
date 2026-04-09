import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../core/theme/kroaddy_colors.dart";

const _noticeIds = ["7", "6", "5", "4", "3"];

/// 웹 `/customer/notices` — 시드 공지 + 검색 (읽기 전용)
class CustomerNoticesPage extends StatefulWidget {
  const CustomerNoticesPage({super.key});

  @override
  State<CustomerNoticesPage> createState() => _CustomerNoticesPageState();
}

class _CustomerNoticesPageState extends State<CustomerNoticesPage> {
  final _searchCtrl = TextEditingController();
  String _query = "";

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final items = _noticeIds.map((id) {
      return _NoticeRow(
        id: id,
        title: "customer.notices.seed.$id.title".tr(),
        content: "customer.notices.seed.$id.content".tr(),
        author: "customer.notices.seed.author.ops".tr(),
        views: 120 + int.parse(id) * 11,
      );
    }).toList();

    final q = _query.trim().toLowerCase();
    final filtered = items.where((n) {
      if (q.isEmpty) return true;
      return n.title.toLowerCase().contains(q) || n.content.toLowerCase().contains(q);
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
          "customer.notices.title".tr(),
          style: const TextStyle(
            color: Color(0xFF1F2937),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "customer.notices.subtitle".tr(),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchCtrl,
                        onChanged: (v) => setState(() => _query = v),
                        decoration: InputDecoration(
                          hintText: "customer.notices.search_placeholder".tr(),
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          prefixIcon: const Icon(Icons.search, size: 20),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton(
                      onPressed: () => setState(() {}),
                      style: FilledButton.styleFrom(
                        backgroundColor: KroaddyColors.primary,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      ),
                      child: Text("customer.notices.search_button".tr()),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  "customer.notices.count".tr(namedArgs: {"count": "${filtered.length}"}),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                ),
              ],
            ),
          ),
          Expanded(
            child: filtered.isEmpty
                ? Center(child: Text("customer.notices.no_results".tr()))
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    itemCount: filtered.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 8),
                    itemBuilder: (context, i) {
                      final n = filtered[i];
                      return Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => _openNotice(context, n),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                            child: Row(
                              children: [
                                SizedBox(
                                  width: 28,
                                  child: Text(
                                    n.id,
                                    style: const TextStyle(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF9CA3AF),
                                    ),
                                  ),
                                ),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        n.title,
                                        style: const TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w700,
                                          color: Color(0xFF1F2937),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        "${n.author} · ${"customer.notices.table.views".tr()} ${n.views}",
                                        style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(Icons.chevron_right, color: Color(0xFFCBD5E1)),
                              ],
                            ),
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("customer.notices.new_button_alert".tr())),
          );
        },
        backgroundColor: KroaddyColors.primary,
        icon: const Icon(Icons.edit_note, color: Colors.white),
        label: Text(
          "customer.notices.new_button".tr(),
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
        ),
      ),
    );
  }

  void _openNotice(BuildContext context, _NoticeRow n) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            bottom: MediaQuery.paddingOf(ctx).bottom + 16,
            top: 8,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  n.title,
                  style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: 8),
                Text(
                  "customer.notices.modal.meta".tr(namedArgs: {
                    "author": n.author,
                    "date": "2026-04-01",
                  }),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF)),
                ),
                const SizedBox(height: 16),
                Text(n.content, style: const TextStyle(fontSize: 14, height: 1.5)),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    child: Text("customer.notices.modal.close".tr()),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _NoticeRow {
  _NoticeRow({
    required this.id,
    required this.title,
    required this.content,
    required this.author,
    required this.views,
  });

  final String id;
  final String title;
  final String content;
  final String author;
  final int views;
}
