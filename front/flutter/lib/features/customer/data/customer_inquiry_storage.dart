import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

const _prefsKey = "flutter_customer_inquiries";

class StoredInquiry {
  StoredInquiry({
    required this.id,
    required this.title,
    required this.content,
    required this.fileNames,
    required this.agree,
    required this.createdAt,
    required this.status,
    this.answer,
  });

  final String id;
  final String title;
  final String content;
  final List<String> fileNames;
  final bool agree;
  final int createdAt;
  final String status;
  final String? answer;

  Map<String, dynamic> toJson() => {
        "id": id,
        "title": title,
        "content": content,
        "fileNames": fileNames,
        "agree": agree,
        "createdAt": createdAt,
        "status": status,
        if (answer != null) "answer": answer,
      };

  static StoredInquiry fromJson(Map<String, dynamic> m) {
    return StoredInquiry(
      id: "${m["id"] ?? ""}",
      title: "${m["title"] ?? ""}",
      content: "${m["content"] ?? ""}",
      fileNames: (m["fileNames"] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      agree: m["agree"] == true,
      createdAt: (m["createdAt"] as num?)?.toInt() ?? 0,
      status: "${m["status"] ?? "pending"}",
      answer: m["answer"]?.toString(),
    );
  }
}

Future<List<StoredInquiry>> loadInquiries() async {
  final p = await SharedPreferences.getInstance();
  final raw = p.getString(_prefsKey);
  if (raw == null || raw.isEmpty) return [];
  try {
    final list = jsonDecode(raw) as List<dynamic>;
    return list
        .map((e) => StoredInquiry.fromJson(Map<String, dynamic>.from(e as Map)))
        .toList();
  } catch (_) {
    return [];
  }
}

Future<void> saveInquiries(List<StoredInquiry> items) async {
  final p = await SharedPreferences.getInstance();
  await p.setString(
    _prefsKey,
    jsonEncode(items.map((e) => e.toJson()).toList()),
  );
}
