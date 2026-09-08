import { View, Text } from "react-native";
import { useTranslation } from "@a3/i18n";

export default function Screen() {
  const { t } = useTranslation();
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>{t("common.phase9Placeholder")}</Text>
    </View>
  );
}
