import "../../data/profile_models.dart";

class ProfileState {
  const ProfileState({
    required this.loading,
    required this.saving,
    required this.notifySeq,
    required this.snackbarKey,
    required this.snackbarParams,
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
      notifySeq: 0,
      snackbarKey: "",
      snackbarParams: const {},
      userId: null,
      appUserId: null,
      user: null,
      nickname: "",
      form: ProfileForm.empty(),
    );
  }

  final bool loading;
  final bool saving;

  /// Increments whenever a snackbar should be shown ([snackbarKey] non-empty).
  final int notifySeq;
  final String snackbarKey;
  final Map<String, String> snackbarParams;

  final int? userId;
  final int? appUserId;
  final UserModel? user;
  final String nickname;
  final ProfileForm form;

  ProfileState copyWith({
    bool? loading,
    bool? saving,
    int? notifySeq,
    String? snackbarKey,
    Map<String, String>? snackbarParams,
    bool clearSnackbar = false,
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
      notifySeq: notifySeq ?? this.notifySeq,
      snackbarKey: clearSnackbar ? "" : (snackbarKey ?? this.snackbarKey),
      snackbarParams: clearSnackbar ? const {} : (snackbarParams ?? this.snackbarParams),
      userId: userId ?? this.userId,
      appUserId: appUserId ?? this.appUserId,
      user: clearUser ? null : (user ?? this.user),
      nickname: nickname ?? this.nickname,
      form: form ?? this.form,
    );
  }
}
