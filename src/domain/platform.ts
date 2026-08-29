/**
 * An iOS home-screen web app, specifically — not just "standalone".
 *
 * The distinction is load-bearing for the move flow. On Android, an installed
 * PWA that navigates to the app's other origin opens a Custom Tab sharing
 * Chrome's storage, so a handoff link works end to end. On iOS the installed
 * app holds its storage in a partition of its own: a cross-origin page opened
 * from inside it writes to a store that neither Safari nor a later install of
 * the new app will ever see. A link "works" — page opens, data transfers —
 * and the entries land in a room with no door. navigator.standalone is
 * iOS-only, which makes it exactly the right test.
 */
export function isIosStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/**
 * Installed anywhere. The move banner hides here entirely — the owner's call,
 * and the right one: inside an installed app there is no one-tap move (on iOS
 * the storage partition makes the link a trap, and on Android the "moved"
 * person still opens the old app from their home screen every day). The
 * browser-tab visitors, whose tap genuinely works, keep the banner.
 */
export function isStandalone(): boolean {
  return isIosStandalone() || window.matchMedia("(display-mode: standalone)").matches;
}
