import "package:easy_localization/easy_localization.dart";
import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../core/router/main_shell.dart";
import "../../../core/theme/kroaddy_colors.dart";
import "../data/friend_repository.dart";

// ignore_for_file: avoid_catches_without_on_clauses

const _primary = KroaddyColors.primary;
const _primaryLight = KroaddyColors.brandWash;
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

// ── State provider ────────────────────────────────────────────
final _friendsProvider = FutureProvider<List<FriendInfo>>((ref) {
  return ref.read(friendRepositoryProvider).getFriendList();
});

final _pendingRequestsProvider = FutureProvider<List<FriendRequest>>((ref) {
  return ref.read(friendRepositoryProvider).getPendingRequests();
});

class FriendsPage extends ConsumerStatefulWidget {
  const FriendsPage({super.key});

  @override
  ConsumerState<FriendsPage> createState() => _FriendsPageState();
}

class _FriendsPageState extends ConsumerState<FriendsPage> {
  @override
  Widget build(BuildContext context) {
    final friendsAsync = ref.watch(_friendsProvider);
    final pendingAsync = ref.watch(_pendingRequestsProvider);

    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: Text(
          "sidebar.friends".tr(),
          style: const TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: _textPrimary),
            onPressed: () {
              ref.invalidate(_friendsProvider);
              ref.invalidate(_pendingRequestsProvider);
            },
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // ── 받은 친구 요청 ──────────────────────────────────────
          pendingAsync.when(
            data: (requests) {
              if (requests.isEmpty) return const SizedBox.shrink();
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        "screens.friends.pending_title".tr(),
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          "${requests.length}",
                          style: const TextStyle(fontSize: 11, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ...requests.map((req) => _PendingRequestCard(
                    request: req,
                    onAccept: () async {
                      final ok = await ref.read(friendRepositoryProvider).acceptFriendRequest(req.fromUserId);
                      if (ok) {
                        ref.invalidate(_friendsProvider);
                        ref.invalidate(_pendingRequestsProvider);
                      }
                    },
                  )),
                  const SizedBox(height: 20),
                ],
              );
            },
            loading: () => const SizedBox.shrink(),
            error: (_, _) => const SizedBox.shrink(),
          ),

          // ── 친구 목록 ────────────────────────────────────────────
          Text(
            "screens.friends.list_title".tr(),
            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
          ),
          const SizedBox(height: 10),
          friendsAsync.when(
            data: (friends) {
              if (friends.isEmpty) {
                return Container(
                  padding: const EdgeInsets.symmetric(vertical: 32),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Column(
                    children: [
                      const Icon(Icons.people_outline, size: 48, color: Color(0xFFD1D5DB)),
                      const SizedBox(height: 12),
                      Text(
                        "screens.friends.empty_title".tr(),
                        style: const TextStyle(fontSize: 14, color: Color(0xFF9CA3AF)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        "screens.friends.empty_hint".tr(),
                        style: const TextStyle(fontSize: 12, color: Color(0xFFD1D5DB)),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                );
              }
              return Column(
                children: friends
                    .map((f) => _FriendCard(
                          friend: f,
                          onDelete: () async {
                            final confirmed = await showDialog<bool>(
                              context: context,
                              builder: (_) => AlertDialog(
                                title: Text("screens.friends.delete_dialog_title".tr()),
                                content: Text(
                                  "screens.friends.delete_dialog_body".tr(namedArgs: {"name": f.nickname}),
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () => Navigator.pop(context, false),
                                    child: Text("common.cancel".tr()),
                                  ),
                                  TextButton(
                                    onPressed: () => Navigator.pop(context, true),
                                    child: Text("common.delete".tr(), style: const TextStyle(color: Colors.red)),
                                  ),
                                ],
                              ),
                            );
                            if (confirmed == true) {
                              await ref.read(friendRepositoryProvider).deleteFriend(f.userId);
                              ref.invalidate(_friendsProvider);
                            }
                          },
                        ))
                    .toList(),
              );
            },
            loading: () => const Center(child: CircularProgressIndicator()),
            error: (e, _) => Text(
              "screens.friends.load_error".tr(namedArgs: {"error": "$e"}),
              style: const TextStyle(color: Colors.red),
            ),
          ),

          const SizedBox(height: 20),

          // ── 안내 배너 ────────────────────────────────────────────
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: _primaryLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline, size: 16, color: _primary),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "screens.friends.banner_hint".tr(),
                    style: const TextStyle(fontSize: 12, color: _primary, height: 1.5),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── 받은 요청 카드 ────────────────────────────────────────────
class _PendingRequestCard extends StatelessWidget {
  const _PendingRequestCard({required this.request, required this.onAccept});

  final FriendRequest request;
  final VoidCallback onAccept;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFD8B4FE)),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Row(
        children: [
          _Avatar(nickname: request.nickname, imageUrl: request.profileImageUrl, size: 40),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  request.nickname.isNotEmpty ? request.nickname : "screens.unknown".tr(),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _textPrimary),
                ),
                Text("screens.friends.request_sent".tr(), style: const TextStyle(fontSize: 12, color: _textSecondary)),
              ],
            ),
          ),
          GestureDetector(
            onTap: onAccept,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: _primary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text("screens.friends.accept".tr(), style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }
}

// ── 친구 카드 ────────────────────────────────────────────────
class _FriendCard extends StatelessWidget {
  const _FriendCard({required this.friend, required this.onDelete});

  final FriendInfo friend;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 4, offset: const Offset(0, 1)),
        ],
      ),
      child: Row(
        children: [
          _Avatar(nickname: friend.nickname, imageUrl: friend.profileImageUrl, size: 44),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  friend.nickname.isNotEmpty ? friend.nickname : "screens.unknown".tr(),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: _textPrimary),
                ),
                if (friend.honorScore > 0)
                  Text(
                    "screens.friends.friend_honor".tr(namedArgs: {"score": "${friend.honorScore}"}),
                    style: const TextStyle(fontSize: 12, color: _textSecondary),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(color: _primaryLight, borderRadius: BorderRadius.circular(8)),
            child: Text("screens.friends.badge_friend".tr(), style: const TextStyle(fontSize: 11, color: _primary, fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: 6),
          IconButton(
            icon: const Icon(Icons.person_remove_outlined, size: 20, color: Color(0xFF9CA3AF)),
            onPressed: onDelete,
            tooltip: "screens.friends.delete_tooltip".tr(),
          ),
        ],
      ),
    );
  }
}

// ── 아바타 ────────────────────────────────────────────────────
class _Avatar extends StatelessWidget {
  const _Avatar({required this.nickname, this.imageUrl, this.size = 40});

  final String nickname;
  final String? imageUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final initial = nickname.isNotEmpty ? nickname.substring(0, 1).toUpperCase() : "?";
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        gradient: LinearGradient(colors: [Color(0xFF9333EA), Color(0xFFEC4899)]),
        shape: BoxShape.circle,
      ),
      child: ClipOval(
        child: imageUrl != null && imageUrl!.isNotEmpty
            ? Image.network(imageUrl!, fit: BoxFit.cover,
                errorBuilder: (_, _, _) => Center(child: Text(initial,
                    style: TextStyle(color: Colors.white, fontSize: size * 0.38, fontWeight: FontWeight.bold))))
            : Center(child: Text(initial,
                style: TextStyle(color: Colors.white, fontSize: size * 0.38, fontWeight: FontWeight.bold))),
      ),
    );
  }
}
