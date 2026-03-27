import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password],
});

export default {
  providers: [{
    domain: "https://ardent-albatross-880.convex.site",
    applicationID: "convex",
  }],
};