import React from "react";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { api } from "@a3/convex/_generated/api";
import { I18nProvider, type AppLocale } from "@a3/i18n";

export function I18nConvexBridge({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const { isAuthenticated } = useConvexAuth();
  const user = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );
  const updatePreferredLocale = useMutation(api.users.updatePreferredLocale);

  const onLocalePersist = React.useCallback(
    async (locale: AppLocale) => {
      await updatePreferredLocale({ locale });
    },
    [updatePreferredLocale],
  );

  return (
    <I18nProvider
      preferredLocale={user?.preferredLocale}
      isAuthenticated={isAuthenticated}
      onLocalePersist={onLocalePersist}
    >
      {children}
    </I18nProvider>
  );
}
