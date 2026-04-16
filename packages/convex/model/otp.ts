// packages/convex/model/otp.ts
// Called from within Convex actions only — never from mutations

/**
 * The template `otp_verification` must be approved in Meta Business Manager before use.
 */
export async function dispatchWhatsAppOtp(
  phone: string,
  code: string,
): Promise<void> {
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: "otp_verification", // must be approved in Meta Business Manager
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: code }],
            },
          ],
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("WhatsApp API error:", err);
    throw new Error("OTP_004: WhatsApp API error");
  }
}
