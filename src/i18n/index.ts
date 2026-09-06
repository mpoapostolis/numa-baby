// Two languages, one rule: the English in the code IS the key.
//
// Components say t("Log the first feed"), and for English that call costs
// almost nothing — the string was already in the bundle, t() finds no
// dictionary and hands it straight back. Greek is a dictionary from those
// English sentences to Greek ones, loaded as its own lazy chunk only on a
// phone that asked for it. So the shell pays a few bytes per call site and
// nothing per language, which is what lets the bundle budget survive this.
//
// The other thing English-as-key buys is the failure mode: a sentence nobody
// translated yet appears in English, not as a bare "today.greeting.morning"
// key — embarrassing beats broken, and a γιαγιά shown one English line can
// still hand the phone back; one shown a dotted identifier cannot.
//
// The rules that keep it working:
//   • t() is called at RENDER time, never at module top level. The dictionary
//     is loaded before the first render (initLocale in main.tsx), but module
//     bodies evaluate before that — a top-level t() call is always English.
//   • Sentences are translated WHOLE, with {name}-style holes, never glued
//     from fragments. Greek word order is not English word order.
//   • Plural branches stay in the code (`n === 1 ? "1 phone" : "{n} phones"`),
//     which works because Greek pluralises on the same one/other rule as
//     English. A language that does not will need more than this file.
//
// Changing an English sentence in a component orphans its Greek entry — the
// UI falls back to English rather than crashing, and tests/unit/i18n.test.ts
// fails loudly on entries whose keys no longer appear anywhere in src/.

export type Locale = "en" | "el";
export type LanguageChoice = "system" | Locale;

const KEY = "numalog-lang-v1";

let dict: Record<string, string> | null = null;
let locale: Locale = "en";

/** Translate one sentence. `vars` fills {name}-style holes AFTER lookup, so
    the dictionary key never contains anyone's data. */
export function t(text: string, vars?: Record<string, string | number>): string {
  let out = dict?.[text] ?? text;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) out = out.replaceAll(`{${name}}`, String(value));
  }
  return out;
}

export function currentLocale(): Locale {
  return locale;
}

/** What the person chose, as distinct from what they got: "system" until
    they touch the setting. */
export function languageChoice(): LanguageChoice {
  try {
    const stored = window.localStorage.getItem(KEY);
    return stored === "en" || stored === "el" ? stored : "system";
  } catch {
    return "system";
  }
}

function wantedLocale(): Locale {
  const choice = languageChoice();
  if (choice !== "system") return choice;
  const spoken = (navigator.languages ?? [navigator.language ?? ""]).map((l) => l.toLowerCase());
  return spoken.some((l) => l.startsWith("el")) ? "el" : "en";
}

/**
 * Awaited in main.tsx before the first render. For English this resolves
 * immediately; for Greek it imports the dictionary chunk, which the service
 * worker precaches, so it is instant offline too. If the import fails anyway
 * — a first-ever visit on a dying connection — the app renders in English
 * rather than not rendering.
 */
export async function initLocale(): Promise<void> {
  if (wantedLocale() !== "el") return;
  try {
    dict = (await import("./el")).default;
    locale = "el";
    document.documentElement.lang = "el";
  } catch {
    // English beats blank.
  }
}

/**
 * An age from formatBabyAge — "3 days", "almost 2 weeks", "1 month",
 * "2 years 6 months" — rendered the way the sentence around it needs.
 *
 * The domain keeps returning English (its output is compared and tested),
 * and Greek does not want those words translated one-for-one anyway: inside
 * «Η Μία είναι …» the age goes to the GENITIVE — «5 εβδομάδων», «ενός μήνα»
 * — which no word-by-word dictionary produces. So the handful of shapes the
 * domain can emit are rewritten here as shapes.
 */
export function tAge(age: string): string {
  if (locale !== "el") return age;
  const genitive = (n: number, unit: string): string => {
    if (unit.startsWith("day")) return n === 1 ? "μίας ημέρας" : `${n} ημερών`;
    if (unit.startsWith("week")) return n === 1 ? "μίας εβδομάδας" : `${n} εβδομάδων`;
    if (unit.startsWith("month")) return n === 1 ? "ενός μήνα" : `${n} μηνών`;
    if (unit.startsWith("year")) return n === 1 ? "ενός χρόνου" : `${n} χρονών`;
    return `${n} ${unit}`;
  };
  const both = age.match(/^(\d+) years? (\d+) months?$/);
  if (both) return `${genitive(Number(both[1]), "year")} και ${genitive(Number(both[2]), "month")}`;
  const almost = age.match(/^almost (\d+) weeks$/);
  if (almost) return `σχεδόν ${genitive(Number(almost[1]), "week")}`;
  const plain = age.match(/^(\d+) (day|days|week|weeks|month|months|year|years)$/);
  if (plain) return genitive(Number(plain[1]), plain[2]);
  return age;
}

/**
 * A name as the SUBJECT of a sentence. Greek puts the article in front —
 * «Η Σεραφίνα είναι…» — and the article has a gender, which the profile
 * sometimes knows. When it does not, the bare name is the least wrong thing.
 *
 * Only ever the subject. After a preposition Greek wants the accusative —
 * «για τη Σεραφίνα», «για τον Νίκο» — which declines the NAME as well as the
 * article, and no lookup table can do that for a name it has never seen. So
 * sentences that would need it are written to put the name in front instead.
 */
export function tName(name: string, sex?: "girl" | "boy"): string {
  if (locale !== "el" || !name) return name;
  if (sex === "girl") return `Η ${name}`;
  if (sex === "boy") return `Ο ${name}`;
  return name;
}

/** Store the choice and reload. A reload, deliberately: the language reaches
    into every module, and one honest reload on a once-ever action beats
    threading a context through the entire tree to avoid it. */
export function setLanguageChoice(choice: LanguageChoice): void {
  try {
    if (choice === "system") window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, choice);
  } catch {
    // Storage blocked: the reload will fall back to the phone's language.
  }
  window.location.reload();
}
