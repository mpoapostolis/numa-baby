// What "virtual:pwa-register" is under test. The real module is written by
// vite-plugin-pwa at build time, so there is no file for Vite to find; a test
// that needs to drive it replaces this with vi.mock.
export function registerSW(): (reloadPage?: boolean) => Promise<void> {
  return async () => undefined;
}
