// Loading Google's sign-in button, lazily and honestly.
//
// The script is fetched from accounts.google.com ONLY when a person opens a
// surface that shows the button — never at boot. Someone who ignores the
// whole feature never talks to Google at all, which is the only version of
// "privacy-first" that means anything.

// Public by design — it names the app to Google, it unlocks nothing.
export const GOOGLE_CLIENT_ID =
  "705272946048-nprhdf7r57ufsvu20hvschnb733oivp2.apps.googleusercontent.com";

type GoogleId = {
  initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

export function loadGoogleId(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google's sign-in script did not initialise"));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Google's sign-in script would not load"));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/** Render the button into `host`; the credential lands in `onCredential`. */
export async function mountGoogleButton(
  host: HTMLElement,
  onCredential: (credential: string) => void,
): Promise<void> {
  const id = await loadGoogleId();
  id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onCredential(r.credential) });
  // Google's iframe paints its own background. In night mode the outline
  // theme is a white sticker on a dark page — filled_black belongs there;
  // outline stays for daylight. (The app toggles .dark on <html>.)
  const dark = document.documentElement.classList.contains("dark");
  id.renderButton(host, {
    type: "standard",
    theme: dark ? "filled_black" : "outline",
    size: "large",
    text: "continue_with",
    width: 280,
  });
}
