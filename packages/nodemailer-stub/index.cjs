/** Stub so Convex V8 bundler never pulls real nodemailer (Node-only). Email uses Resend in actions. */
function createTransport() {
  return {
    sendMail: async () => ({ messageId: "noop" }),
    verify: async () => true,
    close: () => {},
  };
}

module.exports = { createTransport };
