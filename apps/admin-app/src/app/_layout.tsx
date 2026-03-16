import { Stack } from "expo-router";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";

// Connect the app to Convex backend
const convex = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!
);

export default function RootLayout() {
  return (
    <ConvexAuthProvider client={convex}>
      <Stack screenOptions={{ headerShown: false }} />
    </ConvexAuthProvider>
  );
}
