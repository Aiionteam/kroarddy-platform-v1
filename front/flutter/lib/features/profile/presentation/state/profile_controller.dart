import "package:flutter_riverpod/flutter_riverpod.dart";

import "../../../../core/locale/locale_from_nationality.dart";
import "../../../../core/preferences/onboarding_prefs.dart";
import "../../data/profile_models.dart";
import "../../data/profile_repository.dart";
import "../profile_message_keys.dart";
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

  void _emitSnackbar(String key, [Map<String, String> params = const {}]) {
    state = state.copyWith(
      notifySeq: state.notifySeq + 1,
      snackbarKey: key,
      snackbarParams: params,
    );
  }

  void clearSnackbar() {
    state = state.copyWith(clearSnackbar: true);
  }

  Future<void> load() async {
    state = state.copyWith(loading: true);
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
      );
      await LocaleFromNationality.apply(
        travel?.nationality ?? "",
        fromSavedProfile: true,
      );
    } catch (e) {
      state = state.copyWith(loading: false);
      _emitSnackbar(ProfileMessageKeys.msgLoadFailed, {"error": "$e"});
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
      _emitSnackbar(ProfileMessageKeys.msgNoUserSave);
      return;
    }
    state = state.copyWith(saving: true);
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
      );
      _emitSnackbar(ProfileMessageKeys.msgAccountSaved);
    } catch (e) {
      state = state.copyWith(saving: false);
      _emitSnackbar(ProfileMessageKeys.msgAccountSaveFailed, {"error": "$e"});
    }
  }

  Future<void> saveTravelProfile() async {
    final appUserId = state.appUserId;
    if (appUserId == null) {
      _emitSnackbar(ProfileMessageKeys.msgNoAppUser);
      return;
    }
    state = state.copyWith(saving: true);
    try {
      await _repo.upsertTravelProfile(appUserId: appUserId, form: state.form);
      await OnboardingPrefs.clearSkipped();
      state = state.copyWith(saving: false);
      _emitSnackbar(ProfileMessageKeys.msgTravelSaved);
    } catch (e) {
      state = state.copyWith(saving: false);
      _emitSnackbar(ProfileMessageKeys.msgTravelSaveFailed, {"error": "$e"});
    }
  }

  Future<void> deleteAccount() async {
    final userId = state.userId;
    if (userId == null) {
      _emitSnackbar(ProfileMessageKeys.msgNoUserId);
      return;
    }
    state = state.copyWith(saving: true);
    try {
      await _repo.deleteUser(userId);
      state = state.copyWith(
        saving: false,
        clearUser: true,
        nickname: "",
        form: ProfileForm.empty(),
      );
      _emitSnackbar(ProfileMessageKeys.msgAccountDeleted);
    } catch (e) {
      state = state.copyWith(saving: false);
      _emitSnackbar(ProfileMessageKeys.msgDeleteFailed, {"error": "$e"});
    }
  }
}
