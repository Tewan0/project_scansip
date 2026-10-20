export const THEME_STORAGE_KEY = "scansip-theme";

// Apply the saved theme before paint, avoiding a white flash on dark pages.
export const themeInitScript = `(function(){
  var theme;
  try { theme = localStorage.getItem('${THEME_STORAGE_KEY}'); } catch (_) {}
  var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
})();`;
