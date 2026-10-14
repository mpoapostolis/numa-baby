/** @vitest-environment jsdom */
import { expect, test } from "vitest";
import { isToastTarget } from "@/lib/toast";

// A toast — an Undo — can be tapped while a dialog is open. Every dialog
// (ui/dialog.tsx) asks this before treating a tap as "outside" and closing
// under the parent's thumb.

test("a tap on a toast, or anything inside one, is a tap on a toast", () => {
  document.body.innerHTML = `
    <section data-sonner-toaster><ol><li data-sonner-toast><button>Undo</button></li></ol></section>
    <button id="elsewhere">Elsewhere</button>`;
  expect(isToastTarget(document.querySelector("[data-sonner-toast] button"))).toBe(true);
  expect(isToastTarget(document.querySelector("[data-sonner-toaster]"))).toBe(true);
  expect(isToastTarget(document.getElementById("elsewhere"))).toBe(false);
  expect(isToastTarget(null)).toBe(false);
  expect(isToastTarget(window)).toBe(false);
});
