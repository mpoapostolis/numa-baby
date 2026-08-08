(() => {
  const systemDark = matchMedia("(prefers-color-scheme: dark)").matches;
  const apply = (dark) => {
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#120c0f" : "#fdf5f2");
  };
  try {
    const saved = JSON.parse(localStorage.getItem("numa-baby-v1") || "null");
    apply(typeof saved?.nightMode === "boolean" ? saved.nightMode : systemDark);
  } catch {
    // Corrupt/blocked snapshots go to the recovery screen — in the OS theme.
    apply(systemDark);
  }
})();
