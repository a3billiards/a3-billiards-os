import React, { Component, Suspense } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { colors, typography, spacing } from "@a3/ui/theme";

/**
 * Defensive wrapper around `react-native-gifted-charts`' BarChart.
 *
 * On Android, `react-native-svg` / gifted-charts can hard-crash the native
 * layer in release builds; React error boundaries do not catch that. We use a
 * simple View-based chart on Android instead.
 *
 * On iOS, we lazy-load gifted-charts and wrap it in an error boundary for JS
 * render failures.
 */

type BarDatum = {
  value: number;
  label?: string;
  frontColor?: string;
};

type AnyProps = Record<string, unknown> & {
  data: readonly BarDatum[];
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

function AndroidSimpleBarChart({
  data,
  maxValue,
  parentWidth,
}: {
  data: readonly BarDatum[];
  maxValue: number;
  parentWidth: number;
}): React.JSX.Element {
  const chartH = 200;
  const safeMax = Number.isFinite(maxValue) && maxValue > 0 ? maxValue : 1;
  const n = data.length;
  const gap = 4;
  const innerW = Math.max(1, parentWidth - gap * 2);
  const barW = Math.max(
    6,
    Math.min(22, (innerW - gap * Math.max(n - 1, 0)) / Math.max(n, 1)),
  );

  return (
    <View style={{ width: parentWidth, minHeight: chartH }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          height: chartH - 32,
          gap,
          paddingHorizontal: gap,
          paddingTop: spacing[2],
        }}
      >
        {data.map((d, i) => {
          const h = Math.max(
            4,
            (Math.max(0, d.value) / safeMax) * (chartH - 48),
          );
          const bg =
            typeof d.frontColor === "string" && d.frontColor.length > 0
              ? d.frontColor
              : colors.accent.green;
          return (
            <View key={i} style={{ width: barW, alignItems: "center" }}>
              <View
                style={{
                  width: "100%",
                  height: h,
                  backgroundColor: bg,
                  borderRadius: 4,
                }}
              />
            </View>
          );
        })}
      </View>
      <View
        style={{
          flexDirection: "row",
          marginTop: spacing[2],
          gap,
          paddingHorizontal: gap,
        }}
      >
        {data.map((d, i) => (
          <View key={`lbl-${i}`} style={{ width: barW, alignItems: "center" }}>
            {d.label ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 9,
                  lineHeight: 12,
                  color: colors.text.secondary,
                  textAlign: "center",
                }}
              >
                {d.label}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export interface SafeBarChartProps extends AnyProps {
  height?: number;
  emptyMessage?: string;
  parentWidth?: number;
  maxValue?: number;
}

export function SafeBarChart(props: SafeBarChartProps): React.JSX.Element {
  const {
    emptyMessage,
    height,
    data,
    parentWidth = 300,
    maxValue = 1,
    ...rest
  } = props;

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <ChartFallback
        message={emptyMessage ?? "No data to display for this period."}
      />
    );
  }

  const safeMax =
    Number.isFinite(maxValue) && (maxValue as number) > 0
      ? (maxValue as number)
      : 1;

  if (Platform.OS === "android") {
    return (
      <ChartErrorBoundary
        fallback={<ChartFallback message="Chart unavailable. Please try again." />}
      >
        <AndroidSimpleBarChart
          data={data}
          maxValue={safeMax}
          parentWidth={parentWidth}
        />
      </ChartErrorBoundary>
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
        <LazyBarChart
          {...(rest as AnyProps)}
          data={data}
          maxValue={safeMax}
          parentWidth={parentWidth}
        />
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
