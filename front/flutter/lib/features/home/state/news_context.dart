import "package:flutter_riverpod/flutter_riverpod.dart";

import "../data/news_repository.dart";

// bool / num / String 혼재 대응 헬퍼 (Python API가 bool로 반환하는 필드 처리)
int? _toInt(dynamic v) {
  if (v == null) return null;
  if (v is bool) return v ? 1 : 0;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString());
}

double? _toDouble(dynamic v) {
  if (v == null) return null;
  if (v is bool) return v ? 1.0 : 0.0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

class SlimNewsItem {
  SlimNewsItem({
    required this.id,
    required this.link,
    required this.title,
    required this.summary,
    required this.gptSummary,
    required this.source,
    required this.published,
    required this.thumbnail,
    required this.category,
    required this.location,
    required this.dateMentioned,
    required this.relevanceScore,
    required this.isTop10,
    required this.top10Rank,
  });

  final int id;
  final String link;
  final String title;
  final String summary;
  final String gptSummary;
  final String source;
  final String published;
  final String thumbnail;
  final String category;
  final String location;
  final String? dateMentioned;
  final double relevanceScore;
  final int isTop10;
  final int? top10Rank;

  factory SlimNewsItem.fromJson(Map<String, dynamic> json) {
    return SlimNewsItem(
      id: (json["id"] as num?)?.toInt() ?? 0,
      link: json["link"]?.toString() ?? "",
      title: json["title"]?.toString() ?? "",
      summary: json["summary"]?.toString() ?? "",
      gptSummary: json["gpt_summary"]?.toString() ?? "",
      source: json["source"]?.toString() ?? "",
      published: json["published"]?.toString() ?? "",
      thumbnail: json["thumbnail"]?.toString() ?? "",
      category: json["category"]?.toString() ?? "",
      location: json["location"]?.toString() ?? "",
      dateMentioned: json["date_mentioned"]?.toString(),
      relevanceScore: _toDouble(json["relevance_score"]) ?? 0,
      isTop10: _toInt(json["is_top10"]) ?? 0,
      top10Rank: _toInt(json["top10_rank"]),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      "id": id,
      "link": link,
      "title": title,
      "summary": summary,
      "gpt_summary": gptSummary,
      "source": source,
      "published": published,
      "thumbnail": thumbnail,
      "category": category,
      "location": location,
      "date_mentioned": dateMentioned,
      "relevance_score": relevanceScore,
      "is_top10": isTop10,
      "top10_rank": top10Rank,
    };
  }
}

class NewsContextState {
  const NewsContextState({
    required this.loading,
    required this.items,
    required this.message,
  });

  factory NewsContextState.initial() {
    return const NewsContextState(
      loading: false,
      items: <SlimNewsItem>[],
      message: "",
    );
  }

  final bool loading;
  final List<SlimNewsItem> items;
  final String message;

  NewsContextState copyWith({
    bool? loading,
    List<SlimNewsItem>? items,
    String? message,
  }) {
    return NewsContextState(
      loading: loading ?? this.loading,
      items: items ?? this.items,
      message: message ?? this.message,
    );
  }
}

final newsContextProvider =
    NotifierProvider<NewsContextController, NewsContextState>(
  NewsContextController.new,
);

class NewsContextController extends Notifier<NewsContextState> {
  NewsRepository get _repo => ref.read(newsRepositoryProvider);

  @override
  NewsContextState build() => NewsContextState.initial();

  Future<void> loadTop10() async {
    if (state.loading) return;
    state = state.copyWith(loading: true, message: "뉴스 컨텍스트를 불러오는 중...");
    try {
      final top10 = await _repo.fetchProcessedTop10(limitRest: 0);
      final items = top10.map(SlimNewsItem.fromJson).toList();
      state = state.copyWith(
        loading: false,
        items: items,
        message: items.isEmpty ? "뉴스 컨텍스트 없음" : "뉴스 컨텍스트 ${items.length}건 로드",
      );
    } catch (e) {
      state = state.copyWith(loading: false, message: "뉴스 컨텍스트 로드 실패: $e");
    }
  }
}

