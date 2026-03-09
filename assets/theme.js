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
    if (!this.dialog.id) {
      return;
    }

    const dialogName = this.dialog.id.endsWith('-dialog')
      ? this.dialog.id.slice(0, -'-dialog'.length)
      : this.dialog.id;
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    const shouldOpenFromQuery = params.get(dialogName) === 'open';
    const shouldOpenFromHash = hash === `#${this.dialog.id}` || hash === `#${dialogName}`;

    if (!shouldOpenFromQuery && !shouldOpenFromHash) {
      return;
    }

    window.setTimeout(() => {
      this.openDialog();
    }, 250);
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
    if (event.target !== this.dialog) {
      return;
    }

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
Carousel
*/
class ThemeCarousel extends HTMLElement {
  constructor() {
    super();
    this.reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.focusableUpdateFrame = null;
    this.touchStartX = null;
    this.boundHandlers = {
      prev: () => this.prevSlide(),
      next: () => this.nextSlide(),
      resize: () => {
        this.positionButtons();
        this.updateFocusableItemsInView();
      },
      trackScroll: () => {
        this.updateFocusableItemsInView();
        this.updateProgress();
      },
      trackKeydown: (event) => this.onTrackKeydown(event),
      trackTouchStart: (event) => this.handleFirstLastScrollItems(event, 'start'),
      trackTouchEnd: (event) => this.handleFirstLastScrollItems(event, 'end')
    };
  }

  connectedCallback() {
    this.initCarousel();
  }

  disconnectedCallback() {
    if (this.prevBtn) {
      this.prevBtn.removeEventListener('click', this.boundHandlers.prev);
    }
    if (this.nextBtn) {
      this.nextBtn.removeEventListener('click', this.boundHandlers.next);
    }
    if (this.track) {
      this.track.removeEventListener('keydown', this.boundHandlers.trackKeydown);
      this.track.removeEventListener('scroll', this.boundHandlers.trackScroll);
      this.track.removeEventListener('touchstart', this.boundHandlers.trackTouchStart);
      this.track.removeEventListener('touchend', this.boundHandlers.trackTouchEnd);
    }
    window.removeEventListener('resize', this.boundHandlers.resize);
    if (this.focusableUpdateFrame) {
      window.cancelAnimationFrame(this.focusableUpdateFrame);
      this.focusableUpdateFrame = null;
    }
  }

  initCarousel() {
    this.track = this.querySelector('.theme-carousel-track');
    if (!this.track) {
      return;
    }

    this.items = this.track ? this.track.querySelectorAll('.theme-carousel-item') : this.querySelectorAll('.theme-carousel-item');
    this.prevBtn = this.querySelector('[data-prev]');
    this.nextBtn = this.querySelector('[data-next]');
    this.progressBar = this.querySelector('.theme-carousel-progress-bar');

    this.setupAccessibility();

    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', this.boundHandlers.prev);
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', this.boundHandlers.next);
    }

    this.positionButtons();
    this.updateProgress();
    window.addEventListener('resize', this.boundHandlers.resize);
  }

  setupAccessibility() {
    this.track.addEventListener('keydown', this.boundHandlers.trackKeydown);
    this.track.addEventListener('scroll', this.boundHandlers.trackScroll, { passive: true });
    this.track.addEventListener('touchstart', this.boundHandlers.trackTouchStart, { passive: true });
    this.track.addEventListener('touchend', this.boundHandlers.trackTouchEnd, { passive: true });
    this.updateFocusableItemsInView();
  }

  handleFirstLastScrollItems(event, phase) {
    const swipeThreshold = 24;
    const touchStart = event.touches && event.touches[0];
    const touchEnd = event.changedTouches && event.changedTouches[0];

    if (phase === 'start') {
      if (!touchStart) {
        return;
      }

      this.touchStartX = touchStart.clientX;
      return;
    }

    if (this.touchStartX === null || !touchEnd) {
      this.touchStartX = null;
      return;
    }

    const deltaX = this.touchStartX - touchEnd.clientX;
    const swipedLeft = deltaX > swipeThreshold;
    const swipedRight = deltaX < -swipeThreshold;
    const { firstVisibleIndex, lastVisibleIndex } = this.getVisibleItemRange();

    if (swipedLeft && lastVisibleIndex === this.items.length - 1) {
      this.track.scrollTo({ left: 0, behavior: 'auto' });
    }

    if (swipedRight && firstVisibleIndex === 0) {
      this.track.scrollTo({ left: this.getMaxScroll(), behavior: 'auto' });
    }

    this.touchStartX = null;
  }

  getVisibleItemRange() {
    const trackRect = this.track.getBoundingClientRect();
    let firstVisibleIndex = -1;
    let lastVisibleIndex = -1;

    this.items.forEach((item, index) => {
      const itemRect = item.getBoundingClientRect();
      const visibleWidth = Math.min(itemRect.right, trackRect.right) - Math.max(itemRect.left, trackRect.left);
      const isInView = visibleWidth > 0 && itemRect.width > 0 && visibleWidth / itemRect.width >= 0.5;

      if (isInView) {
        if (firstVisibleIndex === -1) {
          firstVisibleIndex = index;
        }
        lastVisibleIndex = index;
      }
    });

    return { firstVisibleIndex, lastVisibleIndex };
  }

  updateProgress() {
    if (!this.track || !this.progressBar || !this.items.length) {
      return;
    }

    const { firstVisibleIndex, lastVisibleIndex } = this.getVisibleItemRange();

    if (firstVisibleIndex === -1) {
      return;
    }

    const visibleCount = lastVisibleIndex - firstVisibleIndex + 1;
    const progressWidth = (visibleCount / this.items.length) * 100;
    const progressLeft = (firstVisibleIndex / this.items.length) * 100;

    this.progressBar.style.width = `${progressWidth}%`;
    this.progressBar.style.left = `${progressLeft}%`;
  }

  updateFocusableItemsInView() {
    if (!this.track || !this.items.length || this.focusableUpdateFrame) {
      return;
    }

    this.focusableUpdateFrame = window.requestAnimationFrame(() => {
      this.focusableUpdateFrame = null;
      const trackRect = this.track.getBoundingClientRect();

      this.items.forEach((item) => {
        const itemRect = item.getBoundingClientRect();
        const visibleWidth = Math.min(itemRect.right, trackRect.right) - Math.max(itemRect.left, trackRect.left);
        const isInView = visibleWidth > 0 && itemRect.width > 0 && visibleWidth / itemRect.width >= 0.6;
        const focusables = item.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
        );

        focusables.forEach((element) => {
          if (isInView) {
            element.removeAttribute('tabindex');
          } else {
            element.setAttribute('tabindex', '-1');
          }
        });
      });
    });
  }

  positionButtons() {
    if (!this.items.length || !this.prevBtn || !this.nextBtn) {
      return;
    }

    requestAnimationFrame(() => {
      const firstItem = this.items[0];
      const imgWrapper = firstItem.querySelector('.img-wrapper');
      
      if (imgWrapper) {
        const imgHeight = imgWrapper.offsetHeight;
        const buttonTop = imgHeight / 2;
        
        this.prevBtn.style.top = `${buttonTop}px`;
        this.nextBtn.style.top = `${buttonTop}px`;
      }

      const img = firstItem.querySelector('img');
      if (img && !img.complete) {
        img.addEventListener('load', () => this.positionButtons(), { once: true });
      }
    });
  }

  getGapValue() {
    const computedStyle = getComputedStyle(this);
    const gapValue = computedStyle.getPropertyValue('--gap')?.trim() || '1rem';
    return parseFloat(gapValue) * (gapValue.includes('rem') ? 16 : 1);
  }

  getScrollAmount() {
    const firstItem = this.items[0];
    if (!firstItem) {
      return 0;
    }
    return firstItem.offsetWidth + this.getGapValue();
  }

  getMaxScroll() {
    return this.track.scrollWidth - this.track.clientWidth;
  }

  getScrollBehavior() {
    return this.reduceMotionQuery.matches ? 'auto' : 'smooth';
  }

  isAtStart() {
    return this.track.scrollLeft <= 10;
  }

  isAtEnd() {
    return this.track.scrollLeft >= this.getMaxScroll() - 10;
  }

  onTrackKeydown(event) {
    if (!this.track || !this.items.length) {
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.nextSlide();
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.prevSlide();
    }

    if (event.key === 'Home') {
      event.preventDefault();
      this.track.scrollTo({ left: 0, behavior: this.getScrollBehavior() });
    }

    if (event.key === 'End') {
      event.preventDefault();
      this.track.scrollTo({ left: this.getMaxScroll(), behavior: this.getScrollBehavior() });
    }
  }

  nextSlide() {
    if (!this.track || !this.items.length) {
      return;
    }

    if (this.isAtEnd()) {
      this.track.scrollTo({ left: 0, behavior: this.getScrollBehavior() });
    } else {
      this.track.scrollBy({ left: this.getScrollAmount(), behavior: this.getScrollBehavior() });
    }
  }

  prevSlide() {
    if (!this.track || !this.items.length) {
      return;
    }

    if (this.isAtStart()) {
      this.track.scrollTo({ left: this.getMaxScroll(), behavior: this.getScrollBehavior() });
    } else {
      this.track.scrollBy({ left: -this.getScrollAmount(), behavior: this.getScrollBehavior() });
    }
  }
}
customElements.define('theme-carousel', ThemeCarousel);


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


/*
  SVG inline utility
*/
async function inlineSvgImages() {
  var root = document;
  var selector = 'img[data-transform-svg-inline]';
  var forceCurrentColor = true;
  var preserveFillNone = true;
  var credentials = 'same-origin';
  var images = [];

  if (!root || typeof root.querySelectorAll !== 'function') {
    return [];
  }

  images = Array.from(root.querySelectorAll(selector));

  return Promise.all(
    images.map(async (img) => {
      var source = img.currentSrc || img.getAttribute('src') || '';
      var normalizedSource = source.split('?')[0].toLowerCase();
      var width = null;
      var height = null;
      var className = null;
      var id = null;
      var style = null;
      var alt = null;
      var response = null;
      var markup = null;
      var svgDocument = null;
      var svg = null;

      if (img.dataset.inlineSvgProcessed === 'true' || !normalizedSource.endsWith('.svg')) {
        return null;
      }

      try {
        response = await fetch(source, { credentials });
        if (!response.ok) {
          return null;
        }

        markup = await response.text();
        svgDocument = new DOMParser().parseFromString(markup, 'image/svg+xml');
        svg = svgDocument.querySelector('svg');
        if (!svg) {
          return null;
        }

        width = img.getAttribute('width');
        height = img.getAttribute('height');
        className = img.getAttribute('class');
        id = img.getAttribute('id');
        style = img.getAttribute('style');
        alt = img.getAttribute('alt');

        if (width) {
          svg.setAttribute('width', width);
        }
        if (height) {
          svg.setAttribute('height', height);
        }
        if (className) {
          svg.setAttribute('class', className);
        }
        if (id) {
          svg.setAttribute('id', id);
        }
        if (style) {
          svg.setAttribute('style', style);
        }

        if (alt) {
          svg.setAttribute('role', 'img');
          svg.setAttribute('aria-label', alt);
        } else {
          svg.setAttribute('aria-hidden', 'true');
        }

        if (forceCurrentColor) {
          svg.setAttribute('fill', 'currentColor');
          Array.from(svg.querySelectorAll('[fill]')).forEach((element) => {
            var fillValue = (element.getAttribute('fill') || '').trim().toLowerCase();
            if (fillValue && (!preserveFillNone || fillValue !== 'none')) {
              element.setAttribute('fill', 'currentColor');
            }
          });
        }

        img.dataset.inlineSvgProcessed = 'true';
        img.replaceWith(svg);
        return svg;
      } catch (error) {
        return null;
      }
    })
  );
}
inlineSvgImages()
window.addEventListener('shopify:section:load', inlineSvgImages);

/*
  Product card form
*/
class ProductCardForm extends HTMLElement {
  constructor() {
    super();
    this.form = null;
    this.submitButton = null;
    this.variantSelect = null;
    this.cardImage = null;
    this.defaultImageSrc = '';
    this.defaultImageSrcset = '';
    this.boundHandlers = {
      submit: (e) => this.handleSubmit(e),
      variantChange: () => this.handleVariantChange()
    };
  }

  connectedCallback() {
    this.form = this.querySelector('form');
    if (!this.form) {
      return;
    }

    this.submitButton = this.form.querySelector('button[type="submit"]');
    this.variantSelect = this.form.querySelector('select[name="id"]');
    this.cardImage = this.closest('.product-card')?.querySelector('.product-card-img') || null;

    if (this.cardImage) {
      this.defaultImageSrc = this.cardImage.getAttribute('src') || '';
      this.defaultImageSrcset = this.cardImage.getAttribute('srcset') || '';
    }

    this.form.addEventListener('submit', this.boundHandlers.submit);

    if (this.variantSelect) {
      this.variantSelect.addEventListener('change', this.boundHandlers.variantChange);
      this.handleVariantChange();
    }
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.boundHandlers.submit);
    this.variantSelect?.removeEventListener('change', this.boundHandlers.variantChange);
  }

  handleVariantChange() {
    if (!this.variantSelect || !this.cardImage) {
      return;
    }

    const selectedOption = this.variantSelect.options[this.variantSelect.selectedIndex];
    const src400 = selectedOption?.getAttribute('data-variant-image-400')?.trim() || selectedOption?.dataset?.variantImage400?.trim() || '';
    const src800 = selectedOption?.getAttribute('data-variant-image-800')?.trim() || selectedOption?.dataset?.variantImage800?.trim() || '';

    if (!src400 && !src800) {
      this.cardImage.setAttribute('src', this.defaultImageSrc);
      this.cardImage.setAttribute('srcset', this.defaultImageSrcset);
      return;
    }

    const nextSrc = src800 || src400;
    const nextSrcset = [
      src400 ? `${src400} 400w` : null,
      src800 ? `${src800} 800w` : null
    ].filter(Boolean).join(', ');

    this.cardImage.setAttribute('src', nextSrc);
    this.cardImage.setAttribute('srcset', nextSrcset);
  }

  async handleSubmit(event) {
    event.preventDefault();
    const submitter = event.submitter instanceof HTMLElement ? event.submitter : this.submitButton;

    this.submitButton.disabled = true;
    this.submitButton.setAttribute('aria-busy', 'true');
    this.submitButton.classList.add('is-loading');

    try {
      const formData = new FormData(this.form);
      const result = await ThemeCart.add(formData, { returnFocusTarget: submitter });
      console.log('Product added to cart', result);
    } catch (error) {
      console.error('Error adding product to cart', error);
    } finally {
      this.submitButton.disabled = false;
      this.submitButton.removeAttribute('aria-busy');
      this.submitButton.classList.remove('is-loading');
    }
  }
}
customElements.define('product-card-form', ProductCardForm);

class ShareComponent extends HTMLElement {
  constructor() {
    super();

    this.shareButton = this.querySelector(".btn-share");
    this.themeDialog = this.querySelector("theme-dialog");

    if (navigator.share) {
      // Use native share API if available
      this.shareButton.addEventListener("click", (e) => {
        e.preventDefault();
        navigator.share({
          title: this.shareButton.dataset.title,
          url: window.location.href,
        });
      });
      // Remove dialog since we don't need it
      if (this.themeDialog) {
        this.themeDialog.remove();
      }
    } else {
      // Move dialog to document body for proper animations
      if (this.themeDialog) {
        document.body.appendChild(this.themeDialog);
      }

      // Set up copy button functionality
      const copyButton = document.querySelector("#share-dialog .btn-copy-link");
      if (copyButton) {
        copyButton.addEventListener("click", () => {
          const input = document.querySelector("#share-dialog .share-url-input");
          if (input) {
            navigator.clipboard.writeText(input.value).then(() => {
              copyButton.textContent = copyButton.dataset.textCopied;
              setTimeout(() => {
                copyButton.textContent = copyButton.dataset.textCopy;
              }, 2000);
            });
          }
        });
      }
    }
  }
}
customElements.define("share-component", ShareComponent);