import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../data/profile_models.dart";
import "../../data/profile_repository.dart";
import "profile_state.dart";

final profileControllerProvider = NotifierProvider<ProfileController, ProfileState>(
  ProfileController.new,
);

class ProfileController extends Notifier<ProfileState> {
  ProfileRepository get _repo => ref.read(profileRepositoryProvider);

  @override
  ProfileState build() {
    Future<void>.microtask(load);
    return ProfileState.initial();
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, message: "프로필 정보를 불러오는 중...");
    try {
      final ids = await _repo.resolveIds();
      final user = await _repo.findUserById(ids.$1);
      final travel = await _repo.fetchTravelProfile(ids.$2);
      state = state.copyWith(
        loading: false,
        userId: ids.$1,
        appUserId: ids.$2,
        user: user,
        nickname: user?.nickname ?? user?.name ?? "",
        form: ProfileForm(
          gender: travel?.gender ?? "",
          ageBand: travel?.ageBand ?? "",
          dietaryPref: travel?.dietaryPref ?? "",
          religion: travel?.religion ?? "",
          nationality: travel?.nationality ?? "",
        ),
        message: "프로필 정보를 불러왔습니다.",
      );
    } catch (e) {
      state = state.copyWith(
        loading: false,
        message: "프로필 조회 실패: $e",
      );
    }
  }

  void setNickname(String value) {
    state = state.copyWith(nickname: value);
  }

  void setGender(String value) {
    state = state.copyWith(form: state.form.copyWith(gender: value));
  }

  void setAgeBand(String value) {
    state = state.copyWith(form: state.form.copyWith(ageBand: value));
  }

  void setDietary(String value) {
    state = state.copyWith(form: state.form.copyWith(dietaryPref: value));
  }

  void setReligion(String value) {
    state = state.copyWith(form: state.form.copyWith(religion: value));
  }

  void setNationality(String value) {
    state = state.copyWith(form: state.form.copyWith(nationality: value));
  }

  Future<void> saveAccount() async {
    final user = state.user;
    if (user == null) {
      state = state.copyWith(message: "사용자 정보가 없어 저장할 수 없습니다.");
      return;
    }
    state = state.copyWith(saving: true, message: "계정 정보를 저장하는 중...");
    try {
      await _repo.updateNickname(baseUser: user, nickname: state.nickname);
      state = state.copyWith(
        saving: false,
        user: UserModel(
          id: user.id,
          name: user.name,
          email: user.email,
          nickname: state.nickname.trim(),
          provider: user.provider,
          honor: user.honor,
          tier: user.tier,
        ),
        message: "계정 정보 저장 완료",
      );
    } catch (e) {
      state = state.copyWith(saving: false, message: "계정 정보 저장 실패: $e");
    }
  }

  Future<void> saveTravelProfile() async {
    final appUserId = state.appUserId;
    if (appUserId == null) {
      state = state.copyWith(message: "앱 사용자 ID를 확인할 수 없습니다.");
      return;
    }
    state = state.copyWith(saving: true, message: "여행 프로필 저장 중...");
    try {
      await _repo.upsertTravelProfile(appUserId: appUserId, form: state.form);
      state = state.copyWith(saving: false, message: "여행 프로필 저장 완료");
    } catch (e) {
      state = state.copyWith(saving: false, message: "여행 프로필 저장 실패: $e");
    }
  }

  Future<void> deleteAccount() async {
    final userId = state.userId;
    if (userId == null) {
      state = state.copyWith(message: "사용자 ID를 확인할 수 없습니다.");
      return;
    }
    state = state.copyWith(saving: true, message: "계정 탈퇴 처리 중...");
    try {
      await _repo.deleteUser(userId);
      state = state.copyWith(
        saving: false,
        clearUser: true,
        nickname: "",
        form: ProfileForm.empty(),
        message: "계정 탈퇴 완료",
      );
    } catch (e) {
      state = state.copyWith(saving: false, message: "계정 탈퇴 실패: $e");
    }
  }
}
