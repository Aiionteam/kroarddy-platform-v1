"use client";

import React from "react";
import { Button } from "../atoms/Button";
import { Icon } from "../atoms/Icon";

export const GoogleLoginButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <Button variant="google" onClick={onClick}>
    <Icon name="google" size={20} />
    <span>Continue with Google</span>
  </Button>
);
