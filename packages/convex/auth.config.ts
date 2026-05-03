/**
 * JWT issuer validation for Convex Auth sessions.
 * `domain` must match the deployment’s `CONVEX_SITE_URL` (built-in on Convex Cloud).
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
