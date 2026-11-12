// Set the theme and language before first paint so a dark-mode user never sees
// a white flash. A first visit defaults to dark (keep in step with
// ThemeProvider's readStored). A file rather than an inline script, so the
// Content-Security-Policy can forbid inline scripts (QA issue 13).
document.documentElement.setAttribute("data-theme", "dark");
(function () {
  try {
    var m = localStorage.getItem("esap.theme") || "dark";
    if (m === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", m);
    // Arabic applies only on the localised routes (see src/i18n LOCALISED_PREFIXES).
    var localised = /^\/(patient|welcome|login|signup|invite|reset-password|privacy|terms)(\/|$)/.test(location.pathname);
    if (localised && localStorage.getItem("esap.lang") === "ar") {
      document.documentElement.setAttribute("lang", "ar");
      document.documentElement.setAttribute("dir", "rtl");
    }
  } catch (e) {}
})();
