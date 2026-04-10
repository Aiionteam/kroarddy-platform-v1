# -*- coding: utf-8 -*-
"""Localized screens.profile.msg_* for non-English locale files."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "assets" / "translations"

JA = {
    "msg_initial": "更新でプロフィールを読み込んでください。",
    "msg_loading": "プロフィールを読み込み中…",
    "msg_loaded": "プロフィールを読み込みました。",
    "msg_load_failed": "プロフィールを読み込めませんでした: {error}",
    "msg_no_user_save": "保存できるユーザー情報がありません。",
    "msg_saving_account": "アカウント情報を保存中…",
    "msg_account_saved": "アカウント情報を保存しました。",
    "msg_account_save_failed": "アカウント情報を保存できませんでした: {error}",
    "msg_no_app_user": "アプリユーザーIDを確認できません。",
    "msg_saving_travel": "旅行プロフィールを保存中…",
    "msg_travel_saved": "旅行プロフィールを保存しました。",
    "msg_travel_save_failed": "旅行プロフィールを保存できませんでした: {error}",
    "msg_no_user_id": "ユーザーIDを確認できません。",
    "msg_deleting_account": "アカウントを削除中…",
    "msg_account_deleted": "アカウントを削除しました。",
    "msg_delete_failed": "アカウントを削除できませんでした: {error}",
}

ZH = {
    "msg_initial": "下拉或点刷新以加载资料。",
    "msg_loading": "正在加载资料…",
    "msg_loaded": "资料已加载。",
    "msg_load_failed": "无法加载资料：{error}",
    "msg_no_user_save": "没有可保存的用户信息。",
    "msg_saving_account": "正在保存账户…",
    "msg_account_saved": "账户已保存。",
    "msg_account_save_failed": "无法保存账户：{error}",
    "msg_no_app_user": "无法解析应用用户 ID。",
    "msg_saving_travel": "正在保存旅行资料…",
    "msg_travel_saved": "旅行资料已保存。",
    "msg_travel_save_failed": "无法保存旅行资料：{error}",
    "msg_no_user_id": "无法解析用户 ID。",
    "msg_deleting_account": "正在删除账户…",
    "msg_account_deleted": "账户已删除。",
    "msg_delete_failed": "无法删除账户：{error}",
}

VI = {
    "msg_initial": "Kéo xuống hoặc nhấn làm mới để tải hồ sơ.",
    "msg_loading": "Đang tải hồ sơ…",
    "msg_loaded": "Đã tải hồ sơ.",
    "msg_load_failed": "Không tải được hồ sơ: {error}",
    "msg_no_user_save": "Không có thông tin người dùng để lưu.",
    "msg_saving_account": "Đang lưu tài khoản…",
    "msg_account_saved": "Đã lưu tài khoản.",
    "msg_account_save_failed": "Không lưu được tài khoản: {error}",
    "msg_no_app_user": "Không xác định được ID người dùng ứng dụng.",
    "msg_saving_travel": "Đang lưu hồ sơ du lịch…",
    "msg_travel_saved": "Đã lưu hồ sơ du lịch.",
    "msg_travel_save_failed": "Không lưu được hồ sơ du lịch: {error}",
    "msg_no_user_id": "Không xác định được ID người dùng.",
    "msg_deleting_account": "Đang xóa tài khoản…",
    "msg_account_deleted": "Đã xóa tài khoản.",
    "msg_delete_failed": "Không xóa được tài khoản: {error}",
}

TH = {
    "msg_initial": "ดึงลงหรือแตะรีเฟรชเพื่อโหลดโปรไฟล์",
    "msg_loading": "กำลังโหลดโปรไฟล์…",
    "msg_loaded": "โหลดโปรไฟล์แล้ว",
    "msg_load_failed": "โหลดโปรไฟล์ไม่สำเร็จ: {error}",
    "msg_no_user_save": "ไม่มีข้อมูลผู้ใช้ให้บันทึก",
    "msg_saving_account": "กำลังบันทึกบัญชี…",
    "msg_account_saved": "บันทึกบัญชีแล้ว",
    "msg_account_save_failed": "บันทึกบัญชีไม่สำเร็จ: {error}",
    "msg_no_app_user": "ไม่พบรหัสผู้ใช้แอป",
    "msg_saving_travel": "กำลังบันทึกโปรไฟล์ทริป…",
    "msg_travel_saved": "บันทึกโปรไฟล์ทริปแล้ว",
    "msg_travel_save_failed": "บันทึกโปรไฟล์ทริปไม่สำเร็จ: {error}",
    "msg_no_user_id": "ไม่พบรหัสผู้ใช้",
    "msg_deleting_account": "กำลังลบบัญชี…",
    "msg_account_deleted": "ลบบัญชีแล้ว",
    "msg_delete_failed": "ลบบัญชีไม่สำเร็จ: {error}",
}

ID = {
    "msg_initial": "Tarik ke bawah atau ketuk segarkan untuk memuat profil.",
    "msg_loading": "Memuat profil…",
    "msg_loaded": "Profil dimuat.",
    "msg_load_failed": "Tidak dapat memuat profil: {error}",
    "msg_no_user_save": "Tidak ada informasi pengguna untuk disimpan.",
    "msg_saving_account": "Menyimpan akun…",
    "msg_account_saved": "Akun disimpan.",
    "msg_account_save_failed": "Tidak dapat menyimpan akun: {error}",
    "msg_no_app_user": "Tidak dapat menemukan ID pengguna aplikasi.",
    "msg_saving_travel": "Menyimpan profil perjalanan…",
    "msg_travel_saved": "Profil perjalanan disimpan.",
    "msg_travel_save_failed": "Tidak dapat menyimpan profil perjalanan: {error}",
    "msg_no_user_id": "Tidak dapat menemukan ID pengguna.",
    "msg_deleting_account": "Menghapus akun…",
    "msg_account_deleted": "Akun dihapus.",
    "msg_delete_failed": "Tidak dapat menghapus akun: {error}",
}

HI = {
    "msg_initial": "प्रोफ़ाइल लोड करने के लिए रीफ़्रेश करें।",
    "msg_loading": "प्रोफ़ाइल लोड हो रही है…",
    "msg_loaded": "प्रोफ़ाइल लोड हो गई।",
    "msg_load_failed": "प्रोफ़ाइल लोड नहीं हो सकी: {error}",
    "msg_no_user_save": "सहेजने के लिए उपयोगकर्ता जानकारी नहीं है।",
    "msg_saving_account": "खाता सहेजा जा रहा है…",
    "msg_account_saved": "खाता सहेजा गया।",
    "msg_account_save_failed": "खाता सहेजा नहीं जा सका: {error}",
    "msg_no_app_user": "ऐप उपयोगकर्ता ID मिल नहीं सका।",
    "msg_saving_travel": "यात्रा प्रोफ़ाइल सहेजी जा रही है…",
    "msg_travel_saved": "यात्रा प्रोफ़ाइल सहेजी गई।",
    "msg_travel_save_failed": "यात्रा प्रोफ़ाइल सहेजी नहीं जा सकी: {error}",
    "msg_no_user_id": "उपयोगकर्ता ID मिल नहीं सका।",
    "msg_deleting_account": "खाता हटाया जा रहा है…",
    "msg_account_deleted": "खाता हटा दिया गया।",
    "msg_delete_failed": "खाता नहीं हटाया जा सका: {error}",
}

DE = {
    "msg_initial": "Zum Laden des Profils nach unten ziehen oder aktualisieren.",
    "msg_loading": "Profil wird geladen…",
    "msg_loaded": "Profil geladen.",
    "msg_load_failed": "Profil konnte nicht geladen werden: {error}",
    "msg_no_user_save": "Keine Benutzerdaten zum Speichern.",
    "msg_saving_account": "Konto wird gespeichert…",
    "msg_account_saved": "Konto gespeichert.",
    "msg_account_save_failed": "Konto konnte nicht gespeichert werden: {error}",
    "msg_no_app_user": "App-Benutzer-ID nicht gefunden.",
    "msg_saving_travel": "Reiseprofil wird gespeichert…",
    "msg_travel_saved": "Reiseprofil gespeichert.",
    "msg_travel_save_failed": "Reiseprofil konnte nicht gespeichert werden: {error}",
    "msg_no_user_id": "Benutzer-ID nicht gefunden.",
    "msg_deleting_account": "Konto wird gelöscht…",
    "msg_account_deleted": "Konto gelöscht.",
    "msg_delete_failed": "Konto konnte nicht gelöscht werden: {error}",
}

FR = {
    "msg_initial": "Tirez pour actualiser ou appuyez sur rafraîchir pour charger le profil.",
    "msg_loading": "Chargement du profil…",
    "msg_loaded": "Profil chargé.",
    "msg_load_failed": "Impossible de charger le profil : {error}",
    "msg_no_user_save": "Aucune information utilisateur à enregistrer.",
    "msg_saving_account": "Enregistrement du compte…",
    "msg_account_saved": "Compte enregistré.",
    "msg_account_save_failed": "Impossible d’enregistrer le compte : {error}",
    "msg_no_app_user": "ID utilisateur de l’app introuvable.",
    "msg_saving_travel": "Enregistrement du profil voyage…",
    "msg_travel_saved": "Profil voyage enregistré.",
    "msg_travel_save_failed": "Impossible d’enregistrer le profil voyage : {error}",
    "msg_no_user_id": "ID utilisateur introuvable.",
    "msg_deleting_account": "Suppression du compte…",
    "msg_account_deleted": "Compte supprimé.",
    "msg_delete_failed": "Impossible de supprimer le compte : {error}",
}

LOCALES = {
    "ja.json": JA,
    "zh.json": ZH,
    "vi.json": VI,
    "th.json": TH,
    "id.json": ID,
    "hi.json": HI,
    "de.json": DE,
    "fr.json": FR,
}


def main() -> None:
    for fname, patch in LOCALES.items():
        path = ROOT / fname
        data = json.loads(path.read_text(encoding="utf-8"))
        prof = data.setdefault("screens", {}).setdefault("profile", {})
        for k, v in patch.items():
            prof[k] = v
        path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("patched profile msgs", fname)


if __name__ == "__main__":
    main()
