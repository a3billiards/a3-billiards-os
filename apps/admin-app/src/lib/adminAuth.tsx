import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@a3/convex/_generated/api";

/** Clears server MFA flag before auth sign-out so the next login requires a fresh code. */
export async function adminSignOut(
  clearMfaSession: () => Promise<unknown>,
  signOut: () => Promise<unknown>,
): Promise<void> {
  try {
    await clearMfaSession();
  } catch {
    // Ignore if session already expired.
  }
  await signOut();
}

type AdminAuthContextValue = {
  isSigningOut: boolean;
  signOutAdmin: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const clearMfaSession = useMutation(api.mfa.clearAdminMfaSession);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setIsSigningOut(false);
    }
  }, [isAuthenticated]);

  const signOutAdmin = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await adminSignOut(() => clearMfaSession({}), signOut);
    } catch {
      setIsSigningOut(false);
    }
  }, [clearMfaSession, isSigningOut, signOut]);

  const value = useMemo(
    () => ({ isSigningOut, signOutAdmin }),
    [isSigningOut, signOutAdmin],
  );

  return (
    <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used within AdminAuthProvider");
  }
  return ctx;
}
