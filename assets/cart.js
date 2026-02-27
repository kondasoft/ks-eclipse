class ThemeCart {
  static sectionsToRender = ['cart-badge', 'cart-dialog'];
  static defaultSectionsUrl = `${window.location.pathname}${window.location.search}`;
  static loadingCount = 0;

  static openDrawer(focusReturnTarget) {
    const dialog = document.querySelector('#cart-dialog');
    if (!dialog) {
      return;
    }

    const nextFocusTarget = focusReturnTarget instanceof HTMLElement ? focusReturnTarget : document.activeElement;
    const dialogHost = dialog.closest('theme-dialog');

    if (dialogHost && nextFocusTarget instanceof HTMLElement && !dialog.contains(nextFocusTarget)) {
      dialogHost.lastTrigger = nextFocusTarget;
    }

    dialog.showModal();
  }

  static setLoading(isLoading) {
    const dialog = document.querySelector('#cart-dialog');
    if (!dialog) {
      return;
    }

    if (isLoading) {
      ThemeCart.loadingCount += 1;
      dialog.classList.add('is-loading');
      return;
    }

    ThemeCart.loadingCount = Math.max(0, ThemeCart.loadingCount - 1);
    if (ThemeCart.loadingCount === 0) {
      dialog.classList.remove('is-loading');
    }
  }

  static buildRequestBody(payload) {
    if (payload instanceof FormData) {
      payload.set('sections', ThemeCart.sectionsToRender.join(','));
      payload.set('sections_url', ThemeCart.defaultSectionsUrl);
      return payload;
    }
    
    return JSON.stringify({
      ...(payload || {}),
      sections: ThemeCart.sectionsToRender,
      sections_url: ThemeCart.defaultSectionsUrl
    });
  }

  static async mutate(action, fetchOptions = {}) {

    const url = action === 'get' 
      ? `${window.theme.routes.cart}.js` 
      : `${window.theme.routes.cart[action]}.js`;

    const options = { ...fetchOptions };
    
    if (typeof options.body === 'string' && !options.headers) {
      options.headers = {
        'Content-Type': 'application/json'
      };
    } else if (typeof options.body === 'string' && options.headers && !options.headers['Content-Type']) {
      options.headers['Content-Type'] = 'application/json';
    }

    ThemeCart.setLoading(true);

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        console.error(`Cart ${action} request failed with status ${response.status}`, response);
        const errorText = await response.text();
        let message;

        try {
          const errorData = JSON.parse(errorText);
          message = errorData.description || errorData.message || 'Unable to update cart';
        } catch (_error) {
          message = errorText || 'Unable to update cart';
        }

        const error = new Error(message);
        
        document.dispatchEvent(
          new CustomEvent('cart:error', {
            detail: {
              action,
              error
            }
          })
        );
        throw error;
      }

      const result = await response.json();

      document.dispatchEvent(
        new CustomEvent('cart:updated', {
          detail: {
            action,
            cart: result,
            sections: result && result.sections ? result.sections : {}
          }
        })
      );

      return result;
    } finally {
      ThemeCart.setLoading(false);
    }
  }

  static async get() {
    return ThemeCart.mutate('get');
  }

  static async add(payload, options) {
    const config = options || {};
    const body = ThemeCart.buildRequestBody(payload);

    const result = await ThemeCart.mutate('add', {
      method: 'POST',
      body
    });

    ThemeCart.openDrawer(config.returnFocusTarget);
    return result;
  }

  static async update(payload) {
    return ThemeCart.mutate('update', {
      method: 'POST',
      body: ThemeCart.buildRequestBody(payload)
    });
  }

  static async change(payload) {
    return ThemeCart.mutate('change', {
      method: 'POST',
      body: ThemeCart.buildRequestBody(payload)
    });
  }

  static async remove(payload) {
    return ThemeCart.change({
      ...(payload || {}),
      quantity: 0
    });
  }

  static async clear() {
    return ThemeCart.mutate('clear', {
      method: 'POST',
      body: ThemeCart.buildRequestBody({})
    });
  }
}

class CartItemRemove extends HTMLElement {
  constructor() {
    super();
    this.isRemoving = false;
    this.handleClick = (e) => this.handleRemove(e);
  }

  connectedCallback() {
    this.addEventListener('click', this.handleClick);
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleClick);
  }

  async handleRemove(event) {
    if (this.isRemoving) return;

    const key = this.getAttribute('data-line-item-key');
    if (!key) return;

    event.preventDefault();
    this.isRemoving = true;
    this.toggleAttribute('disabled', true);
    this.toggleAttribute('aria-busy', true);

    try {
      await ThemeCart.remove({ id: key });
    } finally {
      this.isRemoving = false;
      this.toggleAttribute('disabled', false);
      this.toggleAttribute('aria-busy', false);
    }
  }
}
customElements.define('cart-item-remove', CartItemRemove);

class CartItemQtySwitcher extends HTMLElement {
  static activeSwitcherIndex = null;
  static shouldRestoreFocusOnNextUpdate = false;
  static isCartUpdatedListenerBound = false;

  constructor() {
    super();
    this.input = null;
    this.decreaseButton = null;
    this.increaseButton = null;
    this.isUpdating = false;
    this.queuedQuantity = null;
    this.lastCommittedQuantity = null;

    this.boundHandlers = {
      decreaseClick: (e) => this.handleDecreaseClick(e),
      increaseClick: (e) => this.handleIncreaseClick(e),
      inputChange: () => this.syncState(),
      inputCommit: () => this.requestQuantity(this.getValue()),
      focusIn: () => this.handleFocusIn()
    };
  }

  connectedCallback() {
    CartItemQtySwitcher.bindCartUpdatedListener();
    
    this.input = this.querySelector('input[name="updates[]"]');
    this.decreaseButton = this.querySelector('button[name="decrease"]');
    this.increaseButton = this.querySelector('button[name="increase"]');

    if (!this.input || !this.decreaseButton || !this.increaseButton) {
      return;
    }

    this.lastCommittedQuantity = this.getValue();
    this.setupEventListeners();
    this.syncState();
  }

  disconnectedCallback() {
    this.removeEventListeners();
  }

  setupEventListeners() {
    this.decreaseButton.addEventListener('click', this.boundHandlers.decreaseClick);
    this.increaseButton.addEventListener('click', this.boundHandlers.increaseClick);
    this.input.addEventListener('input', this.boundHandlers.inputChange);
    this.input.addEventListener('change', this.boundHandlers.inputCommit);
    this.input.addEventListener('blur', this.boundHandlers.inputCommit);
    this.addEventListener('focusin', this.boundHandlers.focusIn);
  }

  removeEventListeners() {
    this.decreaseButton?.removeEventListener('click', this.boundHandlers.decreaseClick);
    this.increaseButton?.removeEventListener('click', this.boundHandlers.increaseClick);
    this.input?.removeEventListener('input', this.boundHandlers.inputChange);
    this.input?.removeEventListener('change', this.boundHandlers.inputCommit);
    this.input?.removeEventListener('blur', this.boundHandlers.inputCommit);
    this.removeEventListener('focusin', this.boundHandlers.focusIn);
  }

  static bindCartUpdatedListener() {
    if (CartItemQtySwitcher.isCartUpdatedListenerBound) {
      return;
    }

    document.addEventListener('cart:updated', () => this.onCartUpdated());
    CartItemQtySwitcher.isCartUpdatedListenerBound = true;
  }

  static onCartUpdated() {
    if (!CartItemQtySwitcher.shouldRestoreFocusOnNextUpdate) {
      return;
    }

    CartItemQtySwitcher.shouldRestoreFocusOnNextUpdate = false;
    const activeSwitcherIndex = CartItemQtySwitcher.activeSwitcherIndex;
    
    if (!Number.isInteger(activeSwitcherIndex) || activeSwitcherIndex < 0) {
      return;
    }

    window.requestAnimationFrame(() => {
      const switchers = Array.from(document.querySelectorAll('cart-items cart-item-qty-switcher'));
      const nextSwitcher = switchers[Math.min(activeSwitcherIndex, switchers.length - 1)];
      nextSwitcher?.querySelector('input[name="updates[]"]')?.focus({ preventScroll: true });
    });
  }

  getLineItemKey() {
    return this.getAttribute('data-line-item-key') || this.input?.dataset?.lineItemKey || null;
  }

  getValue() {
    const value = Number(this.input?.value);
    const min = Number.isFinite(this.input?.min) ? Number(this.input.min) : 0;
    return Number.isFinite(value) ? value : min;
  }

  normalizeValue(nextValue) {
    const min = Number.isFinite(this.input?.min) ? Number(this.input.min) : 0;
    let value = Number.isFinite(nextValue) ? nextValue : min;
    return Math.max(value, min);
  }

  syncState() {
    if (!this.input || !this.decreaseButton || !this.increaseButton) {
      return;
    }

    const value = this.normalizeValue(this.getValue());
    const min = Number.isFinite(this.input?.min) ? Number(this.input.min) : 0;

    this.input.value = String(value);
    this.decreaseButton.disabled = value <= min;
    this.increaseButton.disabled = false;
    this.toggleAttribute('aria-busy', this.isUpdating);
  }

  async requestQuantity(nextQuantity) {
    const lineItemKey = this.getLineItemKey();
    if (!lineItemKey) return;

    const quantity = this.normalizeValue(nextQuantity);

    if (!this.isUpdating && quantity === this.lastCommittedQuantity) {
      this.syncState();
      return;
    }

    if (this.isUpdating) {
      this.queuedQuantity = quantity;
      return;
    }

    await this.updateCartQuantity(quantity, lineItemKey);
    
    if (this.queuedQuantity !== null && this.queuedQuantity !== this.lastCommittedQuantity) {
      const queuedQuantity = this.queuedQuantity;
      this.queuedQuantity = null;
      this.requestQuantity(queuedQuantity);
    }
  }

  async updateCartQuantity(quantity, lineItemKey) {
    CartItemQtySwitcher.shouldRestoreFocusOnNextUpdate = true;
    this.isUpdating = true;
    this.queuedQuantity = null;
    this.syncState();

    try {
      await ThemeCart.change({ id: lineItemKey, quantity });
      this.lastCommittedQuantity = quantity;
    } catch (_error) {
      CartItemQtySwitcher.shouldRestoreFocusOnNextUpdate = false;
      this.input.value = String(this.lastCommittedQuantity);
    } finally {
      this.isUpdating = false;
      this.syncState();
    }
  }

  handleDecreaseClick(event) {
    event.preventDefault();
    this.changeQuantity(-this.getStep());
  }

  handleIncreaseClick(event) {
    event.preventDefault();
    this.changeQuantity(this.getStep());
  }

  changeQuantity(delta) {
    const quantity = this.getValue() + delta;
    this.input.value = String(this.normalizeValue(quantity));
    this.syncState();
    this.requestQuantity(quantity);
  }

  handleFocusIn() {
    const cartItems = this.closest('cart-items');
    if (!cartItems) {
      CartItemQtySwitcher.activeSwitcherIndex = null;
      return;
    }

    const switchers = Array.from(cartItems.querySelectorAll('cart-item-qty-switcher'));
    CartItemQtySwitcher.activeSwitcherIndex = switchers.indexOf(this);
  }

  getStep() {
    const step = Number(this.input?.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }
}
customElements.define('cart-item-qty-switcher', CartItemQtySwitcher);

class CartNote extends HTMLElement {
  constructor() {
    super();
    this.isSaving = false;
    this.savedTimeoutId = null;
    
    this.boundHandlers = {
      submit: (e) => this.handleSubmit(e),
      input: () => !this.isSaving && this.setButtonState(this.submitButton?.dataset.textBtnSave || 'Save', false),
      cartUpdated: (e) => this.handleCartUpdated(e)
    };
  }

  connectedCallback() {
    this.form = this.querySelector('form');
    this.input = this.querySelector('textarea[name="note"]');
    this.submitButton = this.querySelector('button[type="submit"]');

    this.form?.addEventListener('submit', this.boundHandlers.submit);
    this.input?.addEventListener('input', this.boundHandlers.input);
    document.addEventListener('cart:updated', this.boundHandlers.cartUpdated);
  }

  disconnectedCallback() {
    this.form?.removeEventListener('submit', this.boundHandlers.submit);
    this.input?.removeEventListener('input', this.boundHandlers.input);
    document.removeEventListener('cart:updated', this.boundHandlers.cartUpdated);
    this.clearSavedTimeout();
  }

  async handleSubmit(event) {
    event.preventDefault();
    if (!this.input || this.isSaving) return;

    this.isSaving = true;
    this.setButtonState('Saving...', true);

    try {
      await ThemeCart.update({ note: this.input.value });
      this.setButtonState(this.submitButton.dataset.textNoteSaved || 'Saved!', false);
      
      this.clearSavedTimeout();
      this.savedTimeoutId = window.setTimeout(() => {
        this.clearSavedTimeout();
        this.setButtonState(this.submitButton.dataset.textBtnSave || 'Save', false);
      }, 2000);
    } finally {
      this.isSaving = false;
    }
  }

  handleCartUpdated(event) {
    const sectionHtml = event.detail?.sections?.['cart-dialog'];
    if (!sectionHtml) return;

    const nextNoteDetails = new DOMParser().parseFromString(sectionHtml, 'text/html').querySelector('#cart-dialog-note-details');
    const currentNoteDetails = document.querySelector('#cart-dialog-note-details');
    
    if (!currentNoteDetails || !nextNoteDetails) return;

    const shouldHide = nextNoteDetails.hasAttribute('hidden');
    currentNoteDetails.toggleAttribute('hidden', shouldHide);
    if (shouldHide) currentNoteDetails.removeAttribute('open');
  }

  setButtonState(text, isBusy) {
    this.submitButton.querySelector('span').textContent = text;
    this.submitButton.toggleAttribute('disabled', isBusy);
    this.submitButton.classList.toggle('is-loading', isBusy);
    this.submitButton.toggleAttribute('aria-busy', isBusy);
  }

  clearSavedTimeout() {
    if (this.savedTimeoutId) {
      window.clearTimeout(this.savedTimeoutId);
      this.savedTimeoutId = null;
    }
  }
}
customElements.define('cart-note', CartNote);

function updateCartElements() {
  document.addEventListener('cart:updated', (event) => {
    const sections = event.detail?.sections || {};

    const elementConfigs = [
      { selector: '[data-cart-badge]', section: 'cart-badge', querySelector: 'cart-badge' },
      { selector: '[data-cart-subtotal]', section: 'cart-dialog', querySelector: 'cart-subtotal' },
      { selector: '[data-cart-applied-discounts]', section: 'cart-dialog', querySelector: 'cart-applied-discounts' },
    ];

    elementConfigs.forEach(({ selector, section, querySelector }) => {
      const sectionHtml = sections[section];
      if (!sectionHtml) return;

      const nextElement = new DOMParser().parseFromString(sectionHtml, 'text/html').querySelector(querySelector);
      if (!nextElement) return;

      document.querySelectorAll(selector).forEach((element) => {
        element.innerHTML = nextElement.innerHTML;
      });
    });

    // Update cart items container if it exists
    const cartItemsHtml = sections['cart-dialog'];
    if (cartItemsHtml) {
      const nextItems = new DOMParser().parseFromString(cartItemsHtml, 'text/html').querySelector('[data-cart-items]');
      if (nextItems) {
        document.querySelectorAll('[data-cart-items]').forEach((element) => {
          element.innerHTML = nextItems.innerHTML;
          // Sync data-cart-empty attribute
          const nextDialog = new DOMParser().parseFromString(cartItemsHtml, 'text/html').querySelector('#cart-dialog');
          const currentDialog = element.closest('#cart-dialog');
          if (currentDialog && nextDialog?.hasAttribute('data-cart-empty')) {
            currentDialog.setAttribute('data-cart-empty', nextDialog.getAttribute('data-cart-empty'));
          }
        });
      }
    }
  });
}
updateCartElements();

function initCartCheckoutLoadingState() {
  document.addEventListener('submit', (event) => {
    const form = event.target;
    const dialog = form?.closest('#cart-dialog');
    const submitter = event.submitter;
    
    if (!(form instanceof HTMLFormElement) || !dialog || submitter?.name !== 'checkout') {
      return;
    }

    dialog.classList.add('is-loading');
    submitter.classList.add('is-loading');
    submitter.setAttribute('aria-busy', 'true');

    window.setTimeout(() => {
      dialog.classList.remove('is-loading');
      submitter.classList.remove('is-loading');
      submitter.removeAttribute('aria-busy');
    }, 3000);
  });
}
initCartCheckoutLoadingState();