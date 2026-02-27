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

  static updateElements(event, elementConfigs) {
    const detail = event.detail || {};
    const sections = detail.sections || {};

    elementConfigs.forEach(({ selector, sectionNames = ['cart-dialog'] }) => {
      let sectionHtml = null;
      for (const sectionName of sectionNames) {
        sectionHtml = sections[sectionName];
        if (sectionHtml) break;
      }

      if (!sectionHtml) {
        return;
      }

      const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
      document.querySelectorAll(selector).forEach((element) => {
        const nextElement = parsedHtml.querySelector(selector);
        if (nextElement) {
          element.innerHTML = nextElement.innerHTML;
        }
      });
    });
  }
}

class CartBadge extends HTMLElement {
  constructor() {
    super();
    this.onCartUpdated = this.onCartUpdated.bind(this);
  }

  connectedCallback() {
    document.addEventListener('cart:updated', this.onCartUpdated);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:updated', this.onCartUpdated);
  }

  onCartUpdated(event) {
    const detail = event.detail || {};
    const sections = detail.sections || {};
    const sectionHtml = sections['cart-badge'];
    if (!sectionHtml) {
      return;
    }

    const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const nextBadge = parsedHtml.querySelector('cart-badge[data-badge="cart"]') || parsedHtml.querySelector('cart-badge');
    if (!nextBadge) {
      return;
    }

    this.innerHTML = nextBadge.innerHTML;

    const nextCount = nextBadge.getAttribute('data-count');
    if (nextCount !== null) {
      this.setAttribute('data-count', nextCount);
    }
  }
}
customElements.define('cart-badge', CartBadge);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.removingKeys = new Set();
    this.onCartUpdated = this.onCartUpdated.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  connectedCallback() {
    document.addEventListener('cart:updated', this.onCartUpdated);
    this.addEventListener('click', this.onClick);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:updated', this.onCartUpdated);
    this.removeEventListener('click', this.onClick);
  }

  onClick(event) {
    const removeButton = event.target.closest('button[data-line-item-key]');
    if (!removeButton || !this.contains(removeButton)) {
      return;
    }

    event.preventDefault();
    this.removeLineItem(removeButton);
  }

  async removeLineItem(button) {
    const lineItemKey = button.getAttribute('data-line-item-key');
    if (!lineItemKey || this.removingKeys.has(lineItemKey)) {
      return;
    }

    this.removingKeys.add(lineItemKey);
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');

    try {
      await ThemeCart.remove({ id: lineItemKey });
    } finally {
      this.removingKeys.delete(lineItemKey);
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  onCartUpdated(event) {
    const detail = event.detail || {};
    const sections = detail.sections || {};
    const sectionHtml = sections['cart-dialog'];
    if (!sectionHtml) {
      return;
    }

    const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const nextItems = parsedHtml.querySelector('cart-items');
    if (!nextItems) {
      return;
    }

    this.innerHTML = nextItems.innerHTML;

    const currentDialog = this.closest('#cart-dialog');
    const nextDialog = parsedHtml.querySelector('#cart-dialog');
    const nextEmpty = nextDialog && nextDialog.getAttribute('data-cart-empty');
    if (currentDialog && nextEmpty !== null) {
      currentDialog.setAttribute('data-cart-empty', nextEmpty);
    }
  }
}
customElements.define('cart-items', CartItems);

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
    this.form = null;
    this.input = null;
    this.submitButton = null;
    this.isSaving = false;
    this.savedTimeoutId = null;
    this.defaultButtonText = '';
    this.savedButtonText = '';
    
    this.boundHandlers = {
      submit: (e) => this.handleSubmit(e),
      input: () => this.handleInput(),
      cartUpdated: (e) => this.handleCartUpdated(e)
    };
  }

  connectedCallback() {
    this.form = this.querySelector('form');
    this.input = this.querySelector('textarea[name="note"]');
    this.submitButton = this.querySelector('button[type="submit"]');

    this.defaultButtonText = this.submitButton.dataset.textBtnSave || this.submitButton.querySelector('span').textContent.trim();
    this.savedButtonText = this.submitButton.dataset.textNoteSaved || this.defaultButtonText;

    this.form.addEventListener('submit', this.boundHandlers.submit);
    this.input.addEventListener('input', this.boundHandlers.input);
    document.addEventListener('cart:updated', this.boundHandlers.cartUpdated);
  }

  disconnectedCallback() {
    this.form.removeEventListener('submit', this.boundHandlers.submit);
    this.input.removeEventListener('input', this.boundHandlers.input);
    document.removeEventListener('cart:updated', this.boundHandlers.cartUpdated);
    this.clearSavedTimeout();
  }

  async handleSubmit(event) {
    event.preventDefault();

    if (!this.input || this.isSaving) return;

    this.isSaving = true;
    this.setButtonState(this.defaultButtonText, true);

    try {
      await ThemeCart.update({ note: this.input.value });
      this.showSavedButtonText();
    } finally {
      this.isSaving = false;
      this.submitButton.disabled = false;
      this.submitButton.classList.remove('is-loading');
      this.submitButton.removeAttribute('aria-busy');
    }
  }

  handleInput() {
    if (!this.isSaving) {
      this.showDefaultButtonText();
    }
  }

  handleCartUpdated(event) {
    const sectionHtml = event.detail?.sections?.['cart-dialog'];
    if (!sectionHtml) return;

    const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const currentNoteDetails = document.querySelector('#cart-dialog-note-details');
    const nextNoteDetails = parsedHtml.querySelector('#cart-dialog-note-details');
    
    if (!currentNoteDetails || !nextNoteDetails) return;

    const shouldHide = nextNoteDetails.hasAttribute('hidden');
    currentNoteDetails.toggleAttribute('hidden', shouldHide);
    if (shouldHide) {
      currentNoteDetails.removeAttribute('open');
    }
  }

  setButtonState(text, isBusy) {
    this.submitButton.querySelector('span').textContent = text;
    this.submitButton.disabled = isBusy;
    this.submitButton.classList.toggle('is-loading', isBusy);
    this.submitButton.toggleAttribute('aria-busy', isBusy);
  }

  showDefaultButtonText() {
    this.clearSavedTimeout();
    this.setButtonState(this.defaultButtonText, false);
  }

  showSavedButtonText() {
    this.setButtonState(this.savedButtonText, false);
    this.clearSavedTimeout();
    
    this.savedTimeoutId = window.setTimeout(() => {
      this.savedTimeoutId = null;
      this.setButtonState(this.defaultButtonText, false);
    }, 2000);
  }

  clearSavedTimeout() {
    if (this.savedTimeoutId) {
      window.clearTimeout(this.savedTimeoutId);
      this.savedTimeoutId = null;
    }
  }
}
customElements.define('cart-note', CartNote);


class CartSubtotal extends HTMLElement {
  constructor() {
    super();
    this.boundHandlers = {
      cartUpdated: (e) => ThemeCart.updateElements(e, [{ selector: 'cart-subtotal' }])
    };
  }

  connectedCallback() {
    document.addEventListener('cart:updated', this.boundHandlers.cartUpdated);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:updated', this.boundHandlers.cartUpdated);
  }
}
customElements.define('cart-subtotal', CartSubtotal);

class CartAppliedDiscounts extends HTMLElement {
  constructor() {
    super();
    this.boundHandlers = {
      cartUpdated: (e) => ThemeCart.updateElements(e, [{ selector: 'cart-applied-discounts', sectionNames: ['cart-dialog', 'cart-drawer'] }])
    };
  }

  connectedCallback() {
    document.addEventListener('cart:updated', this.boundHandlers.cartUpdated);
  }

  disconnectedCallback() {
    document.removeEventListener('cart:updated', this.boundHandlers.cartUpdated);
  }
}
customElements.define('cart-applied-discounts', CartAppliedDiscounts);

function initCartCheckoutLoadingState() {
  document.addEventListener('submit', (event) => {
    console.log('Form submitted', event);
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const submitter = event.submitter;
    if (!(submitter instanceof HTMLButtonElement)) {
      return;
    }

    if (submitter.name !== 'checkout') {
      return;
    }

    const dialog = form.closest('#cart-dialog');
    if (!dialog) {
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
