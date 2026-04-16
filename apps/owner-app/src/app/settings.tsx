import { useState } from "react";
import { StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAction } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { PasscodeGate } from "@a3/ui/components";
import { colors } from "@a3/ui/theme";
import OwnerSettingsContent from "../components/OwnerSettingsContent";

export default function SettingsScreen(): React.JSX.Element {
  const router = useRouter();
  const [unlocked, setUnlocked] = useState(false);
  const verifyPasscode = useAction(api.passcodeActions.verifyPasscode);

  if (!unlocked) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <PasscodeGate
          verifyPasscode={async (pin) => {
            await verifyPasscode({ passcode: pin });
          }}
          onUnlock={() => setUnlocked(true)}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  return <OwnerSettingsContent />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
});
