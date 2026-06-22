import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFocusEffect } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { getActiveRoleId } from "./activeRoleStorage";

type StaffRoleContextValue = {
  roleId: Id<"staffRoles"> | null | undefined;
  allowedTabs: string[];
  isOwnerMode: boolean;
  canAccessTab: (tab: string) => boolean;
  refreshRole: () => void;
};

const StaffRoleContext = createContext<StaffRoleContextValue | null>(null);

export function StaffRoleProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [roleId, setRoleId] = useState<Id<"staffRoles"> | null | undefined>(undefined);

  const refreshRole = useCallback(() => {
    void getActiveRoleId().then((v) => {
      setRoleId(v ? (v as Id<"staffRoles">) : null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshRole();
    }, [refreshRole]),
  );

  const access = useQuery(
    api.staffRoles.getActiveStaffTabAccess,
    roleId === undefined ? "skip" : { roleId: roleId ?? undefined },
  );

  const value = useMemo((): StaffRoleContextValue => {
    const allowedTabs = access?.allowedTabs ?? [];
    const isOwnerMode = access?.isOwnerMode ?? roleId === null;
    return {
      roleId,
      allowedTabs,
      isOwnerMode,
      canAccessTab: (tab: string) => {
        if (roleId === undefined || access === undefined) return false;
        if (isOwnerMode) return true;
        return allowedTabs.includes(tab);
      },
      refreshRole,
    };
  }, [access, roleId, refreshRole]);

  return (
    <StaffRoleContext.Provider value={value}>{children}</StaffRoleContext.Provider>
  );
}

export function useStaffRole(): StaffRoleContextValue {
  const ctx = useContext(StaffRoleContext);
  if (!ctx) {
    throw new Error("useStaffRole must be used within StaffRoleProvider");
  }
  return ctx;
}

/** Convex roleId arg: undefined in owner mode, Id when staff role active. */
export function staffRoleQueryId(
  roleId: Id<"staffRoles"> | null | undefined,
): Id<"staffRoles"> | undefined {
  if (roleId === undefined || roleId === null) return undefined;
  return roleId;
}
