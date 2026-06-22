import React from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { iosKeyboardAvoidingProps, keyboardScrollDefaults } from "../theme/keyboard";

type Props = ScrollViewProps & {
  avoidStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
};

/** Form screen wrapper: iOS keyboard padding + scroll that keeps focus while typing. */
export function KeyboardFormScroll({
  children,
  avoidStyle,
  keyboardVerticalOffset,
  contentContainerStyle,
  style,
  ...rest
}: Props): React.JSX.Element {
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1 }, avoidStyle]}
      {...iosKeyboardAvoidingProps}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={style}
        contentContainerStyle={contentContainerStyle}
        {...keyboardScrollDefaults}
        {...rest}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** iOS-only wrapper for modals / non-scroll forms. */
export function KeyboardAvoidIos({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.JSX.Element {
  return (
    <KeyboardAvoidingView style={style} {...iosKeyboardAvoidingProps}>
      {children}
    </KeyboardAvoidingView>
  );
}

export { iosKeyboardAvoidingProps, keyboardScrollDefaults };
