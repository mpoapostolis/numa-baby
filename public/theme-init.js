// First, and outside the try: a reader whose browser runs this is a reader
// the app will load for, so the plain-HTML landing in index.html can stay
// hidden behind the loading screen (the style beside it in <head>). A reader
// without script never gets here and is shown the landing instead.
document.documentElement.classList.add("js");
(() => {
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const apply = (dark) => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#120c0f" : "#fdf5f2");
  };
  try {
    // The theme has its own tiny key (written on every save), so this
    // render-blocking script never has to parse the whole log — megabytes,
    // at a year of entries — to read one boolean. The blob is the fallback
    // for a phone that has not saved since the key existed.
    const theme = localStorage.getItem("numa-baby-theme-v1");
    if (theme === "dark" || theme === "light") {
      apply(theme === "dark");
      return;
    }
    if (theme === "system") {
      apply(systemDark);
      return;
    }
    const saved = JSON.parse(localStorage.getItem("numa-baby-v1") || "null");
    apply(typeof saved?.nightMode === "boolean" ? saved.nightMode : systemDark);
  } catch {
    // Corrupt/blocked snapshots go to the recovery screen — in the OS theme.
    apply(systemDark);
  }
})();
