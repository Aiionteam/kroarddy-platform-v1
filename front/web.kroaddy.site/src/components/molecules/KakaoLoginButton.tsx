"use client";

import React from "react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";

export const KakaoLoginButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <Button variant="google" onClick={onClick}>
      <Icon name="kakao" size={20} />
      <span>{t("auth.login_kakao", { defaultValue: "카카오로 시작하기" })}</span>
    </Button>
  );
};
