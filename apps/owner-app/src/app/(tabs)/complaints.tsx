import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import ComplaintsScreen from "../complaints";

export default function ComplaintsTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.complaints")}>
      <ComplaintsScreen />
    </TabErrorBoundary>
  );
}
