import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import AuditScreen from "../audit";

export default function AuditTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.admin.audit")}>
      <AuditScreen />
    </TabErrorBoundary>
  );
}
