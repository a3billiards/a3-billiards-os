import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import ProfileScreen from "../profile";

export default function ProfileTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.customer.profile")}>
      <ProfileScreen />
    </TabErrorBoundary>
  );
}
