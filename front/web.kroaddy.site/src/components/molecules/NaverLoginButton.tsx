"use client";

import React from "react";
import "@/lib/i18n/config";
import { useTranslation } from "react-i18next";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";

export const NaverLoginButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <Button variant="google" onClick={onClick}>
      <Icon name="naver" size={20} />
      <span>{t("auth.login_naver", { defaultValue: "네이버로 시작하기" })}</span>
    </Button>
  );
};
