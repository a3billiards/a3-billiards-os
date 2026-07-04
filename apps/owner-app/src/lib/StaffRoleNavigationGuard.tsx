import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useStaffRole } from "./StaffRoleContext";

const GATED_TAB_ROUTES = [
  "slots",
  "snacks",
  "kitchen",
  // "loyalty",
  "livestream",
  "financials",
  "complaints",
  "bookings",
  "documents",
] as const;

const HIDDEN_TAB_ROUTES = new Set(["gst-report", "loyalty"]);

function tabFromPathname(pathname: string): string | null {
  for (const tab of GATED_TAB_ROUTES) {
    if (pathname.includes(tab)) return tab;
  }
  for (const hidden of HIDDEN_TAB_ROUTES) {
    if (pathname.includes(hidden)) return hidden;
  }
  return null;
}

/** Keeps staff off Settings and unauthorized tab routes when a staff role is active. */
export function StaffRoleNavigationGuard(): null {
  const { roleId, canAccessTab } = useStaffRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (roleId === undefined || roleId === null) return;

    if (pathname.includes("settings")) {
      router.replace("/(tabs)/home");
      return;
    }

    const tab = tabFromPathname(pathname);
    if (!tab) return;

    if (HIDDEN_TAB_ROUTES.has(tab)) {
      const fallback =
        GATED_TAB_ROUTES.find((t) => canAccessTab(t)) ?? "home";
      router.replace(`/(tabs)/${fallback}`);
      return;
    }

    if (!canAccessTab(tab)) {
      const fallback =
        GATED_TAB_ROUTES.find((t) => canAccessTab(t)) ?? "home";
      router.replace(`/(tabs)/${fallback}`);
    }
  }, [roleId, pathname, router, canAccessTab]);

  return null;
}
