import { Platform } from "react-native";

/** Use on KeyboardAvoidingView — Android pan mode handles the keyboard natively. */
export const iosKeyboardAvoidingProps = {
  enabled: Platform.OS === "ios",
  behavior: Platform.OS === "ios" ? ("padding" as const) : undefined,
};

/** Prefer "always" so taps / re-renders do not dismiss the keyboard mid-typing. */
export const keyboardScrollDefaults = {
  keyboardShouldPersistTaps: "always" as const,
  keyboardDismissMode: "on-drag" as const,
};
