import { useEffect } from "react";
import { usePathname, useRouter } from "expo-router";
import { useStaffRole } from "./StaffRoleContext";

/** Keeps staff off Settings and resets navigation when a staff role is active. */
export function StaffRoleNavigationGuard(): null {
  const { roleId } = useStaffRole();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (roleId === undefined || roleId === null) return;
    if (pathname.includes("settings")) {
      router.replace("/(tabs)/home");
    }
  }, [roleId, pathname, router]);

  return null;
}
