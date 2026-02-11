/*
  Color theme
*/
class ColorThemeToggle extends HTMLElement {
  static storageKey = 'theme';
  static validThemes = new Set(['light', 'dark', 'system']);
  static mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  static mediaBound = false;

  constructor() {
    super();
    this.onClick = this.onClick.bind(this);
    this.onSystemChange = this.onSystemChange.bind(this);
  }

  connectedCallback() {
    this.addEventListener('click', this.onClick);

    if (!ColorThemeToggle.mediaBound) {
      ColorThemeToggle.mediaQuery.addEventListener('change', this.onSystemChange);
      ColorThemeToggle.mediaBound = true;
    }
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.onClick);
  }

  getStoredTheme() {
    try {
      return localStorage.getItem(ColorThemeToggle.storageKey);
    } catch (error) {
      return null;
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem(ColorThemeToggle.storageKey, theme);
    } catch (error) {
      // Ignore storage errors.
    }
  }

  resolveTheme(theme) {
    if (theme === 'system') {
      return ColorThemeToggle.mediaQuery.matches ? 'dark' : 'light';
    }

    return theme;
  }

  applyTheme(theme) {
    if (!ColorThemeToggle.validThemes.has(theme)) {
      return;
    }

    document.documentElement.setAttribute('data-theme', this.resolveTheme(theme));
  }

  onSystemChange() {
    if (this.getStoredTheme() === 'system') {
      this.applyTheme('system');
    }
  }

  onClick(event) {
    var button = event.target.closest('button[data-theme]');
    var theme = null;

    if (!button || !this.contains(button)) {
      return;
    }

    theme = button.getAttribute('data-theme');
    if (!ColorThemeToggle.validThemes.has(theme)) {
      return;
    }

    this.applyTheme(theme);
    this.setStoredTheme(theme);
  }
}
customElements.define('color-theme-toggle', ColorThemeToggle);
