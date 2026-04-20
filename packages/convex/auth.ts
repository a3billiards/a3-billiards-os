import { convexAuth } from "@convex-dev/auth/server";
import { A3Password } from "./passwordProviderA3";
import { A3Google } from "./googleCredentialsProvider";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [A3Password(), A3Google()],
});
