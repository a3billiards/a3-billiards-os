import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import DiscoverScreen from "../discover";

export default function DiscoverTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.customer.discover")}>
      <DiscoverScreen />
    </TabErrorBoundary>
  );
}
