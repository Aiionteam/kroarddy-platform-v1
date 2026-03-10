import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const useAuthRedirect = (
  isHydrated: boolean,
  isAuthenticated: boolean,
  isProcessingOAuth: boolean,
  redirectTo: string = "/home"
) => {
  const router = useRouter();
  useEffect(() => {
    if (!isHydrated || isProcessingOAuth) return;
    if (isAuthenticated) router.push(redirectTo);
  }, [isHydrated, isAuthenticated, isProcessingOAuth, redirectTo, router]);
};
