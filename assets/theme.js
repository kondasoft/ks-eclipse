/*
  Theme copyright
*/
console.info('KS Eclipse theme by KondaSoft (https://kondasoft.com)');

/*
  External HTTP links
*/
function decorateHttpsLinks() {
  document.querySelectorAll('a[href*="https://"]').forEach((link) => {
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
}
decorateHttpsLinks();

/*
  Footer collapse state
*/
function initFooterCollapseState() {
  var mobileQuery = window.matchMedia('(max-width: 599px)');

  function syncFooterDetailsState(isMobile) {
    document.querySelectorAll('#footer .theme-collapse-details').forEach((details) => {
      if (isMobile) {
        details.removeAttribute('open');
        return;
      }

      details.setAttribute('open', '');
    });
  }

  syncFooterDetailsState(mobileQuery.matches);
  mobileQuery.addEventListener('change', (event) => {
    syncFooterDetailsState(event.matches);
  });
}
initFooterCollapseState();

/*
  Menu collapse state
*/
function initMenuCollapseState() {
  var menuDialog = document.getElementById('menu-dialog');

  if (!menuDialog) {
    return;
  }

  function getToggleTarget(button) {
    var linkGroup = button.closest('.nav-link-group');
    var target = null;

    if (!linkGroup || !(linkGroup.nextElementSibling instanceof HTMLElement)) {
      return null;
    }

    target = linkGroup.nextElementSibling;
    if (!target.classList.contains('nav-list-sub')) {
      return null;
    }

    return target;
  }

  function setExpanded(button, expanded) {
    var target = getToggleTarget(button);

    button.setAttribute('aria-expanded', String(expanded));
    if (target) {
      target.hidden = !expanded;
    }
  }

  function collapseItemAndDescendants(item) {
    item.querySelectorAll('[data-menu-toggle]').forEach((button) => {
      setExpanded(button, false);
    });
  }

  function handleMenuToggle(toggle) {
    var isExpanded = false;
    var currentItem = null;
    var parentList = null;

    currentItem = toggle.closest('.nav-item');
    parentList = currentItem ? currentItem.parentElement : null;
    if (!currentItem || !parentList) {
      return;
    }

    isExpanded = toggle.getAttribute('aria-expanded') === 'true';

    if (isExpanded) {
      collapseItemAndDescendants(currentItem);
      return;
    }

    for (var i = 0; i < parentList.children.length; i += 1) {
      var sibling = parentList.children[i];

      if (sibling === currentItem) {
        continue;
      }

      collapseItemAndDescendants(sibling);
    }

    setExpanded(toggle, true);
  }

  menuDialog.addEventListener('click', (event) => {
    var toggle = event.target.closest('[data-menu-toggle]');

    if (!toggle || !menuDialog.contains(toggle) || !getToggleTarget(toggle)) {
      return;
    }

    handleMenuToggle(toggle);
  });
}
initMenuCollapseState();

/*
  Color scheme toggle
*/
class ColorSchemeToggle extends HTMLElement {
  static storageKey = 'theme';
  static validThemes = new Set(['light', 'dark', 'system']);
  static mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  static mediaBound = false;
  static instanceCount = 0;

  constructor() {
    super();
    this.groupName = '';
    this.onChange = this.onChange.bind(this);
    this.onSystemChange = this.onSystemChange.bind(this);
  }

  connectedCallback() {
    var initialTheme = null;

    ColorSchemeToggle.instanceCount += 1;
    this.groupName = 'theme-toggle-' + ColorSchemeToggle.instanceCount;
    initialTheme = this.getInitialTheme();
    this.assignGroupName();
    this.syncCheckedState(initialTheme);
    this.applyTheme(initialTheme);
    this.addEventListener('change', this.onChange);

    if (!ColorSchemeToggle.mediaBound) {
      ColorSchemeToggle.mediaQuery.addEventListener('change', this.onSystemChange);
      ColorSchemeToggle.mediaBound = true;
    }
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.onChange);
  }

  getStoredTheme() {
    try {
      return localStorage.getItem(ColorSchemeToggle.storageKey);
    } catch (error) {
      return null;
    }
  }

  setStoredTheme(theme) {
    try {
      localStorage.setItem(ColorSchemeToggle.storageKey, theme);
    } catch (error) {
      // Ignore storage errors.
    }
  }

  resolveTheme(theme) {
    if (theme === 'system') {
      return ColorSchemeToggle.mediaQuery.matches ? 'dark' : 'light';
    }

    return theme;
  }

  applyTheme(theme) {
    if (!ColorSchemeToggle.validThemes.has(theme)) {
      return;
    }

    document.documentElement.setAttribute('data-theme', this.resolveTheme(theme));
  }

  getInitialTheme() {
    var storedTheme = this.getStoredTheme();
    var defaultTheme = document.documentElement.getAttribute('data-default-theme');
    var documentTheme = document.documentElement.getAttribute('data-theme');

    if (ColorSchemeToggle.validThemes.has(storedTheme)) {
      return storedTheme;
    }

    if (ColorSchemeToggle.validThemes.has(defaultTheme)) {
      return defaultTheme;
    }

    if (documentTheme === 'light' || documentTheme === 'dark') {
      return documentTheme;
    }

    return 'light';
  }

  assignGroupName() {
    this.querySelectorAll('input[data-theme-option]').forEach((input) => {
      input.name = this.groupName;
    });
  }

  syncCheckedState(theme) {
    this.querySelectorAll('input[data-theme-option]').forEach((input) => {
      input.checked = input.value === theme;
    });
  }

  static syncAll(theme) {
    document.querySelectorAll('theme-color-toggle').forEach((toggle) => {
      if (typeof toggle.syncCheckedState === 'function') {
        toggle.syncCheckedState(theme);
      }
    });
  }

  onSystemChange() {
    if (this.getStoredTheme() === 'system') {
      this.applyTheme('system');
      ColorSchemeToggle.syncAll('system');
    }
  }

  onChange(event) {
    var radio = event.target.closest('input[data-theme-option]');
    var theme = null;

    if (!radio || !this.contains(radio) || !radio.checked) {
      return;
    }

    theme = radio.value;
    if (!ColorSchemeToggle.validThemes.has(theme)) {
      return;
    }

    this.applyTheme(theme);
    this.setStoredTheme(theme);
    ColorSchemeToggle.syncAll(theme);
  }
}
customElements.define('theme-color-toggle', ColorSchemeToggle);


/*
  Tooltip
*/
class ThemeTooltip {
  static tooltipId = 'theme-tooltip';
  static destroyDelayMs = 150;
  static selector = '[data-tooltip]';
  static margin = 8;
  static activeTrigger = null;
  static tooltipElement = null;
  static isBound = false;
  static destroyTimer = null;

  static init() {
    if (ThemeTooltip.isBound) {
      return;
    }

    document.addEventListener('mouseover', ThemeTooltip.onMouseOver);
    document.addEventListener('mouseout', ThemeTooltip.onMouseOut);
    document.addEventListener('focusin', ThemeTooltip.onFocusIn);
    document.addEventListener('focusout', ThemeTooltip.onFocusOut);
    document.addEventListener('keydown', ThemeTooltip.onKeyDown);
    window.addEventListener('scroll', ThemeTooltip.onViewportChange, true);
    window.addEventListener('resize', ThemeTooltip.onViewportChange);
    ThemeTooltip.isBound = true;
  }

  static getTriggerFromEvent(event) {
    if (!(event.target instanceof Element)) {
      return null;
    }

    return event.target.closest(ThemeTooltip.selector);
  }

  static clearDestroyTimer() {
    if (!ThemeTooltip.destroyTimer) {
      return;
    }

    window.clearTimeout(ThemeTooltip.destroyTimer);
    ThemeTooltip.destroyTimer = null;
  }

  static clearTriggerDescription(trigger) {
    if (!trigger) {
      return;
    }

    if (trigger.getAttribute('aria-describedby') === ThemeTooltip.tooltipId) {
      trigger.removeAttribute('aria-describedby');
    }
  }

  static ensureTooltipElement() {
    var parent = document.body || document.documentElement;

    ThemeTooltip.clearDestroyTimer();

    if (ThemeTooltip.tooltipElement) {
      return;
    }

    ThemeTooltip.tooltipElement = document.createElement('div');
    ThemeTooltip.tooltipElement.id = ThemeTooltip.tooltipId;
    ThemeTooltip.tooltipElement.className = 'theme-tooltip';
    ThemeTooltip.tooltipElement.setAttribute('role', 'tooltip');
    ThemeTooltip.tooltipElement.setAttribute('aria-hidden', 'true');
    parent.appendChild(ThemeTooltip.tooltipElement);
  }

  static getTooltipHost(trigger) {
    var dialog = trigger.closest('dialog[open]');
    return dialog || document.body || document.documentElement;
  }

  static moveToHost(trigger) {
    var nextHost = ThemeTooltip.getTooltipHost(trigger);

    if (!ThemeTooltip.tooltipElement || !nextHost) {
      return;
    }

    if (ThemeTooltip.tooltipElement.parentElement !== nextHost) {
      nextHost.appendChild(ThemeTooltip.tooltipElement);
    }
  }

  static destroyTooltipElement() {
    if (!ThemeTooltip.tooltipElement) {
      return;
    }

    ThemeTooltip.tooltipElement.remove();
    ThemeTooltip.tooltipElement = null;
  }

  static onMouseOver(event) {
    var trigger = ThemeTooltip.getTriggerFromEvent(event);
    if (!trigger) {
      return;
    }

    ThemeTooltip.show(trigger);
  }

  static onMouseOut(event) {
    var trigger = ThemeTooltip.getTriggerFromEvent(event);
    if (!trigger || !ThemeTooltip.activeTrigger) {
      return;
    }

    if (trigger.contains(event.relatedTarget)) {
      return;
    }

    if (ThemeTooltip.activeTrigger === trigger) {
      ThemeTooltip.hide();
    }
  }

  static onFocusIn(event) {
    var trigger = ThemeTooltip.getTriggerFromEvent(event);
    if (!trigger) {
      return;
    }

    ThemeTooltip.show(trigger);
  }

  static onFocusOut(event) {
    if (!ThemeTooltip.activeTrigger) {
      return;
    }

    if (ThemeTooltip.activeTrigger.contains(event.relatedTarget)) {
      return;
    }

    ThemeTooltip.hide();
  }

  static onKeyDown(event) {
    if (event.key === 'Escape') {
      ThemeTooltip.hide();
    }
  }

  static onViewportChange() {
    if (!ThemeTooltip.activeTrigger) {
      return;
    }

    ThemeTooltip.position();
  }

  static show(trigger) {
    var text = trigger.getAttribute('data-tooltip');

    if (!text) {
      return;
    }

    if (ThemeTooltip.activeTrigger && ThemeTooltip.activeTrigger !== trigger) {
      ThemeTooltip.clearTriggerDescription(ThemeTooltip.activeTrigger);
    }

    ThemeTooltip.ensureTooltipElement();
    ThemeTooltip.moveToHost(trigger);
    ThemeTooltip.activeTrigger = trigger;
    ThemeTooltip.tooltipElement.textContent = text;
    ThemeTooltip.tooltipElement.setAttribute('aria-hidden', 'false');
    ThemeTooltip.tooltipElement.classList.add('is-visible');
    trigger.setAttribute('aria-describedby', ThemeTooltip.tooltipId);
    ThemeTooltip.position();
  }

  static hide() {
    if (!ThemeTooltip.tooltipElement || !ThemeTooltip.activeTrigger) {
      return;
    }

    ThemeTooltip.clearTriggerDescription(ThemeTooltip.activeTrigger);

    ThemeTooltip.tooltipElement.classList.remove('is-visible');
    ThemeTooltip.tooltipElement.setAttribute('aria-hidden', 'true');
    ThemeTooltip.activeTrigger = null;

    ThemeTooltip.clearDestroyTimer();

    ThemeTooltip.destroyTimer = window.setTimeout(() => {
      ThemeTooltip.destroyTimer = null;
      ThemeTooltip.destroyTooltipElement();
    }, ThemeTooltip.destroyDelayMs);
  }

  static position() {
    var rect = null;
    var tooltipRect = null;
    var left = 0;
    var top = 0;
    var maxLeft = 0;

    if (!ThemeTooltip.tooltipElement || !ThemeTooltip.activeTrigger) {
      return;
    }

    rect = ThemeTooltip.activeTrigger.getBoundingClientRect();
    tooltipRect = ThemeTooltip.tooltipElement.getBoundingClientRect();
    left = rect.left + ((rect.width - tooltipRect.width) / 2);
    maxLeft = window.innerWidth - tooltipRect.width - ThemeTooltip.margin;
    left = Math.min(Math.max(ThemeTooltip.margin, left), Math.max(ThemeTooltip.margin, maxLeft));
    top = rect.top - tooltipRect.height - ThemeTooltip.margin;

    if (top < ThemeTooltip.margin) {
      top = rect.bottom + ThemeTooltip.margin;
    }

    ThemeTooltip.tooltipElement.style.left = left + 'px';
    ThemeTooltip.tooltipElement.style.top = top + 'px';
  }
}
ThemeTooltip.init();


/*
  Notification
*/
class ThemeNotification extends HTMLElement {
  constructor() {
    super();
    this.closeButton = null;
    this.titleElement = null;
    this.contentElement = null;
    this.close = this.close.bind(this);
  }

  connectedCallback() {
    this.closeButton = this.querySelector('[data-theme-notification-close]');
    this.titleElement = this.querySelector('[data-theme-notification-title]');
    this.contentElement = this.querySelector('.theme-notification-content');
    this.closeButton.addEventListener('click', this.close);
  }

  disconnectedCallback() {
    this.closeButton.removeEventListener('click', this.close);
  }

  close() {
    this.classList.remove('alert-success', 'alert-error', 'alert-warning');
    this.hidden = true;
  }

  show(title, description, type) {
    this.classList.remove('alert-success', 'alert-error', 'alert-warning');

    if (this.titleElement) {
      this.titleElement.textContent = title || '';
    }

    if (this.contentElement) {
      this.contentElement.textContent = description || '';
    }

    if (type) {
      this.classList.add('alert-' + type);
    }

    this.hidden = false;

    setTimeout(() => {
      this.close();
    }, 5000);
  }

  static show(title, description, type) {
    var notification = document.querySelector('theme-notification');
    if (!notification) {
      return;
    }

    notification.show(title, description, type);
  }
}
customElements.define('theme-notification', ThemeNotification);


/*
  Dialog
*/
class ThemeDialog extends HTMLElement {
  static instanceCount = 0;
  static closeDurationMs = 300;

  constructor() {
    super();
    this.dialog = null;
    this.triggers = [];
    this.lastTrigger = null;
    this.listenerController = null;
    this.isInitialized = false;
    this.isClosing = false;
    this.closeTimer = null;

    this.onDialogClose = this.onDialogClose.bind(this);
    this.onDialogCancel = this.onDialogCancel.bind(this);
    this.onDialogClick = this.onDialogClick.bind(this);
    this.onInternalClick = this.onInternalClick.bind(this);
  }

  connectedCallback() {
    if (this.isInitialized) {
      return;
    }

    this.dialog = this.querySelector('dialog');
    if (!this.dialog) {
      return;
    }

    if (!this.dialog.id) {
      ThemeDialog.instanceCount += 1;
      this.dialog.id = 'theme-dialog-' + ThemeDialog.instanceCount;
    }

    this.listenerController = new AbortController();
    this.triggers = Array.from(document.querySelectorAll('[data-toggle="' + this.dialog.id + '"]'));
    this.triggers.forEach((trigger) => {
      var onTriggerClick = this.onTriggerClick.bind(this, trigger);

      trigger.setAttribute('aria-controls', this.dialog.id);
      trigger.setAttribute('aria-expanded', 'false');
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.addEventListener('click', onTriggerClick, { signal: this.listenerController.signal });
    });

    this.dialog.addEventListener('close', this.onDialogClose, { signal: this.listenerController.signal });
    this.dialog.addEventListener('cancel', this.onDialogCancel, { signal: this.listenerController.signal });
    this.dialog.addEventListener('click', this.onDialogClick, { signal: this.listenerController.signal });
    this.addEventListener('click', this.onInternalClick, { signal: this.listenerController.signal });
    this.openFromUrlIfNeeded();
    this.isInitialized = true;
  }

  disconnectedCallback() {
    if (this.listenerController) {
      this.listenerController.abort();
      this.listenerController = null;
    }

    this.dialog = null;
    this.triggers = [];
    this.lastTrigger = null;
    this.isInitialized = false;
    this.isClosing = false;

    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }
  }

  setExpandedState(isExpanded) {
    this.triggers.forEach((trigger) => {
      trigger.setAttribute('aria-expanded', String(isExpanded));
    });
  }

  onTriggerClick(trigger, event) {
    event.preventDefault();
    this.lastTrigger = trigger;
    this.openDialog();
  }

  openDialog() {
    if (this.dialog.open) {
      this.requestClose();
      return;
    }
    this.closeOtherOpenDialogs();
    this.dialog.classList.remove('is-closing');
    this.isClosing = false;

    try {
      this.dialog.showModal();
    } catch (error) {
      if (!this.dialog.open && this.dialog.isConnected) {
        this.dialog.setAttribute('open', '');
      }
    }

    this.setExpandedState(this.dialog.open);
  }

  openFromUrlIfNeeded() {
    if (this.dialog.id !== 'cart-dialog') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const shouldOpenFromQuery =
      params.get('cart') === 'open' ||
      params.get('drawer') === 'cart' ||
      params.get('dialog') === 'cart';
    const shouldOpenFromHash = hash === '#cart-dialog' || hash === '#cart-drawer';

    if (!shouldOpenFromQuery && !shouldOpenFromHash) {
      return;
    }

    this.openDialog();
  }

  onDialogClose() {
    this.dialog.classList.remove('is-closing');
    this.setExpandedState(false);
    this.isClosing = false;

    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
      this.closeTimer = null;
    }

    if (this.lastTrigger) {
      this.lastTrigger.focus();
    }
  }

  onDialogCancel(event) {
    event.preventDefault();
    this.requestClose();
  }

  onDialogClick(event) {
    var rect = this.dialog.getBoundingClientRect();
    var clickedOutside = event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;

    if (clickedOutside) {
      this.requestClose();
    }
  }

  onInternalClick(event) {
    var closeButton = event.target.closest('[data-dialog-close]');

    if (!closeButton || !this.contains(closeButton) || !this.dialog.open) {
      return;
    }

    this.requestClose();
  }

  requestClose() {
    if (!this.dialog || !this.dialog.open || this.isClosing) {
      return;
    }

    var closeDurationMs = this.getCloseDurationMs();

    if (closeDurationMs === 0) {
      this.dialog.classList.remove('is-closing');
      this.dialog.close();
      return;
    }

    this.isClosing = true;
    this.dialog.classList.add('is-closing');

    if (this.closeTimer) {
      window.clearTimeout(this.closeTimer);
    }

    this.closeTimer = window.setTimeout(() => {
      this.closeTimer = null;

      if (this.dialog.open) {
        this.dialog.close();
      }
    }, closeDurationMs);
  }

  getCloseDurationMs() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return 0;
    }

    var computedStyle = window.getComputedStyle(this.dialog);
    var cssDuration = computedStyle.getPropertyValue('--dialog-transition-duration').trim();
    var parsedDuration = Number.parseFloat(cssDuration);

    if (!Number.isFinite(parsedDuration) || parsedDuration < 0) {
      return ThemeDialog.closeDurationMs;
    }

    if (cssDuration.endsWith('ms')) {
      return parsedDuration;
    }

    return parsedDuration * 1000;
  }

  closeOtherOpenDialogs() {
    document.querySelectorAll('dialog[open]').forEach((openDialog) => {
      var dialogHost = null;
      var node = null;

      if (openDialog === this.dialog) {
        return;
      }

      node = openDialog.parentElement;
      while (node) {
        if (typeof node.requestClose === 'function') {
          dialogHost = node;
          break;
        }

        node = node.parentElement;
      }

      if (dialogHost && typeof dialogHost.requestClose === 'function') {
        dialogHost.requestClose();
        return;
      }

      openDialog.close();
    });
  }
}

customElements.define('theme-dialog', ThemeDialog);


/*
  Sticky header
*/
function initStickyHeader() {
  const headerGroup = document.querySelector('#header-group');
  if (!headerGroup) {
    return;
  }

  headerGroup.classList.add("sticky");
  let lastScrollTop = 0;
  let ticking = false;

  function onScroll() {
    if (ticking) {
      return;
    }

    ticking = true;
    window.requestAnimationFrame(() => {
      const currentScroll = window.pageYOffset;
      if (currentScroll > lastScrollTop && currentScroll > headerGroup.clientHeight) {
        headerGroup.classList.add("hide");
      } else {
        headerGroup.classList.remove("hide");
      }
      lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
}
initStickyHeader();

/*
  Media (Video/Iframe/Model) on view
*/
function initMediaOnView() {
  var videos = document.querySelectorAll('video');
  var iframes = document.querySelectorAll('iframe[data-src]');
  var models = document.querySelectorAll('model-viewer[data-src]');
  var mediaItems = [];

  if (!videos.length && !iframes.length && !models.length) {
    return;
  }

  function isDataAutoplayEnabled(video) {
    if (!video.hasAttribute('data-autoplay')) {
      return false;
    }

    if (video.dataset.autoplay === 'false') {
      return false;
    }

    return true;
  }

  function activateVideo(video) {
    if (video.dataset.poster && !video.poster) {
      video.poster = video.dataset.poster;
    }

    if (!isDataAutoplayEnabled(video)) {
      return;
    }

    video.preload = 'auto';
    video.play().catch(function () {
      // Ignore autoplay failures caused by browser policies.
    });
  }

  function activateIframe(iframe) {
    if (iframe.dataset.src && !iframe.getAttribute('src')) {
      iframe.setAttribute('src', iframe.dataset.src);
    }
  }

  function activateModel(model) {
    if (model.dataset.src && !model.getAttribute('src')) {
      model.setAttribute('src', model.dataset.src);
    }
  }

  mediaItems = mediaItems.concat(Array.prototype.slice.call(videos));
  mediaItems = mediaItems.concat(Array.prototype.slice.call(iframes));
  mediaItems = mediaItems.concat(Array.prototype.slice.call(models));

  if (!('IntersectionObserver' in window)) {
    mediaItems.forEach((media) => {
      if (media.tagName === 'VIDEO') {
        activateVideo(media);
        return;
      }

      if (media.tagName === 'IFRAME') {
        activateIframe(media);
        return;
      }

      if (media.tagName === 'MODEL-VIEWER') {
        activateModel(media);
      }
    });
    return;
  }

  var observer = new IntersectionObserver((entries, instance) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      if (entry.target.tagName === 'VIDEO') {
        activateVideo(entry.target);
      } else if (entry.target.tagName === 'IFRAME') {
        activateIframe(entry.target);
      } else if (entry.target.tagName === 'MODEL-VIEWER') {
        activateModel(entry.target);
      }
      instance.unobserve(entry.target);
    });
  }, {
    threshold: 0,
    rootMargin: '300px 0px 0px 0px'
  });

  mediaItems.forEach((media) => {
    observer.observe(media);
  });
}

initMediaOnView();
