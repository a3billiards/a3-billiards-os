import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { I18nManager } from "react-native";
import * as Localization from "expo-localization";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "@a3/convex/_generated/api";
import {
  type AppLocale,
  isAppLocale,
  resolveDeviceLocale,
  RTL_LOCALES,
} from "./config";
import { ensureI18nInitialized } from "./i18n";
import {
  pickInitialLocale,
  readStoredLocale,
  writeStoredLocale,
} from "./localeStorage";

ensureI18nInitialized();

interface I18nContextValue {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => Promise<void>;
  ready: boolean;
  isRtl: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

async function applyRtl(locale: AppLocale): Promise<void> {
  const shouldRtl = RTL_LOCALES.has(locale);
  if (I18nManager.isRTL === shouldRtl) return;
  I18nManager.allowRTL(shouldRtl);
  I18nManager.forceRTL(shouldRtl);
}

export function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { i18n } = useTranslation();
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const updatePreferredLocale = useMutation(api.users.updatePreferredLocale);

  const deviceLocale = useMemo(() => {
    const locales = Localization.getLocales().map((loc) => ({
      languageTag: loc.languageTag ?? undefined,
      languageCode: loc.languageCode ?? undefined,
    }));
    return resolveDeviceLocale(locales);
  }, []);

  const [ready, setReady] = useState(false);
  const [locale, setLocaleState] = useState<AppLocale>(deviceLocale);
  const bootstrappedRef = useRef(false);
  const userLocaleSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await readStoredLocale();
      const initial = pickInitialLocale(
        stored,
        user?.preferredLocale,
        deviceLocale,
      );
      if (cancelled) return;
      await applyRtl(initial);
      await i18n.changeLanguage(initial);
      setLocaleState(initial);
      setReady(true);
      bootstrappedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [deviceLocale, i18n, user?.preferredLocale]);

  useEffect(() => {
    if (!bootstrappedRef.current) return;
    const preferred = user?.preferredLocale;
    if (!preferred || !isAppLocale(preferred)) return;
    if (userLocaleSyncedRef.current === preferred) return;
    userLocaleSyncedRef.current = preferred;
    if (preferred === locale) return;
    void (async () => {
      await applyRtl(preferred);
      await i18n.changeLanguage(preferred);
      setLocaleState(preferred);
      await writeStoredLocale(preferred);
    })();
  }, [user?.preferredLocale, i18n, locale]);

  const setLocale = useCallback(
    async (next: AppLocale) => {
      await applyRtl(next);
      await i18n.changeLanguage(next);
      setLocaleState(next);
      await writeStoredLocale(next);
      if (isAuthenticated) {
        try {
          await updatePreferredLocale({ locale: next });
        } catch {
          // local preference still applies
        }
      }
    },
    [i18n, isAuthenticated, updatePreferredLocale],
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

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

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
