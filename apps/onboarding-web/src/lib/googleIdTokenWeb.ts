/**
 * Google Identity Services (web) → ID token for Convex `signIn("googleOwner", { idToken })`.
 */

type CredentialResponse = { credential?: string };

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
    ux_mode?: "popup" | "redirect";
  }) => void;
  prompt: (
    momentListener?: (notification: {
      isNotDisplayed: () => boolean;
      isSkippedMoment: () => boolean;
      isDismissedMoment: () => boolean;
      getNotDisplayedReason?: () => string;
      getSkippedReason?: () => string;
    }) => void,
  ) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      logo_alignment?: string;
      width?: number;
      ux_mode?: "popup" | "redirect";
    },
  ) => void;
  cancel: () => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleAccountsId } };
  }
}

let gisLoadPromise: Promise<GoogleAccountsId> | null = null;

function loadGis(): Promise<GoogleAccountsId> {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google.accounts.id);
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-a3-gis="1"]',
    );
    if (existing) {
      existing.addEventListener("load", () => {
        const id = window.google?.accounts?.id;
        if (id) resolve(id);
        else reject(new Error("Google Sign-In failed to load."));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Google Sign-In failed to load.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.a3Gis = "1";
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google Sign-In failed to load."));
    };
    script.onerror = () => reject(new Error("Google Sign-In failed to load."));
    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

/**
 * Opens Google sign-in (One Tap / FedCM, then popup button fallback) and
 * returns a Google ID token JWT.
 */
export async function requestGoogleIdToken(clientId: string): Promise<string> {
  const trimmed = clientId.trim();
  if (!trimmed) {
    throw new Error("Google Sign-In is not configured.");
  }

  const gis = await loadGis();

  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const finish = (err: Error | null, token?: string) => {
      if (settled) return;
      settled = true;
      try {
        gis.cancel();
      } catch {
        /* ignore */
      }
      host?.remove();
      if (err) reject(err);
      else resolve(token!);
    };

    let host: HTMLDivElement | null = null;

    gis.initialize({
      client_id: trimmed,
      callback: (response) => {
        if (response.credential) finish(null, response.credential);
        else finish(new Error("Google sign-in failed."));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: "signin",
      ux_mode: "popup",
    });

    gis.prompt((notification) => {
      if (settled) return;
      const blocked =
        notification.isNotDisplayed() ||
        notification.isSkippedMoment() ||
        notification.isDismissedMoment();
      if (!blocked) return;

      // Fallback: visible Google button in a small modal-like strip (popup ux).
      host = document.createElement("div");
      host.className = "auth-google-fallback";
      host.innerHTML =
        '<p class="auth-google-fallback-label">Continue with Google</p>';
      const btnHost = document.createElement("div");
      host.appendChild(btnHost);
      const close = document.createElement("button");
      close.type = "button";
      close.className = "auth-google-fallback-close";
      close.textContent = "Cancel";
      close.addEventListener("click", () =>
        finish(new Error("Google sign-in was cancelled.")),
      );
      host.appendChild(close);
      document.body.appendChild(host);

      gis.renderButton(btnHost, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: 320,
        ux_mode: "popup",
      });
    });

    window.setTimeout(() => {
      if (!settled) finish(new Error("Google sign-in timed out."));
    }, 120_000);
  });
}
