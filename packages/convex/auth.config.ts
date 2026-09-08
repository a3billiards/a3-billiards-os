/**
 * JWT issuer validation for Convex Auth **session tokens** (issuer / JWKS).
 * `domain` must match the deployment’s `CONVEX_SITE_URL` (built-in on Convex Cloud).
 *
 * OAuth-style provider ids such as `google`, `googleOwner`, and `password` are
 * registered in `auth.ts` via `convexAuth({ providers: [...] })` — not in this file.
 */
const domain = process.env.CONVEX_SITE_URL;
if (domain === undefined || domain.length === 0) {
  throw new Error("CONVEX_SITE_URL is required in auth.config.ts");
}

export default {
  providers: [
    {
      domain,
      applicationID: "convex",
    },
  ],
};
