(() => {
  try {
    const saved = JSON.parse(localStorage.getItem("numa-baby-v1") || "null");
    const dark = saved?.nightMode === true;
    document.documentElement.classList.toggle("dark", dark);
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", dark ? "#171c1a" : "#f7f7f5");
  } catch {
    // A corrupt or blocked local snapshot is handled by the recovery screen.
  }
})();
