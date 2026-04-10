/// Snackbar / status strings under `screens.profile` (see assets translations).
abstract final class ProfileMessageKeys {
  static const msgInitial = "screens.profile.msg_initial";
  static const msgLoading = "screens.profile.msg_loading";
  static const msgLoaded = "screens.profile.msg_loaded";
  static const msgLoadFailed = "screens.profile.msg_load_failed";

  static const msgNoUserSave = "screens.profile.msg_no_user_save";
  static const msgSavingAccount = "screens.profile.msg_saving_account";
  static const msgAccountSaved = "screens.profile.msg_account_saved";
  static const msgAccountSaveFailed = "screens.profile.msg_account_save_failed";

  static const msgNoAppUser = "screens.profile.msg_no_app_user";
  static const msgSavingTravel = "screens.profile.msg_saving_travel";
  static const msgTravelSaved = "screens.profile.msg_travel_saved";
  static const msgTravelSaveFailed = "screens.profile.msg_travel_save_failed";

  static const msgNoUserId = "screens.profile.msg_no_user_id";
  static const msgDeletingAccount = "screens.profile.msg_deleting_account";
  static const msgAccountDeleted = "screens.profile.msg_account_deleted";
  static const msgDeleteFailed = "screens.profile.msg_delete_failed";

  static const Set<String> successSnackbarKeys = {
    msgAccountSaved,
    msgTravelSaved,
    msgAccountDeleted,
  };
}
