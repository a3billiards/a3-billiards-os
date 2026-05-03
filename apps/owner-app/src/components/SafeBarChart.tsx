import React, { Component, Suspense } from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { colors, typography, spacing } from "@a3/ui/theme";

/**
 * Defensive wrapper around `react-native-gifted-charts`' BarChart.
 *
 *  - Lazy import: a native module / ESM resolution failure shows a fallback
 *    instead of crashing the whole financials tab on bundle eval.
 *  - Error boundary: a render-time crash (e.g. malformed data, SVG init) is
 *    caught and replaced with a friendly message.
 *  - Pass-through props: we forward an arbitrary props object so the caller
 *    keeps full control over styling / configuration.
 */

type AnyProps = Record<string, unknown> & {
  data: ReadonlyArray<unknown>;
};

interface BoundaryState {
  hasError: boolean;
}

class ChartErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  BoundaryState
> {
  state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[SafeBarChart] render failed:", error.message);
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

const LazyBarChart = React.lazy(async () => {
  const mod = await import("react-native-gifted-charts");
  return { default: mod.BarChart as unknown as React.ComponentType<AnyProps> };
});

function ChartFallback({ message }: { message: string }): React.JSX.Element {
  return (
    <View style={styles.fallback}>
      <Text style={styles.fallbackText}>{message}</Text>
    </View>
  );
}

export interface SafeBarChartProps extends AnyProps {
  height?: number;
  emptyMessage?: string;
}

export function SafeBarChart(props: SafeBarChartProps): React.JSX.Element {
  const { emptyMessage, height, data, ...rest } = props;

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <ChartFallback
        message={emptyMessage ?? "No data to display for this period."}
      />
    );
  }

  return (
    <ChartErrorBoundary
      fallback={<ChartFallback message="Chart unavailable. Please try again." />}
    >
      <Suspense
        fallback={
          <View style={[styles.loading, height ? { height } : null]}>
            <ActivityIndicator color={colors.accent.green} />
          </View>
        }
      >
        <LazyBarChart {...(rest as AnyProps)} data={data} />
      </Suspense>
    </ChartErrorBoundary>
  );
}

const styles = StyleSheet.create({
  fallback: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing[4],
  },
  fallbackText: {
    ...typography.bodySmall,
    color: colors.text.secondary,
    textAlign: "center",
  },
  loading: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default SafeBarChart;
