// "Continue with the account you used last time."
//
// A device-local memory of HOW this person last proved themselves — google,
// or which email address — so the next protect or restore starts from a
// familiar door instead of a cold menu. Local only, best-effort, worthless
// to an attacker (knowing an address unlocks nothing; the inbox or the
// Google session is still the key), and gone whenever the person clears the
// app — which is exactly the moment Google's own button takes over, since
// the browser's Google session survives app data.

export type AuthHint = { method: "google" | "email"; email?: string };

const KEY = "numalog-auth-hint-v1";

export function saveAuthHint(hint: AuthHint) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(hint));
  } catch {
    // A hint is a courtesy.
  }
}

export function loadAuthHint(): AuthHint | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { method?: unknown; email?: unknown };
    if (parsed.method !== "google" && parsed.method !== "email") return null;
    const email = typeof parsed.email === "string" && parsed.email.includes("@") ? parsed.email : undefined;
    return { method: parsed.method, email };
  } catch {
    return null;
  }
}
