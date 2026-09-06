// Telling a Greek-speaking parent that the app now speaks Greek.
//
// English is the default for every phone (see i18n/index.ts), so a Greek
// family that opens the app sees English and has no reason to go looking in
// Settings for a language card they do not know exists. This is the one
// place the phone's own language is read: not to decide anything, but to
// decide whom to ask.
//
//   • Only a phone that reports Greek. To everyone else the banner would be
//     a sentence in a script they cannot read, on their first day.
//   • Only while the app is still in English. Once they have switched — by
//     this banner, the first screen, or Settings — there is nothing to say.
//   • Once. "Not now" is an answer: this is an offer, not a reminder, and an
//     offer that comes back is a nag.

export type LanguageNudgeInput = {
  /** navigator.languages includes Greek. */
  phoneSpeaksGreek: boolean;
  /** The app is currently rendering in English. */
  inEnglish: boolean;
  /** Ever dismissed, on this phone. */
  dismissed: boolean;
};

export function languageNudge(input: LanguageNudgeInput): boolean {
  if (!input.phoneSpeaksGreek) return false;
  if (!input.inEnglish) return false;
  if (input.dismissed) return false;
  return true;
}
