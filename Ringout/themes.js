'use strict';

const themeChoices = [...document.querySelectorAll('#themeMenu [data-theme]')];
const themeCookie = 'ringout_theme_v1';

function applyMenuTheme(name, save = false) {
  const selected = themeChoices.find(button => button.dataset.theme === name) || themeChoices[0];
  if (!selected) return;
  const theme = selected.dataset.theme;
  document.documentElement.dataset.menuTheme = theme;
  for (const button of themeChoices) button.setAttribute('aria-pressed', button === selected);
  if (save) {
    try { document.cookie = themeCookie + '=' + theme + '; Max-Age=31536000; Path=/; SameSite=Strict'; }
    catch { /* The theme still applies during this visit. */ }
  }
}

try {
  const prefix = themeCookie + '=';
  const saved = document.cookie.split(';').map(cookie => cookie.trim()).find(cookie => cookie.startsWith(prefix));
  applyMenuTheme(saved?.slice(prefix.length));
} catch {
  applyMenuTheme('arcade');
}

for (const button of themeChoices) button.addEventListener('click', () => applyMenuTheme(button.dataset.theme,true));
