import React, { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import {
  CUSTOM_TABLE_TYPE_ID,
  PREDEFINED_TABLE_TYPES,
  normalizeTableTypeId,
} from "@a3/utils/tableTypes";
import { colors, typography, spacing, radius } from "../theme";

export type TableTypeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  customPlaceholder?: string;
};

export function TableTypeSelect({
  value,
  onChange,
  disabled,
  customPlaceholder = "Custom type name",
}: TableTypeSelectProps): React.JSX.Element {
  const normalized = normalizeTableTypeId(value);
  const isPreset = PREDEFINED_TABLE_TYPES.some((t) => t.id === normalized);
  const [mode, setMode] = useState<"preset" | "custom">(
    value && !isPreset ? "custom" : "preset",
  );

  const selectedPreset = useMemo(() => {
    if (!normalized || !isPreset) return null;
    return normalized;
  }, [isPreset, normalized]);

  return (
    <View style={styles.wrap}>
      <View style={styles.chipRow}>
        {PREDEFINED_TABLE_TYPES.map((type) => {
          const on = mode === "preset" && selectedPreset === type.id;
          return (
            <Pressable
              key={type.id}
              disabled={disabled}
              onPress={() => {
                setMode("preset");
                onChange(type.id);
              }}
              style={[styles.chip, on && styles.chipOn]}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{type.label}</Text>
            </Pressable>
          );
        })}
        <Pressable
          disabled={disabled}
          onPress={() => {
            setMode("custom");
            if (isPreset) onChange("");
          }}
          style={[styles.chip, mode === "custom" && styles.chipOn]}
        >
          <Text style={[styles.chipText, mode === "custom" && styles.chipTextOn]}>Custom</Text>
        </Pressable>
      </View>
      {mode === "custom" ? (
        <TextInput
          style={styles.input}
          value={mode === "custom" && !isPreset ? value : ""}
          onChangeText={onChange}
          placeholder={customPlaceholder}
          placeholderTextColor={colors.text.tertiary}
          editable={!disabled}
          autoCapitalize="words"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing[2] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing[2] },
  chip: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    backgroundColor: colors.bg.secondary,
  },
  chipOn: {
    borderColor: colors.accent.green,
    backgroundColor: "rgba(67,160,71,0.12)",
  },
  chipText: { ...typography.labelSmall, color: colors.text.secondary },
  chipTextOn: { color: colors.accent.green, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    color: colors.text.primary,
    backgroundColor: colors.bg.secondary,
    ...typography.body,
  },
});

export { CUSTOM_TABLE_TYPE_ID };
