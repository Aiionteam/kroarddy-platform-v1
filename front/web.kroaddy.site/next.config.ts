import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 시 GET /login/callback?token=... 로그에 토큰이 노출되지 않도록 요청 로그 비활성화
  logging: {
    incomingRequests: false,
  },
};

export default nextConfig;
