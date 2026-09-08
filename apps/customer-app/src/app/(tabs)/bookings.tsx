import { TabErrorBoundary } from "@a3/ui/errors";
import { useTranslation } from "@a3/i18n";
import BookingsScreen from "../bookings";

export default function BookingsTab() {
  const { t } = useTranslation();
  return (
    <TabErrorBoundary tabName={t("common.tabs.customer.bookings")}>
      <BookingsScreen />
    </TabErrorBoundary>
  );
}
