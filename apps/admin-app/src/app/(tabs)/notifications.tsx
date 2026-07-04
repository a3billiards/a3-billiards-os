import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import NotificationsScreen from "../notifications";

export default function NotificationsTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.notifications")}>
      <NotificationsScreen />
    </TabErrorBoundary>
  );
}
