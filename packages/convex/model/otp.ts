// packages/convex/model/otp.ts
// Called from within Convex actions only — never from mutations

function graphRecipientDigits(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) {
    throw new Error("OTP_005: Invalid phone for WhatsApp delivery");
  }
  return digits;
}

function summarizeWhatsAppGraphError(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as {
      error?: {
        error_user_msg?: string;
        error_user_title?: string;
        message?: string;
        code?: number;
        error_subcode?: number;
      };
    };
    const e = parsed.error;
    if (!e) return raw.slice(0, 220);
    const parts = [
      e.error_user_msg,
      e.error_user_title,
      e.message,
      e.code !== undefined ? `code ${e.code}` : undefined,
      e.error_subcode !== undefined ? `sub ${e.error_subcode}` : undefined,
    ].filter(Boolean);
    const s = parts.join(" — ");
    return s.length > 0 ? s.slice(0, 280) : raw.slice(0, 220);
  } catch {
    return raw.slice(0, 280);
  }
}

function shouldRetryTemplateWithoutButton(
  includeAuthButton: boolean,
  status: number,
  raw: string,
): boolean {
  if (!includeAuthButton || status < 400 || status >= 500) return false;
  const t = raw.toLowerCase();
  return (
    t.includes("button") ||
    t.includes("component") ||
    t.includes("parameter") ||
    t.includes("132012") ||
    t.includes("132000") ||
    t.includes("template")
  );
}

/**
 * Sends an approved WhatsApp template message with the OTP.
 *
 * Convex env:
 * - WHATSAPP_PHONE_ID, WHATSAPP_API_TOKEN (required)
 * - WHATSAPP_GRAPH_API_VERSION (optional, default v25.0)
 * - WHATSAPP_OTP_TEMPLATE_NAME (optional, default a3_billiards_otp)
 * - WHATSAPP_OTP_TEMPLATE_LANGUAGE (optional, default en — use en_US if the template locale is US English)
 * - WHATSAPP_OTP_AUTH_BUTTON (optional, default true) — set false only for legacy body-only marketing OTP templates
 *
 * Authentication templates with a "Copy code" button require the same OTP in `body` and in the first button component (sub_type url, index 0). See Meta / Cloud API auth template docs.
 */
export async function dispatchWhatsAppOtp(
  phone: string,
  code: string,
): Promise<void> {
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0";
  const templateName =
    process.env.WHATSAPP_OTP_TEMPLATE_NAME ?? "a3_billiards_otp";
  const languageCode =
    process.env.WHATSAPP_OTP_TEMPLATE_LANGUAGE ?? "en";
  const includeAuthButton =
    (process.env.WHATSAPP_OTP_AUTH_BUTTON ?? "true").toLowerCase() !==
    "false";

  const to = graphRecipientDigits(phone);

  const bodyComponent = {
    type: "body" as const,
    parameters: [{ type: "text" as const, text: code }],
  };

  const buttonComponent = {
    type: "button" as const,
    sub_type: "url" as const,
    index: "0",
    parameters: [{ type: "text" as const, text: code }],
  };

  const phoneId = process.env.WHATSAPP_PHONE_ID;
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!phoneId || !token) {
    throw new Error("OTP_004: WhatsApp is not configured (missing env)");
  }

  type WaComponent =
    | typeof bodyComponent
    | typeof buttonComponent;

  const post = async (components: WaComponent[]) => {
    return await fetch(
      `https://graph.facebook.com/${graphVersion}/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            components,
          },
        }),
      },
    );
  };

  const firstComponents: WaComponent[] = includeAuthButton
    ? [bodyComponent, buttonComponent]
    : [bodyComponent];

  let res = await post(firstComponents);
  let raw = await res.text();

  if (
    !res.ok &&
    shouldRetryTemplateWithoutButton(includeAuthButton, res.status, raw)
  ) {
    res = await post([bodyComponent]);
    raw = await res.text();
  }

  if (!res.ok) {
    const detail = summarizeWhatsAppGraphError(raw);
    console.error("WhatsApp API error:", raw);
    const hint133010 =
      /\b133010\b/.test(raw) || /\b133010\b/.test(detail)
        ? "Your WhatsApp Business number is not registered for Cloud API sending. In Meta for Developers → WhatsApp → API Setup: finish **Register** for this phone (PIN), or use the register endpoint for this Phone Number ID."
        : "";
    throw new Error(
      `OTP_004: WhatsApp — ${detail}${hint133010 ? ` ${hint133010}` : ""}`,
    );
  }
}
