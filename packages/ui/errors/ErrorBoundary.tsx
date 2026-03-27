declare const __DEV__: boolean;

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { parseConvexError } from './errorCodes';
 
interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, info: ErrorInfo) => void;
}
interface State { hasError: boolean; error: Error | null; }
 
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
 
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
 
  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // TODO Phase 9: Sentry.captureException(error, { extra: info })
    if (__DEV__) console.error("[ErrorBoundary]", error, info);
  }
 
  reset = (): void => this.setState({ hasError: false, error: null });
 
  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
 
    const appError = parseConvexError(this.state.error);
    return (
      <View style={styles.container}>
        <Text style={styles.icon} accessibilityRole="image" accessibilityLabel="Error">⚠️</Text>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>{appError.message}</Text>
        {__DEV__ && (
          <ScrollView style={styles.devScroll}>
            <Text style={styles.devStack}>{this.state.error.stack}</Text>
          </ScrollView>
        )}
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          onPress={this.reset}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }
}
 
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: colors.bg.primary, alignItems: "center", justifyContent: "center", padding: spacing[6] },
  icon:         { fontSize: 48, marginBottom: spacing[4] },
  title:        { ...typography.heading3, color: colors.text.primary, marginBottom: spacing[2], textAlign: "center" },
  message:      { ...typography.body, color: colors.text.secondary, textAlign: "center", marginBottom: spacing[6] },
  devScroll:    { maxHeight: 200, width: "100%", backgroundColor: colors.bg.tertiary, borderRadius: radius.md, padding: spacing[3], marginBottom: spacing[4] },
  devStack:     { ...typography.mono, fontSize: 10, color: colors.status.error },
  button:       { backgroundColor: colors.accent.green, borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[8], minHeight: 44, alignItems: "center", justifyContent: "center" },
  buttonPressed:{ opacity: 0.8 },
  buttonText:   { ...typography.button, color: colors.bg.primary },
});
 
export default ErrorBoundary;