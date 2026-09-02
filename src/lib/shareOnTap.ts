// The share machinery, fetched when somebody actually taps share.
//
// The canvas renderer and every card builder together are a few kilobytes of
// drawing code that the app shell used to carry on the first open — for three
// buttons on Today that most parents will not press today. Loaded on the tap
// instead: the sheet takes a frame longer to appear and the app opens sooner
// for everybody.

import type { CardSpec } from "../domain/shareCards";
import { toast } from "./toast";

/**
 * Build the card, draw it, and hand it to the share sheet. `build` is called
 * only after the card modules have arrived, so the caller's own imports stay
 * out of the shell too.
 */
export async function shareCardOnTap(
  build: (cards: typeof import("../domain/shareCards")) => CardSpec,
  fileName: string,
  text: string,
): Promise<void> {
  try {
    const [cards, canvas] = await Promise.all([
      import("../domain/shareCards"),
      import("./shareCard"),
    ]);
    const blob = await canvas.renderCard(build(cards));
    const outcome = await canvas.shareImage(blob, fileName, text);
    if (outcome === "saved") toast("Picture saved to your device");
  } catch {
    toast("Could not make the picture on this phone");
  }
}
