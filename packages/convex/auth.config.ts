import { convexAuth } from "@convex-dev/auth/server";
import { A3Password } from "./passwordProviderA3";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [A3Password()],
});

export default {
  providers: [{
    domain: "https://ardent-albatross-880.convex.site",
    applicationID: "convex",
  }],
};