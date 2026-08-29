// The going-out checklist — asked for by a mother of two, for the dads:
// "para din sa dads pag lumabas wala malilimutan" (so nothing gets forgotten
// when the dads take the baby out either).
//
// Ticks are per-device and reset in one tap, because the list is re-packed
// for every outing. This is a memory aid, not a record: nothing here touches
// the activity log, sync, or backups.

import { useState } from "react";
import { RotateCcw, ShoppingBag } from "lucide-react";
import { Button } from "./ui/button";
import { track } from "../domain/analytics";

const KEY = "numalog-outing-v1";

const ITEMS = [
  { id: "nappies", label: "Nappies — one per hour out, plus one" },
  { id: "wipes", label: "Wipes and nappy bags" },
  { id: "mat", label: "Changing mat (a muslin works)" },
  { id: "clothes", label: "Full change of clothes — vest AND outfit" },
  { id: "muslin", label: "A muslin or burp cloth" },
  { id: "feed", label: "One more feed than you think you need" },
  { id: "hat", label: "Hat for the season" },
  { id: "layer", label: "Blanket or extra layer" },
  { id: "dummy", label: "Pacifier + clip, if used" },
  { id: "sanitiser", label: "Hand sanitiser" },
  { id: "you", label: "Your own phone, keys, water" },
] as const;

function readTicks(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function OutingChecklist() {
  const [ticked, setTicked] = useState<string[]>(readTicks);

  function save(next: string[]) {
    setTicked(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // A memory aid that forgets on reload is still a memory aid.
    }
  }

  return (
    <div className="surface-card outing-card">
      <div className="outing-head">
        <span className="outing-icon" aria-hidden="true"><ShoppingBag /></span>
        <div>
          <h2 className="t-title-2">Going out</h2>
          <p className="t-meta">Tick as you pack. Reset before the next outing.</p>
        </div>
        {ticked.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="outing-reset"
            onClick={() => { track("outing_reset"); save([]); }}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reset
          </Button>
        )}
      </div>
      <ul className="outing-list">
        {ITEMS.map((item) => {
          const done = ticked.includes(item.id);
          return (
            <li key={item.id}>
              <label className={done ? "outing-item is-done" : "outing-item"}>
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => save(done ? ticked.filter((t) => t !== item.id) : [...ticked, item.id])}
                />
                <span>{item.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
