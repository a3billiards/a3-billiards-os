import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import HistoryScreen from "../history";

export default function HistoryTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.customer.history")}>
      <HistoryScreen />
    </TabErrorBoundary>
  );
}
