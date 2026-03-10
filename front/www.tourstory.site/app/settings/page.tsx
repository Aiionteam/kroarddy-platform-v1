"use client";

/**
 * [메모] 설정 페이지: api.tourstory.site gateway 사용자 서비스 연동 확인용
 * - 백엔드: api.tourstory.site/gateway/src/main/java/site/aiion/api/services/user (UserController, UserServiceImpl)
 * - 사용자 정보 조회(R): findUserById → POST /api/users/findById
 * - 닉네임 수정(U): updateUser → PUT /api/users (nickname 필드 반영)
 * - /home 등에서 사이드바 "설정" 클릭 시 이 페이지로 진입. 닉네임 CRUD 동작 여기서 체크.
 */
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLoginStore } from "@/store";
import { getUserIdFromToken, getAppUserIdFromToken } from "@/lib/api/auth";
import { findUserById, updateUser, deleteUser, type UserModel } from "@/lib/api/user";
import {
  upsertUserProfile,
  fetchUserProfile,
  GENDER_OPTIONS,
  AGE_BAND_OPTIONS,
  DIETARY_OPTIONS,
  RELIGION_OPTIONS,
  NATIONALITY_OPTIONS,
} from "@/lib/api/userProfile";
import { AppSidebar } from "@/components/organisms/AppSidebar";

/** 탈퇴 확인 시 사용자에게 입력시키는 문구 (정확히 일치해야 탈퇴 가능) */
const DELETE_ACCOUNT_CONFIRM_TEXT = "Delete account";

type ProfileForm = {
  gender: string;
  age_band: string;
  dietary_pref: string;
  religion: string;
  nationality: string;
};

function ProfileChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
        selected
          ? "border-violet-500 bg-violet-500 text-white shadow-sm"
          : "border-gray-200 bg-white text-gray-600 hover:border-violet-300 hover:text-violet-600"
      }`}
    >
      {label}
    </button>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { isAuthenticated, accessToken, logout } = useLoginStore();
  const [user, setUser] = useState<UserModel | null>(null);
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawConfirmInput, setWithdrawConfirmInput] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  // 여행 프로필
  const [profile, setProfile] = useState<ProfileForm>({ gender: "", age_band: "", dietary_pref: "", religion: "", nationality: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/");
      return;
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    const userId = getUserIdFromToken(accessToken);
    const appUserId = getAppUserIdFromToken(accessToken);
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [userRes, profileRes] = await Promise.all([
          findUserById(Number(userId)),
          appUserId ? fetchUserProfile(appUserId) : Promise.resolve(null),
        ]);
        if (!cancelled && userRes.code === 200 && userRes.data) {
          setUser(userRes.data);
          setNickname(userRes.data.nickname ?? userRes.data.name ?? "");
        }
        if (!cancelled && profileRes) {
          setProfile({
            gender:       profileRes.gender       ?? "",
            age_band:     profileRes.age_band      ?? "",
            dietary_pref: profileRes.dietary_pref  ?? "",
            religion:     profileRes.religion      ?? "",
            nationality:  profileRes.nationality   ?? "",
          });
        }
      } catch (_) {
        if (!cancelled) setMessage({ type: "err", text: "사용자 정보를 불러올 수 없습니다." });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !accessToken) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await updateUser({ ...user, nickname: nickname.trim() || undefined });
      if (res.code === 200) {
        setUser((prev) => (prev ? { ...prev, nickname: nickname.trim() } : null));
        setMessage({ type: "ok", text: "저장되었습니다." });
      } else {
        setMessage({ type: "err", text: res.message || "저장에 실패했습니다." });
      }
    } catch (_) {
      setMessage({ type: "err", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setSaving(false);
    }
  };

  const handleProfileSave = async () => {
    const appUserId = getAppUserIdFromToken(accessToken ?? undefined);
    if (!appUserId) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await upsertUserProfile({
        userId:      appUserId,
        gender:      profile.gender       || undefined,
        ageBand:     profile.age_band     || undefined,
        dietaryPref: profile.dietary_pref || undefined,
        religion:    profile.religion     || undefined,
        nationality: profile.nationality  || undefined,
      });
      setProfileMsg({ type: "ok", text: "여행 프로필이 저장되었습니다." });
    } catch (_) {
      setProfileMsg({ type: "err", text: "저장 중 오류가 발생했습니다." });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleWithdrawOpen = () => {
    setWithdrawConfirmInput("");
    setWithdrawModalOpen(true);
  };

  const handleWithdrawConfirm = async () => {
    if (withdrawConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT || !user?.id) return;
    setWithdrawing(true);
    setMessage(null);
    try {
      const res = await deleteUser({ id: user.id });
      if (res.code === 200) {
        logout();
        router.replace("/");
        return;
      }
      setMessage({ type: "err", text: res.message || "계정 탈퇴에 실패했습니다." });
    } catch (_) {
      setMessage({ type: "err", text: "계정 탈퇴 중 오류가 발생했습니다." });
    } finally {
      setWithdrawing(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      <AppSidebar onLogout={logout} />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-lg space-y-6">
          <h1 className="text-2xl font-bold text-gray-800">설정</h1>
          {loading ? (
            <p className="text-gray-500">로딩 중...</p>
          ) : (
            <>
              {/* 계정 설정 */}
              <form onSubmit={handleSave} className="space-y-4 rounded-xl bg-white p-6 shadow">
                <h2 className="text-base font-semibold text-gray-700">계정 정보</h2>
                <div>
                  <label className="block text-sm font-medium text-gray-700">이메일</label>
                  <p className="mt-1 text-gray-900">{user?.email ?? "-"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">닉네임</label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-purple-500"
                    placeholder={user?.name ? `${user.name} (기본값)` : "닉네임 미입력 시 이름으로 표시"}
                  />
                  <p className="mt-1 text-xs text-gray-500">미입력 시 이름으로 표시됩니다.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">명예도</label>
                  <p className="mt-1 text-gray-900">
                    {user?.honor != null ? `${user.honor} 점` : "0 점"}
                    {user?.tier && (
                      <span className="ml-2 text-purple-600">
                        ({["SILVER", "GOLD", "PLATINUM", "DIAMOND"].indexOf(user.tier) >= 0
                          ? { SILVER: "실버", GOLD: "골드", PLATINUM: "플래티넘", DIAMOND: "다이아" }[user.tier]
                          : user.tier})
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">연동</label>
                  <p className="mt-1 text-gray-900">{user?.provider ?? "-"}</p>
                </div>
                {message && (
                  <p className={message.type === "ok" ? "text-green-600" : "text-red-600"}>{message.text}</p>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:opacity-50"
                >
                  {saving ? "저장 중..." : "저장"}
                </button>

                <div className="mt-8 border-t border-gray-200 pt-6">
                  <p className="mb-2 text-sm font-medium text-gray-700">계정 탈퇴</p>
                  <p className="mb-3 text-xs text-gray-500">탈퇴 시 계정 및 데이터가 삭제되며 복구할 수 없습니다.</p>
                  <button
                    type="button"
                    onClick={handleWithdrawOpen}
                    className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    계정 탈퇴
                  </button>
                </div>
              </form>

              {/* 여행 프로필 */}
              <div className="rounded-xl bg-white p-6 shadow">
                <div className="mb-5 flex items-center gap-2">
                  <span className="text-2xl">🗺️</span>
                  <div>
                    <h2 className="text-base font-semibold text-gray-700">여행 프로필</h2>
                    <p className="text-xs text-gray-400">AI 맞춤 여행 추천에 활용돼요</p>
                  </div>
                </div>

                <div className="space-y-5">
                  {/* 성별 */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-600">성별</p>
                    <div className="flex flex-wrap gap-2">
                      {GENDER_OPTIONS.map((opt) => (
                        <ProfileChip
                          key={opt}
                          label={opt}
                          selected={profile.gender === opt}
                          onClick={() => setProfile((p) => ({ ...p, gender: p.gender === opt ? "" : opt }))}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 나이대 */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-600">나이대</p>
                    <div className="flex flex-wrap gap-2">
                      {AGE_BAND_OPTIONS.map((opt) => (
                        <ProfileChip
                          key={opt}
                          label={opt}
                          selected={profile.age_band === opt}
                          onClick={() => setProfile((p) => ({ ...p, age_band: p.age_band === opt ? "" : opt }))}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 식습관 */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-600">식습관</p>
                    <div className="flex flex-wrap gap-2">
                      {DIETARY_OPTIONS.map((opt) => (
                        <ProfileChip
                          key={opt}
                          label={opt}
                          selected={profile.dietary_pref === opt}
                          onClick={() => setProfile((p) => ({ ...p, dietary_pref: p.dietary_pref === opt ? "" : opt }))}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 종교 */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-600">종교</p>
                    <div className="flex flex-wrap gap-2">
                      {RELIGION_OPTIONS.map((opt) => (
                        <ProfileChip
                          key={opt}
                          label={opt}
                          selected={profile.religion === opt}
                          onClick={() => setProfile((p) => ({ ...p, religion: p.religion === opt ? "" : opt }))}
                        />
                      ))}
                    </div>
                  </div>

                  {/* 국가 */}
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-600">국가 / 국적</p>
                    <div className="flex flex-wrap gap-2">
                      {NATIONALITY_OPTIONS.map((opt) => (
                        <ProfileChip
                          key={opt}
                          label={opt}
                          selected={profile.nationality === opt}
                          onClick={() => setProfile((p) => ({ ...p, nationality: p.nationality === opt ? "" : opt }))}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {profileMsg && (
                  <p className={`mt-4 text-sm ${profileMsg.type === "ok" ? "text-green-600" : "text-red-600"}`}>
                    {profileMsg.text}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="mt-5 rounded-lg bg-violet-500 px-4 py-2 text-white hover:bg-violet-600 disabled:opacity-50"
                >
                  {profileSaving ? "저장 중..." : "여행 프로필 저장"}
                </button>
              </div>
            </>
          )}

          {withdrawModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="withdraw-dialog-title">
              <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
                <h2 id="withdraw-dialog-title" className="mb-2 text-lg font-semibold text-gray-800">계정 탈퇴</h2>
                <p className="mb-4 text-gray-600">정말 탈퇴하시겠습니까? 아래에 <strong>Delete account</strong> 를 입력하면 탈퇴가 진행됩니다.</p>
                <input
                  type="text"
                  value={withdrawConfirmInput}
                  onChange={(e) => setWithdrawConfirmInput(e.target.value)}
                  placeholder="Delete account"
                  className="mb-4 w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-red-500"
                  autoFocus
                  disabled={withdrawing}
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(false)}
                    disabled={withdrawing}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleWithdrawConfirm}
                    disabled={withdrawConfirmInput.trim() !== DELETE_ACCOUNT_CONFIRM_TEXT || withdrawing}
                    className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {withdrawing ? "처리 중..." : "탈퇴하기"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
