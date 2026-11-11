// Runs before the page draws, so dark mode never flashes light first.
// A file rather than an inline script, because the site's security policy
// only allows scripts from the site itself.
(function () {
  var saved = null;
  try {
    saved = localStorage.getItem('lt-theme');
  } catch (e) {}
  var theme = saved === 'dark' || saved === 'light' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.dataset.theme = theme;
})();
