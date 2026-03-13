import "../../data/profile_models.dart";

class ProfileState {
  const ProfileState({
    required this.loading,
    required this.saving,
    required this.message,
    required this.userId,
    required this.appUserId,
    required this.user,
    required this.nickname,
    required this.form,
  });

  factory ProfileState.initial() {
    return ProfileState(
      loading: false,
      saving: false,
      message: "프로필 정보를 불러와 주세요.",
      userId: null,
      appUserId: null,
      user: null,
      nickname: "",
      form: ProfileForm.empty(),
    );
  }

  final bool loading;
  final bool saving;
  final String message;
  final int? userId;
  final int? appUserId;
  final UserModel? user;
  final String nickname;
  final ProfileForm form;

  ProfileState copyWith({
    bool? loading,
    bool? saving,
    String? message,
    int? userId,
    int? appUserId,
    UserModel? user,
    String? nickname,
    ProfileForm? form,
    bool clearUser = false,
  }) {
    return ProfileState(
      loading: loading ?? this.loading,
      saving: saving ?? this.saving,
      message: message ?? this.message,
      userId: userId ?? this.userId,
      appUserId: appUserId ?? this.appUserId,
      user: clearUser ? null : (user ?? this.user),
      nickname: nickname ?? this.nickname,
      form: form ?? this.form,
    );
  }
}
