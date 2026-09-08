import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { PasscodeGate } from "@a3/ui/components";
import { TabErrorBoundary } from "@a3/ui/errors";
import { colors } from "@a3/ui/theme";
import OwnerSettingsContent from "../components/OwnerSettingsContent";
import { useStaffRole } from "../lib/StaffRoleContext";

function SettingsContent(): React.JSX.Element {
  const router = useRouter();
  const { roleId } = useStaffRole();
  const [unlocked, setUnlocked] = useState(false);
  const verifyPasscode = useAction(api.passcodeActions.verifyPasscode);
  const prevRoleId = useRef(roleId);

  const leaveSettingsForStaff = useCallback(() => {
    setUnlocked(false);
    router.replace("/(tabs)/home");
  }, [router]);

  useEffect(() => {
    if (roleId === undefined) return;
    const prev = prevRoleId.current;
    if (prev !== undefined && prev !== roleId && roleId !== null) {
      leaveSettingsForStaff();
    }
    prevRoleId.current = roleId;
  }, [roleId, leaveSettingsForStaff]);

  useFocusEffect(
    useCallback(() => {
      if (roleId) {
        leaveSettingsForStaff();
      }
    }, [roleId, leaveSettingsForStaff]),
  );

  if (roleId === undefined) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (roleId !== null) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.accent.green} />
        </View>
      </SafeAreaView>
    );
  }

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <PasscodeGate
          verifyPasscode={async (pin) => {
            await verifyPasscode({ passcode: pin });
          }}
          onUnlock={() => setUnlocked(true)}
          onCancel={() => router.replace("/(tabs)/home")}
        />
      </SafeAreaView>
    );
  }

  return <OwnerSettingsContent onStaffRoleHandoff={leaveSettingsForStaff} />;
}

export default function SettingsScreen(): React.JSX.Element {
  return (
    <TabErrorBoundary tabName="Settings">
      <SettingsContent />
    </TabErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
