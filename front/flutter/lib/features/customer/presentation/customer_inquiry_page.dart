import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:image_picker/image_picker.dart";

import "../../../core/theme/kroaddy_colors.dart";
import "../data/customer_inquiry_storage.dart";

/// 웹 `/customer/inquiry` — 문의는 SharedPreferences에 저장 (웹 localStorage 대응)
class CustomerInquiryPage extends StatefulWidget {
  const CustomerInquiryPage({super.key});

  @override
  State<CustomerInquiryPage> createState() => _CustomerInquiryPageState();
}

class _CustomerInquiryPageState extends State<CustomerInquiryPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabs;
  final _titleCtrl = TextEditingController();
  final _contentCtrl = TextEditingController();
  bool _agree = false;
  bool _submitting = false;
  List<StoredInquiry> _list = [];
  final _listQueryCtrl = TextEditingController();
  final List<String> _pickedNames = [];

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final seeds = _seedInquiries();
    final loaded = await loadInquiries();
    setState(() {
      _list = loaded.isNotEmpty ? loaded : seeds;
    });
  }

  List<StoredInquiry> _seedInquiries() {
    return [
      StoredInquiry(
        id: "10001",
        title: "customer.inquiry.seed.10001.title".tr(),
        content: "customer.inquiry.seed.10001.content".tr(),
        fileNames: const [],
        agree: true,
        createdAt: DateTime.now().millisecondsSinceEpoch - const Duration(days: 2).inMilliseconds,
        status: "pending",
      ),
      StoredInquiry(
        id: "10002",
        title: "customer.inquiry.seed.10002.title".tr(),
        content: "customer.inquiry.seed.10002.content".tr(),
        fileNames: const ["screenshot.png"],
        agree: true,
        createdAt: DateTime.now().millisecondsSinceEpoch - const Duration(days: 7).inMilliseconds,
        status: "answered",
        answer: "customer.inquiry.seed.10002.answer".tr(),
      ),
    ];
  }

  @override
  void dispose() {
    _tabs.dispose();
    _titleCtrl.dispose();
    _contentCtrl.dispose();
    _listQueryCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickImages() async {
    if (_pickedNames.length >= 3) return;
    final picker = ImagePicker();
    final files = await picker.pickMultiImage(imageQuality: 85);
    if (!mounted) return;
    setState(() {
      for (final f in files) {
        if (_pickedNames.length >= 3) break;
        _pickedNames.add(f.name);
      }
    });
  }

  Future<void> _submit() async {
    if (_titleCtrl.text.trim().isEmpty ||
        _contentCtrl.text.trim().isEmpty ||
        !_agree) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("customer.inquiry.form.validation".tr())),
      );
      return;
    }
    setState(() => _submitting = true);
    await Future<void>.delayed(const Duration(milliseconds: 400));
    final id = DateTime.now().millisecondsSinceEpoch.toString();
    final item = StoredInquiry(
      id: id,
      title: _titleCtrl.text.trim(),
      content: _contentCtrl.text.trim(),
      fileNames: List<String>.from(_pickedNames),
      agree: _agree,
      createdAt: DateTime.now().millisecondsSinceEpoch,
      status: "pending",
    );
    final next = [item, ..._list];
    await saveInquiries(next);
    if (!mounted) return;
    setState(() {
      _list = next;
      _submitting = false;
      _titleCtrl.clear();
      _contentCtrl.clear();
      _pickedNames.clear();
      _agree = false;
      _tabs.index = 1;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text("customer.inquiry.form.submit".tr())),
    );
  }

  String _fmtDate(int ts) {
    final d = DateTime.fromMillisecondsSinceEpoch(ts);
    return "${d.year}.${d.month.toString().padLeft(2, '0')}.${d.day.toString().padLeft(2, '0')} "
        "${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}";
  }

  @override
  Widget build(BuildContext context) {
    final q = _listQueryCtrl.text.trim().toLowerCase();
    final filtered = _list.where((it) {
      if (q.isEmpty) return true;
      final st = it.status == "answered"
          ? "customer.inquiry.status.answered".tr()
          : "customer.inquiry.status.pending".tr();
      return it.title.toLowerCase().contains(q) ||
          it.content.toLowerCase().contains(q) ||
          st.toLowerCase().contains(q);
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
          "customer.inquiry.title".tr(),
          style: const TextStyle(
            color: Color(0xFF1F2937),
            fontWeight: FontWeight.w700,
            fontSize: 18,
          ),
        ),
        bottom: TabBar(
          controller: _tabs,
          labelColor: KroaddyColors.primary,
          unselectedLabelColor: const Color(0xFF6B7280),
          indicatorColor: KroaddyColors.primary,
          tabs: [
            Tab(text: "customer.inquiry.tabs.write".tr()),
            Tab(text: "customer.inquiry.tabs.list".tr()),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabs,
        children: [
          _buildWriteTab(),
          _buildListTab(filtered),
        ],
      ),
    );
  }

  Widget _buildWriteTab() {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        TextField(
          controller: _titleCtrl,
          decoration: InputDecoration(
            labelText: "customer.inquiry.form.subject".tr(),
            hintText: "customer.inquiry.form.subject_placeholder".tr(),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _contentCtrl,
          minLines: 5,
          maxLines: 12,
          decoration: InputDecoration(
            alignLabelWithHint: true,
            labelText: "customer.inquiry.form.content".tr(),
            hintText: "customer.inquiry.form.content_placeholder".tr(),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          "customer.inquiry.form.attachments".tr(),
          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        ),
        const SizedBox(height: 4),
        Text(
          "customer.inquiry.form.attachment_help".tr(),
          style: const TextStyle(fontSize: 11, color: Color(0xFF6B7280)),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: _pickImages,
          icon: const Icon(Icons.add_photo_alternate_outlined, size: 20),
          label: Text("customer.inquiry.form.add_files".tr()),
        ),
        if (_pickedNames.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              _pickedNames.join(", "),
              style: const TextStyle(fontSize: 12, color: Color(0xFF4B5563)),
            ),
          ),
        const SizedBox(height: 16),
        CheckboxListTile(
          value: _agree,
          onChanged: (v) => setState(() => _agree = v ?? false),
          title: Text("customer.inquiry.form.privacy_agree".tr(), style: const TextStyle(fontSize: 13)),
          controlAffinity: ListTileControlAffinity.leading,
          contentPadding: EdgeInsets.zero,
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          style: FilledButton.styleFrom(
            backgroundColor: KroaddyColors.primary,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: Text(_submitting ? "customer.inquiry.form.sending".tr() : "customer.inquiry.form.submit".tr()),
        ),
      ],
    );
  }

  Widget _buildListTab(List<StoredInquiry> filtered) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
          child: TextField(
            controller: _listQueryCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: "customer.inquiry.list.search_label".tr(),
              hintText: "customer.inquiry.list.search_placeholder".tr(),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              prefixIcon: const Icon(Icons.search, size: 20),
            ),
          ),
        ),
        Expanded(
          child: filtered.isEmpty
              ? Center(child: Text("customer.inquiry.list.no_results".tr()))
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                  itemCount: filtered.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (context, i) {
                    final it = filtered[i];
                    final answered = it.status == "answered";
                    return Material(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () => _openDetail(it),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: answered
                                          ? const Color(0xFFDCFCE7)
                                          : const Color(0xFFFEF3C7),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      answered
                                          ? "customer.inquiry.status.answered".tr()
                                          : "customer.inquiry.status.pending".tr(),
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                        color: answered ? const Color(0xFF166534) : const Color(0xFF92400E),
                                      ),
                                    ),
                                  ),
                                  const Spacer(),
                                  Text(
                                    _fmtDate(it.createdAt),
                                    style: const TextStyle(fontSize: 11, color: Color(0xFF9CA3AF)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(
                                it.title,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF1F2937),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                it.content,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }

  void _openDetail(StoredInquiry it) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) {
        return DraggableScrollableSheet(
          expand: false,
          initialChildSize: 0.55,
          minChildSize: 0.35,
          maxChildSize: 0.92,
          builder: (_, scroll) {
            return ListView(
              controller: scroll,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              children: [
                Text(it.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(_fmtDate(it.createdAt), style: const TextStyle(fontSize: 12, color: Color(0xFF9CA3AF))),
                const SizedBox(height: 12),
                Text(it.content, style: const TextStyle(fontSize: 14, height: 1.45)),
                if (it.fileNames.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    it.fileNames.join(", "),
                    style: const TextStyle(fontSize: 12, color: Color(0xFF6B7280)),
                  ),
                ],
                if (it.answer != null && it.answer!.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const Divider(),
                  const SizedBox(height: 8),
                  Text(
                    "customer.inquiry.status.answered".tr(),
                    style: const TextStyle(fontWeight: FontWeight.w700, color: KroaddyColors.primary),
                  ),
                  const SizedBox(height: 6),
                  Text(it.answer!, style: const TextStyle(fontSize: 14, height: 1.45)),
                ],
              ],
            );
          },
        );
      },
    );
  }
}
