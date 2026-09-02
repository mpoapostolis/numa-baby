// Printing as a document of its own.
//
// The first version printed the dialog in place, with everything else set
// to visibility:hidden. Two things went wrong that no CSS could fix: a
// fixed-position dialog repeats on every printed page, and its vertical
// centring put the first page's content halfway down the paper. So the
// sheet is now written as a complete HTML document into a hidden iframe,
// which prints on its own: one column, flowing from the top, in the app's
// typeface, and nothing of the app around it.

/** Same-origin @font-face rules, so the document prints in the app's face. */
function fontFaces(): string {
  const out: string[] = [];
  const walk = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSFontFaceRule) {
        if (/Geist/i.test(rule.cssText)) out.push(rule.cssText);
      } else if ("cssRules" in rule) {
        walk((rule as CSSGroupingRule).cssRules);
      }
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules);
    } catch {
      // A cross-origin sheet; nothing of ours lives there.
    }
  }
  return out.join("\n");
}

/**
 * Print `body` as its own page. Resolves when the print dialog has closed,
 * or after a minute if the browser never says.
 */
export function printDocument(title: string, body: string, css: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    frame.srcdoc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${fontFaces()}\n${css}</style></head><body>${body}</body></html>`;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      frame.remove();
      resolve();
    };
    frame.onload = () => {
      const win = frame.contentWindow;
      if (!win) return finish();
      win.addEventListener("afterprint", () => window.setTimeout(finish, 100));
      // Fonts first, or the first print of the day goes out in the fallback face.
      const ready = win.document.fonts?.ready ?? Promise.resolve();
      void ready.then(() => {
        win.focus();
        win.print();
        // Some browsers never fire afterprint; do not leave a frame behind.
        window.setTimeout(finish, 60_000);
      });
    };
    document.body.appendChild(frame);
  });
}
