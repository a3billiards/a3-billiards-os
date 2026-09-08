import { Platform } from "react-native";

/** KeyboardAvoidingView props — padding on iOS, height on Android for form screens. */
export const iosKeyboardAvoidingProps = {
  enabled: true,
  behavior: Platform.OS === "ios" ? ("padding" as const) : ("height" as const),
};

/** Prefer "always" so taps / re-renders do not dismiss the keyboard mid-typing. */
export const keyboardScrollDefaults = {
  keyboardShouldPersistTaps: "always" as const,
  keyboardDismissMode: "on-drag" as const,
};
