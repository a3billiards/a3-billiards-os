import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import {
  type AppLocale,
  isAppLocale,
  RTL_LOCALES,
} from "./config";
import { applyAppLocale } from "./applyAppLocale";
import { readDeviceLocale } from "./deviceLocale";
import { ensureI18nInitialized } from "./i18n";
import {
  pickInitialLocale,
  readStoredLocale,
} from "./localeStorage";
ensureI18nInitialized();

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  ready: boolean;
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export interface I18nProviderProps {
  children: React.ReactNode;
  preferredLocale?: string | null;
  isAuthenticated?: boolean;
  onLocalePersist?: (locale: AppLocale) => Promise<void>;
}

export function I18nProvider({
  children,
  preferredLocale,
  isAuthenticated = false,
  onLocalePersist,
}: I18nProviderProps): React.JSX.Element {
  const { i18n } = useTranslation();
  const deviceLocale = useMemo(() => readDeviceLocale(), []);

  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale);
  const bootstrappedRef = useRef(false);
  const userLocaleSyncedRef = useRef<string | null>(null);
  const userOverrideRef = useRef(false);

  useEffect(() => {
    if (bootstrappedRef.current) return;
    let cancelled = false;
    void (async () => {
      const stored = await readStoredLocale();
      const initial = pickInitialLocale(
        stored,
        preferredLocale,
        deviceLocale,
      );
      if (cancelled) return;
      await applyAppLocale(initial, i18n);
      setLocaleState(initial);
      setReady(true);
      bootstrappedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceLocale, i18n]);

  useEffect(() => {
    if (!bootstrappedRef.current || userOverrideRef.current) return;
    if (!preferredLocale || !isAppLocale(preferredLocale)) return;
    if (userLocaleSyncedRef.current === preferredLocale) return;
    userLocaleSyncedRef.current = preferredLocale;
    if (preferredLocale === locale) return;
    void (async () => {
      await applyAppLocale(preferredLocale, i18n);
      setLocaleState(preferredLocale);
    })();
  }, [preferredLocale, i18n, locale]);

  const setLocale = useCallback(
    async (next: AppLocale) => {
      userOverrideRef.current = true;
      userLocaleSyncedRef.current = next;
      await applyAppLocale(next, i18n);
      setLocaleState(next);
      if (isAuthenticated && onLocalePersist) {
        try {
          await onLocalePersist(next);
        } catch {
          // local preference still applies
        }
      }
    },
    [i18n, isAuthenticated, onLocalePersist],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      ready,
      isRtl: RTL_LOCALES.has(locale),
    }),
    [locale, ready, setLocale],
  );

  return (
    <I18nContext.Provider value={value}>
      {ready ? (
        // No `key={locale}` here: react-i18next's `useTranslation()` already
        // re-renders every consumer on language change via the "languageChanged"
        // event. Remounting on locale change previously reset the entire
        // navigation stack (and all in-flight screens) on every language switch.
        <View
          style={[
            styles.root,
            // Text direction only. Full layout mirroring (forceRTL) is handled in applyAppLocale
            // and requires an app restart to take effect.
            { direction: RTL_LOCALES.has(locale) ? "rtl" : "ltr" },
          ]}
        >
          {children}
        </View>
      ) : null}
    </I18nContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

export function useAppLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useAppLocale must be used within I18nProvider");
  }
  return ctx;
}

/** Safe hook when provider may be absent (e.g. config error screen). */
export function useAppLocaleOptional(): I18nContextValue | null {
  return useContext(I18nContext);
}
