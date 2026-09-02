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
    const saved = JSON.parse(localStorage.getItem("numa-baby-v1") || "null");
    apply(typeof saved?.nightMode === "boolean" ? saved.nightMode : systemDark);
  } catch {
    // Corrupt/blocked snapshots go to the recovery screen — in the OS theme.
    apply(systemDark);
  }
})();
