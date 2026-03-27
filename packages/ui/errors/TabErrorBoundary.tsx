declare const __DEV__: boolean;

import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';
import { spacing, radius } from '../theme/spacing';
import { parseConvexError } from './errorCodes';
 
interface Props {
  children: ReactNode;
  tabName: string;  // e.g. "Home", "Tables", "Bookings"
  onError?: (error: Error, info: ErrorInfo) => void;
}
interface State { hasError: boolean; error: Error | null; }
 
export class TabErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
 
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
 
  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.props.onError?.(error, info);
    // TODO Phase 9: Sentry.captureException(error, { tags: { tab: this.props.tabName } })
    if (__DEV__) console.error(`[TabErrorBoundary:${this.props.tabName}]`, error, info);
  }
 
  reset = (): void => this.setState({ hasError: false, error: null });
 
  render(): ReactNode {
    if (!this.state.hasError || !this.state.error) return this.props.children;
    const appError = parseConvexError(this.state.error);
    return (
      <View style={styles.container}>
        <Text style={styles.title}>{this.props.tabName} tab encountered an error</Text>
        <Text style={styles.message}>{appError.message}</Text>
        <Pressable style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }]} onPress={this.reset}
          accessibilityRole="button" accessibilityLabel={`Reload ${this.props.tabName} tab`}>
          <Text style={styles.buttonText}>Reload tab</Text>
        </Pressable>
      </View>
    );
  }
}
 
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary, alignItems: "center", justifyContent: "center", padding: spacing[6] },
  title:     { ...typography.heading4, color: colors.text.primary, marginBottom: spacing[2], textAlign: "center" },
  message:   { ...typography.body, color: colors.text.secondary, textAlign: "center", marginBottom: spacing[6] },
  button:    { backgroundColor: colors.accent.amber, borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[6], minHeight: 44, alignItems: "center", justifyContent: "center" },
  buttonText:{ ...typography.button, color: colors.bg.primary },
});
 
export default TabErrorBoundary;