import "package:flutter/material.dart";
import "package:flutter_riverpod/flutter_riverpod.dart";
import "package:go_router/go_router.dart";

import "../../../core/router/main_shell.dart";
import "../data/profile_models.dart";
import "state/profile_controller.dart";
import "state/profile_state.dart";

// ── 색상 상수 ─────────────────────────────────────────────────
const _primary = Color(0xFF7C3AED);
const _primaryLight = Color(0xFFF3E8FF);
const _textPrimary = Color(0xFF1F2937);
const _textSecondary = Color(0xFF6B7280);
const _bgPage = Color(0xFFF8F7FF);

const _tierColors = {
  "SILVER": Color(0xFF9CA3AF),
  "GOLD": Color(0xFFF59E0B),
  "PLATINUM": Color(0xFF06B6D4),
  "DIAMOND": Color(0xFF3B82F6),
};

Color _tierColor(String? tier) => _tierColors[tier?.toUpperCase()] ?? const Color(0xFF9CA3AF);

// ── 진입점 ─────────────────────────────────────────────────────
class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  bool _withdrawModal = false;
  String _withdrawConfirm = "";
  bool _accountSaved = false;
  bool _profileSaved = false;

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(profileControllerProvider);
    final ctrl = ref.read(profileControllerProvider.notifier);

    ref.listen<String>(
      profileControllerProvider.select((s) => s.message),
      (prev, next) {
        if (prev == next) return;
        if (next.contains("완료")) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(next),
              backgroundColor: const Color(0xFF059669),
              behavior: SnackBarBehavior.floating,
            ),
          );
          if (next.contains("계정 정보 저장")) setState(() => _accountSaved = true);
          if (next.contains("여행 프로필 저장")) setState(() => _profileSaved = true);
          if (next.contains("계정 탈퇴")) {
            context.go("/login");
          }
        }
      },
    );

    return Scaffold(
      backgroundColor: _bgPage,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.menu, color: _textPrimary),
          onPressed: () => mainScaffoldKey.currentState?.openDrawer(),
        ),
        title: const Text(
          "설정",
          style: TextStyle(color: _textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            onPressed: () {
              setState(() {
                _accountSaved = false;
                _profileSaved = false;
              });
              ctrl.load();
            },
            icon: const Icon(Icons.refresh, color: _textSecondary, size: 20),
          ),
        ],
      ),
      body: state.loading
          ? const Center(child: CircularProgressIndicator(color: _primary))
          : Stack(
              children: [
                ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    // 헤더 카드
                    _buildHeaderCard(state),
                    const SizedBox(height: 16),

                    // 계정 정보 카드
                    _buildAccountCard(state, ctrl),
                    const SizedBox(height: 16),

                    // 여행 프로필 카드
                    _buildTravelProfileCard(state, ctrl),
                    const SizedBox(height: 16),

                    // 탈퇴 카드
                    _buildWithdrawCard(state),
                    const SizedBox(height: 32),
                  ],
                ),

                // 탈퇴 확인 모달
                if (_withdrawModal)
                  _WithdrawModal(
                    confirm: _withdrawConfirm,
                    onConfirmChanged: (v) => setState(() => _withdrawConfirm = v),
                    onWithdraw: () async {
                      await ctrl.deleteAccount();
                      setState(() {
                        _withdrawModal = false;
                        _withdrawConfirm = "";
                      });
                    },
                    onClose: () => setState(() {
                      _withdrawModal = false;
                      _withdrawConfirm = "";
                    }),
                    enabled: !state.saving,
                  ),
              ],
            ),
    );
  }

  Widget _buildHeaderCard(ProfileState state) {
    final user = state.user;
    final tier = user?.tier?.toUpperCase() ?? "SILVER";
    final tierColor = _tierColor(tier);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [_primary, _primary.withValues(alpha: 0.75)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              (user?.nickname ?? user?.name ?? "?").substring(0, 1).toUpperCase(),
              style: const TextStyle(fontSize: 26, color: Colors.white, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user?.nickname ?? user?.name ?? "사용자",
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  user?.email ?? "",
                  style: TextStyle(fontSize: 12, color: Colors.white.withValues(alpha: 0.8)),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: tierColor.withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: tierColor.withValues(alpha: 0.5)),
                ),
                child: Text(
                  tier,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: tierColor == const Color(0xFF9CA3AF) ? Colors.white : tierColor,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(
                "명예도 ${user?.honor ?? 0}",
                style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.8)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAccountCard(ProfileState state, ProfileController ctrl) {
    return _SectionCard(
      title: "계정 정보",
      icon: Icons.person_outline,
      child: Column(
        children: [
          _ReadOnlyField(label: "이메일", value: state.user?.email ?? "-"),
          const SizedBox(height: 12),
          _EditableNicknameField(
            initial: state.nickname,
            onChanged: ctrl.setNickname,
          ),
          const SizedBox(height: 12),
          _ReadOnlyField(
            label: "소셜 연동",
            value: state.user?.provider ?? "-",
            valueColor: _primary,
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: FilledButton(
                  onPressed: state.saving ? null : ctrl.saveAccount,
                  style: FilledButton.styleFrom(
                    backgroundColor: _accountSaved ? const Color(0xFF059669) : _primary,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      if (_accountSaved)
                        const Icon(Icons.check, size: 16)
                      else if (state.saving)
                        const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      else
                        const Icon(Icons.save_outlined, size: 16),
                      const SizedBox(width: 6),
                      Text(_accountSaved ? "저장 완료" : (state.saving ? "저장 중..." : "저장")),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTravelProfileCard(ProfileState state, ProfileController ctrl) {
    return _SectionCard(
      title: "여행 프로필",
      icon: Icons.flight_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ProfileSection(
            label: "성별",
            options: genderOptions,
            selected: state.form.gender,
            onSelect: (v) {
              setState(() => _profileSaved = false);
              ctrl.setGender(v == state.form.gender ? "" : v);
            },
          ),
          const SizedBox(height: 14),
          _ProfileSection(
            label: "나이대",
            options: ageBandOptions,
            selected: state.form.ageBand,
            onSelect: (v) {
              setState(() => _profileSaved = false);
              ctrl.setAgeBand(v == state.form.ageBand ? "" : v);
            },
          ),
          const SizedBox(height: 14),
          _ProfileSection(
            label: "식습관",
            options: dietaryOptions,
            selected: state.form.dietaryPref,
            onSelect: (v) {
              setState(() => _profileSaved = false);
              ctrl.setDietary(v == state.form.dietaryPref ? "" : v);
            },
          ),
          const SizedBox(height: 14),
          _ProfileSection(
            label: "종교",
            options: religionOptions,
            selected: state.form.religion,
            onSelect: (v) {
              setState(() => _profileSaved = false);
              ctrl.setReligion(v == state.form.religion ? "" : v);
            },
          ),
          const SizedBox(height: 14),
          _ProfileSection(
            label: "국적",
            options: nationalityOptions,
            selected: state.form.nationality,
            onSelect: (v) {
              setState(() => _profileSaved = false);
              ctrl.setNationality(v == state.form.nationality ? "" : v);
            },
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              onPressed: state.saving ? null : ctrl.saveTravelProfile,
              style: FilledButton.styleFrom(
                backgroundColor: _profileSaved ? const Color(0xFF059669) : _primary,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (_profileSaved)
                    const Icon(Icons.check, size: 16)
                  else if (state.saving)
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  else
                    const Icon(Icons.save_outlined, size: 16),
                  const SizedBox(width: 6),
                  Text(_profileSaved ? "저장 완료" : (state.saving ? "저장 중..." : "여행 프로필 저장")),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWithdrawCard(ProfileState state) {
    return _SectionCard(
      title: "계정 관리",
      icon: Icons.manage_accounts_outlined,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "계정을 탈퇴하면 모든 데이터가 삭제되며 복구할 수 없습니다.",
            style: TextStyle(fontSize: 12, color: _textSecondary, height: 1.5),
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: state.saving ? null : () => setState(() => _withdrawModal = true),
              style: OutlinedButton.styleFrom(
                foregroundColor: const Color(0xFFDC2626),
                side: const BorderSide(color: Color(0xFFDC2626)),
              ),
              child: const Text("계정 탈퇴"),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 공통 위젯들
// ═══════════════════════════════════════════════════════════════
class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.title, required this.icon, required this.child});
  final String title;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: _primary),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: _textPrimary),
              ),
            ],
          ),
          const SizedBox(height: 14),
          const Divider(height: 1, color: Color(0xFFF3F4F6)),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }
}

class _ReadOnlyField extends StatelessWidget {
  const _ReadOnlyField({required this.label, required this.value, this.valueColor});
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 80,
          child: Text(
            label,
            style: const TextStyle(fontSize: 13, color: _textSecondary),
          ),
        ),
        Expanded(
          child: Text(
            value,
            style: TextStyle(
              fontSize: 13,
              color: valueColor ?? _textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}

class _EditableNicknameField extends StatefulWidget {
  const _EditableNicknameField({required this.initial, required this.onChanged});
  final String initial;
  final void Function(String) onChanged;

  @override
  State<_EditableNicknameField> createState() => _EditableNicknameFieldState();
}

class _EditableNicknameFieldState extends State<_EditableNicknameField> {
  late TextEditingController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.initial);
  }

  @override
  void didUpdateWidget(_EditableNicknameField old) {
    super.didUpdateWidget(old);
    if (old.initial != widget.initial && _ctrl.text != widget.initial) {
      _ctrl.text = widget.initial;
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const SizedBox(
          width: 80,
          child: Text("닉네임", style: TextStyle(fontSize: 13, color: _textSecondary)),
        ),
        Expanded(
          child: TextField(
            controller: _ctrl,
            onChanged: widget.onChanged,
            style: const TextStyle(fontSize: 13, color: _textPrimary),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: Colors.grey.shade200),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: _primary),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ProfileSection extends StatelessWidget {
  const _ProfileSection({
    required this.label,
    required this.options,
    required this.selected,
    required this.onSelect,
  });
  final String label;
  final List<String> options;
  final String selected;
  final void Function(String) onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, color: _textSecondary, fontWeight: FontWeight.w500),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: options.map((opt) {
            final isSelected = selected == opt;
            return GestureDetector(
              onTap: () => onSelect(opt),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isSelected ? _primary : Colors.white,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: isSelected ? _primary : Colors.grey.shade200,
                  ),
                ),
                child: Text(
                  opt,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected ? Colors.white : _textSecondary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}

// ── 탈퇴 확인 모달 ─────────────────────────────────────────────
class _WithdrawModal extends StatelessWidget {
  const _WithdrawModal({
    required this.confirm,
    required this.onConfirmChanged,
    required this.onWithdraw,
    required this.onClose,
    required this.enabled,
  });
  final String confirm;
  final void Function(String) onConfirmChanged;
  final VoidCallback onWithdraw;
  final VoidCallback onClose;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final canWithdraw = confirm == "Delete account";

    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black54,
        alignment: Alignment.center,
        child: GestureDetector(
          onTap: () {},
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 24),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: const Color(0xFFFEE2E2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.warning_amber, color: Color(0xFFDC2626), size: 20),
                    ),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        "계정 탈퇴",
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFFDC2626),
                        ),
                      ),
                    ),
                    IconButton(
                      onPressed: onClose,
                      icon: const Icon(Icons.close, size: 18, color: _textSecondary),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                const Text(
                  "탈퇴 시 모든 여행 플랜, 프로필, 채팅 내역이\n영구 삭제되며 복구할 수 없습니다.",
                  style: TextStyle(fontSize: 13, color: _textSecondary, height: 1.5),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFEF3C7),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: const Color(0xFFFDE68A)),
                  ),
                  child: const Text(
                    "계속하려면 아래에 'Delete account'를\n정확히 입력해 주세요.",
                    style: TextStyle(fontSize: 12, color: Color(0xFF92400E)),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  onChanged: onConfirmChanged,
                  decoration: InputDecoration(
                    hintText: "Delete account",
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: Color(0xFFDC2626)),
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: onClose,
                        child: const Text("취소"),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton(
                        onPressed: (canWithdraw && enabled) ? onWithdraw : null,
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFFDC2626),
                          disabledBackgroundColor: Colors.grey.shade200,
                        ),
                        child: const Text("탈퇴"),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
