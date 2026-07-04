import { Modal, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAction, useMutation } from "convex/react";
import { PasscodeGate } from "@a3/ui/components";
import { api } from "@a3/convex/_generated/api";
import type { Id } from "@a3/convex/_generated/dataModel";
import { colors } from "@a3/ui/theme";
import { useTranslation } from "@a3/i18n";
import { setActiveRoleId } from "../lib/activeRoleStorage";
import { useStaffRole } from "../lib/StaffRoleContext";

type OwnerModePasscodeGateProps = {
  visible: boolean;
  clubId: Id<"clubs"> | undefined;
  onCancel: () => void;
  onSuccess?: () => void;
};

export function OwnerModePasscodeGate({
  visible,
  clubId,
  onCancel,
  onSuccess,
}: OwnerModePasscodeGateProps): React.JSX.Element {
  const { t } = useTranslation();
  const verifyPasscode = useAction(api.passcodeActions.verifyPasscode);
  const setActiveRoleMutation = useMutation(api.staffRoles.setActiveRole);
  const { refreshRole } = useStaffRole();

  const switchToOwnerMode = async (): Promise<void> => {
    if (!clubId) return;
    await setActiveRoleMutation({ clubId, roleId: undefined });
    await setActiveRoleId(null);
    refreshRole();
    onSuccess?.();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <PasscodeGate
          title={t("ownerApp.settings.passcode.ownerModeTitle")}
          subtitle={t("ownerApp.settings.passcode.ownerModeSubtitle")}
          verifyPasscode={async (passcode) => {
            await verifyPasscode({ passcode });
          }}
          onUnlock={() => {
            void switchToOwnerMode();
          }}
          onCancel={onCancel}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
});
