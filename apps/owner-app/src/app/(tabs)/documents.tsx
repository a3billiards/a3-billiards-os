import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import DocumentsScreen from "../documents";

export default function DocumentsTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.owner.documents")}>
      <DocumentsScreen />
    </TabErrorBoundary>
  );
}
