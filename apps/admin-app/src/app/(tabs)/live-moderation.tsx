import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import AdminLiveModerationScreen from "../../components/AdminLiveModerationScreen";

export default function LiveModerationTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.live-moderation")}>
      <AdminLiveModerationScreen />
    </TabErrorBoundary>
  );
}
