// Counting doses, for the vaccine form. Its own module, off the boot path:
// Today needs only the due-date words in vaccines.ts.

const ORDINAL = /^(\d+)(st|nd|rd|th)\b/i;

function ordinal(n: number) {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** The dose after "2nd dose" is "3rd dose" — counting, not advice: no
    interval, no schedule. Anything not numbered gives nothing. */
export function nextDose(dose: string | undefined): string {
  const match = dose ? ORDINAL.exec(dose.trim()) : null;
  return match ? `${ordinal(Number(match[1]) + 1)} dose` : "";
}
