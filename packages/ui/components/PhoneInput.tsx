import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  ScrollView,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import {
  PHONE_COUNTRY_OPTIONS,
  composeE164,
  findCountryByDialCode,
  parsePhoneParts,
  type PhoneCountryOption,
} from "@a3/utils/phone";
import { colors, typography, radius, spacing } from "../theme";

export type PhoneInputProps = {
  value: string;
  onChangeValue: (e164: string) => void;
  editable?: boolean;
  placeholder?: string;
  inputRef?: React.Ref<TextInput>;
  returnKeyType?: React.ComponentProps<typeof TextInput>["returnKeyType"];
  onSubmitEditing?: () => void;
  accessibilityLabel?: string;
  inputStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  /** Labels from i18n — pass translated strings from the host screen. */
  countryCodeLabel?: string;
  selectCountryLabel?: string;
};

function CountryRow({
  option,
  selected,
  onSelect,
}: {
  option: PhoneCountryOption;
  selected: boolean;
  onSelect: (option: PhoneCountryOption) => void;
}): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.countryRow,
        selected && styles.countryRowSelected,
        pressed && styles.countryRowPressed,
      ]}
      onPress={() => onSelect(option)}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.countryRowText}>
        <Text style={styles.countryName}>{option.name}</Text>
        <Text style={styles.countryDial}>{option.dialCode}</Text>
      </View>
      {selected ? (
        <MaterialIcons name="check" size={20} color={colors.accent.green} />
      ) : null}
    </Pressable>
  );
}

export function PhoneInput({
  value,
  onChangeValue,
  editable = true,
  placeholder,
  inputRef,
  returnKeyType,
  onSubmitEditing,
  accessibilityLabel,
  inputStyle,
  containerStyle,
  countryCodeLabel = "Country code",
  selectCountryLabel = "Select country",
}: PhoneInputProps): React.JSX.Element {
  const parsed = useMemo(() => parsePhoneParts(value), [value]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dialCode, setDialCode] = useState(parsed.dialCode);
  const [national, setNational] = useState(parsed.national);

  useEffect(() => {
    const next = parsePhoneParts(value);
    setDialCode(next.dialCode);
    setNational(next.national);
  }, [value]);

  const country = findCountryByDialCode(dialCode);
  const numberPlaceholder = placeholder ?? country.placeholder;

  const emit = useCallback(
    (nextDial: string, nextNational: string) => {
      setDialCode(nextDial);
      setNational(nextNational);
      onChangeValue(composeE164(nextDial, nextNational));
    },
    [onChangeValue],
  );

  const onSelectCountry = useCallback(
    (option: PhoneCountryOption) => {
      emit(option.dialCode, national);
      setPickerOpen(false);
    },
    [emit, national],
  );

  return (
    <>
      <View style={[styles.row, containerStyle]}>
        <Pressable
          style={({ pressed }) => [
            styles.codeBtn,
            !editable && styles.disabled,
            pressed && editable && styles.codeBtnPressed,
          ]}
          onPress={() => editable && setPickerOpen(true)}
          disabled={!editable}
          accessibilityRole="button"
          accessibilityLabel={countryCodeLabel}
        >
          <Text style={styles.codeText}>{dialCode}</Text>
          <MaterialIcons
            name="arrow-drop-down"
            size={20}
            color={colors.text.secondary}
          />
        </Pressable>
        <TextInput
          ref={inputRef}
          style={[styles.numberInput, inputStyle, !editable && styles.disabled]}
          value={national}
          onChangeText={(text) => {
            const digits = text.replace(/\D/g, "").slice(0, country.maxLength);
            emit(dialCode, digits);
          }}
          placeholder={numberPlaceholder}
          placeholderTextColor={colors.text.tertiary}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? "Phone number"}
        />
      </View>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectCountryLabel}</Text>
              <Pressable onPress={() => setPickerOpen(false)} hitSlop={12}>
                <MaterialIcons
                  name="close"
                  size={24}
                  color={colors.text.secondary}
                />
              </Pressable>
            </View>
            <ScrollView style={styles.sheetList}>
              {PHONE_COUNTRY_OPTIONS.map((option) => (
                <CountryRow
                  key={option.iso}
                  option={option}
                  selected={option.dialCode === dialCode}
                  onSelect={onSelectCountry}
                />
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: spacing[2],
  },
  codeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing[3],
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
  },
  codeBtnPressed: { opacity: 0.85 },
  codeText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: "600",
  },
  numberInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing[3],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.tertiary,
    ...typography.body,
    color: colors.text.primary,
  },
  disabled: { opacity: 0.55 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    maxHeight: "78%",
    paddingBottom: spacing[6],
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  sheetTitle: { ...typography.heading3, color: colors.text.primary },
  sheetList: { paddingHorizontal: spacing[4] },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  countryRowSelected: { backgroundColor: "rgba(76, 175, 80, 0.08)" },
  countryRowPressed: { opacity: 0.85 },
  countryRowText: { flex: 1, gap: 2 },
  countryName: { ...typography.body, color: colors.text.primary },
  countryDial: { ...typography.caption, color: colors.text.secondary },
});
