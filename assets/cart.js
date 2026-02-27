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
    this.onDecreaseClick = this.onDecreaseClick.bind(this);
    this.onIncreaseClick = this.onIncreaseClick.bind(this);
    this.onInputChange = this.onInputChange.bind(this);
    this.onInputCommit = this.onInputCommit.bind(this);
    this.onFocusIn = this.onFocusIn.bind(this);
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

    this.decreaseButton.addEventListener('click', this.onDecreaseClick);
    this.increaseButton.addEventListener('click', this.onIncreaseClick);
    this.input.addEventListener('input', this.onInputChange);
    this.input.addEventListener('change', this.onInputCommit);
    this.input.addEventListener('blur', this.onInputCommit);
    this.addEventListener('focusin', this.onFocusIn);

    this.syncState();
  }

  disconnectedCallback() {
    if (this.decreaseButton) {
      this.decreaseButton.removeEventListener('click', this.onDecreaseClick);
    }
    if (this.increaseButton) {
      this.increaseButton.removeEventListener('click', this.onIncreaseClick);
    }
    if (this.input) {
      this.input.removeEventListener('input', this.onInputChange);
      this.input.removeEventListener('change', this.onInputCommit);
      this.input.removeEventListener('blur', this.onInputCommit);
    }
    this.removeEventListener('focusin', this.onFocusIn);
  }

  static bindCartUpdatedListener() {
    if (CartItemQtySwitcher.isCartUpdatedListenerBound) {
      return;
    }

    document.addEventListener('cart:updated', () => {
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
        if (!switchers.length) {
          return;
        }

        const nextIndex = Math.min(activeSwitcherIndex, switchers.length - 1);
        const nextSwitcher = switchers[nextIndex];
        const nextInput = nextSwitcher ? nextSwitcher.querySelector('input[name="updates[]"]') : null;
        if (nextInput) {
          nextInput.focus({ preventScroll: true });
        }
      });
    });

    CartItemQtySwitcher.isCartUpdatedListenerBound = true;
  }

  getLineItemKey() {
    return this.getAttribute('data-line-item-key') || this.input?.dataset?.lineItemKey || null;
  }

  getMin() {
    const min = Number(this.input?.min);
    return Number.isFinite(min) ? min : 0;
  }

  getMax() {
    return null;
  }

  getStep() {
    const step = Number(this.input?.step);
    return Number.isFinite(step) && step > 0 ? step : 1;
  }

  getValue() {
    const value = Number(this.input?.value);
    return Number.isFinite(value) ? value : this.getMin();
  }

  normalizeValue(nextValue) {
    const min = this.getMin();
    let value = Number.isFinite(nextValue) ? nextValue : min;

    if (value < min) {
      value = min;
    }

    return value;
  }

  setValue(nextValue) {
    if (!this.input) {
      return;
    }

    this.input.value = String(this.normalizeValue(nextValue));
  }

  syncState() {
    if (!this.input || !this.decreaseButton || !this.increaseButton) {
      return;
    }

    const min = this.getMin();
    const value = this.normalizeValue(this.getValue());

    if (String(value) !== this.input.value) {
      this.input.value = String(value);
    }

    this.decreaseButton.disabled = value <= min;
    this.increaseButton.disabled = false;

    if (this.isUpdating) {
      this.setAttribute('aria-busy', 'true');
    } else {
      this.removeAttribute('aria-busy');
    }
  }

  async requestQuantity(nextQuantity) {
    const lineItemKey = this.getLineItemKey();
    if (!lineItemKey) {
      return;
    }

    const quantity = this.normalizeValue(nextQuantity);

    if (!this.isUpdating && quantity === this.lastCommittedQuantity) {
      this.setValue(quantity);
      this.syncState();
      return;
    }

    if (this.isUpdating) {
      this.queuedQuantity = quantity;
      return;
    }

    CartItemQtySwitcher.shouldRestoreFocusOnNextUpdate = true;
    this.isUpdating = true;
    this.queuedQuantity = null;
    this.syncState();

    try {
      await ThemeCart.change({
        id: lineItemKey,
        quantity
      });
      this.lastCommittedQuantity = quantity;
    } catch (_error) {
      CartItemQtySwitcher.shouldRestoreFocusOnNextUpdate = false;
      this.setValue(this.lastCommittedQuantity);
    } finally {
      this.isUpdating = false;
      this.syncState();
    }

    if (this.queuedQuantity !== null && this.queuedQuantity !== this.lastCommittedQuantity) {
      const queuedQuantity = this.queuedQuantity;
      this.queuedQuantity = null;
      this.requestQuantity(queuedQuantity);
    }
  }

  onDecreaseClick(event) {
    event.preventDefault();
    const quantity = this.getValue() - this.getStep();
    this.setValue(quantity);
    this.syncState();
    this.requestQuantity(quantity);
  }

  onIncreaseClick(event) {
    event.preventDefault();
    const quantity = this.getValue() + this.getStep();
    this.setValue(quantity);
    this.syncState();
    this.requestQuantity(quantity);
  }

  onInputChange() {
    this.syncState();
  }

  onInputCommit() {
    this.requestQuantity(this.getValue());
  }

  onFocusIn() {
    const cartItems = this.closest('cart-items');
    if (!cartItems) {
      CartItemQtySwitcher.activeSwitcherIndex = null;
      return;
    }

    const switchers = Array.from(cartItems.querySelectorAll('cart-item-qty-switcher'));
    const index = switchers.indexOf(this);
    CartItemQtySwitcher.activeSwitcherIndex = index >= 0 ? index : null;
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
    this.onSubmit = this.onSubmit.bind(this);
    this.onInput = this.onInput.bind(this);
    this.onCartUpdated = this.onCartUpdated.bind(this);
  }

  connectedCallback() {
    this.form = this.querySelector('form');
    this.input = this.querySelector('textarea[name="note"]');
    this.submitButton = this.querySelector('button[type="submit"]');

    this.defaultButtonText = this.submitButton.dataset.textBtnSave || this.submitButton.querySelector('span').textContent.trim();
    this.savedButtonText = this.submitButton.dataset.textNoteSaved || this.defaultButtonText;

    this.form.addEventListener('submit', this.onSubmit);
    this.input.addEventListener('input', this.onInput);
    document.addEventListener('cart:updated', this.onCartUpdated);
  }

  disconnectedCallback() {
    this.form.removeEventListener('submit', this.onSubmit);
    this.input.removeEventListener('input', this.onInput);
    document.removeEventListener('cart:updated', this.onCartUpdated);

    if (this.savedTimeoutId) {
      window.clearTimeout(this.savedTimeoutId);
      this.savedTimeoutId = null;
    }
  }

  setButtonState(text, isBusy) {
    if (!this.submitButton) {
      return;
    }

    this.submitButton.querySelector('span').textContent = text;
    this.submitButton.disabled = isBusy;

    if (isBusy) {
      this.submitButton.classList.add('is-loading');
      this.submitButton.setAttribute('aria-busy', 'true');
    } else {
      this.submitButton.classList.remove('is-loading');
      this.submitButton.removeAttribute('aria-busy');
    }
  }

  showDefaultButtonText() {
    if (this.savedTimeoutId) {
      window.clearTimeout(this.savedTimeoutId);
      this.savedTimeoutId = null;
    }

    this.setButtonState(this.defaultButtonText, false);
  }

  showSavedButtonText() {
    this.setButtonState(this.savedButtonText, false);

    if (this.savedTimeoutId) {
      window.clearTimeout(this.savedTimeoutId);
    }

    this.savedTimeoutId = window.setTimeout(() => {
      this.savedTimeoutId = null;
      this.setButtonState(this.defaultButtonText, false);
    }, 2000);
  }

  async onSubmit(event) {
    event.preventDefault();

    if (!this.input || this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.setButtonState(this.defaultButtonText, true);

    try {
      await ThemeCart.update({
        note: this.input.value
      });
      this.showSavedButtonText();
    } finally {
      this.isSaving = false;
      this.submitButton.disabled = false;
      this.submitButton.classList.remove('is-loading');
      this.submitButton.removeAttribute('aria-busy');
    }
  }

  onInput() {
    if (this.isSaving) {
      return;
    }

    this.showDefaultButtonText();
  }

  onCartUpdated(event) {
    const detail = event.detail || {};
    const sections = detail.sections || {};
    const sectionHtml = sections['cart-dialog'];
    if (!sectionHtml) {
      return;
    }

    const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const currentNoteDetails = document.querySelector('#cart-dialog-note-details');
    const nextNoteDetails = parsedHtml.querySelector('#cart-dialog-note-details');
    if (!currentNoteDetails || !nextNoteDetails) {
      return;
    }

    const shouldHide = nextNoteDetails.hasAttribute('hidden');
    currentNoteDetails.toggleAttribute('hidden', shouldHide);
    if (shouldHide) {
      currentNoteDetails.removeAttribute('open');
    }
  }
}
customElements.define('cart-note', CartNote);

class CartSubtotal extends HTMLElement {
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
    const sectionHtml = sections['cart-dialog'];
    if (!sectionHtml) {
      return;
    }

    const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const nextSubtotal = parsedHtml.querySelector('cart-subtotal');
    if (!nextSubtotal) {
      return;
    }

    this.innerHTML = nextSubtotal.innerHTML;
  }
}
customElements.define('cart-subtotal', CartSubtotal);

class CartAppliedDiscounts extends HTMLElement {
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
    const sectionHtml = sections['cart-dialog'] || sections['cart-drawer'];
    if (!sectionHtml) {
      return;
    }

    const parsedHtml = new DOMParser().parseFromString(sectionHtml, 'text/html');
    const nextAppliedDiscounts = parsedHtml.querySelector('cart-applied-discounts');
    if (!nextAppliedDiscounts) {
      return;
    }

    this.innerHTML = nextAppliedDiscounts.innerHTML;
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

// class CartError extends Error {
//   constructor(message, context) {
//     super(message);
//     this.name = 'CartError';
//     this.status = context && context.status ? context.status : null;
//     this.response = context && context.response ? context.response : null;
//   }
// }

// class Cart {
//   constructor(options) {
//     var config = options || {};
//     var routeConfig = config.routes || (window.themeRoutes && window.themeRoutes.cart) || {};
//     var root = config.baseUrl || (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '';

//     this.baseUrl = root;
//     this.defaultSectionsUrl = config.sectionsUrl || window.location.pathname;
//     this.routes = {
//       get: this.toAjaxPath(routeConfig.get || root + 'cart'),
//       add: this.toAjaxPath(routeConfig.add || root + 'cart/add'),
//       update: this.toAjaxPath(routeConfig.update || root + 'cart/update'),
//       change: this.toAjaxPath(routeConfig.change || root + 'cart/change'),
//       clear: this.toAjaxPath(routeConfig.clear || root + 'cart/clear')
//     };
//   }

//   async get() {
//     return this.request(this.routes.get, { method: 'GET' });
//   }

//   async add(payload) {
//     var data = payload || {};
//     var quantity = Number(data.quantity || 1);

//     if (!data.id) {
//       throw new CartError('Cart.add requires an id');
//     }

//     return this.mutate('add', {
//       id: data.id,
//       quantity: Number.isNaN(quantity) || quantity < 1 ? 1 : quantity,
//       properties: data.properties,
//       selling_plan: data.selling_plan,
//       sections: data.sections,
//       sections_url: data.sections_url || this.defaultSectionsUrl
//     });
//   }

//   async update(input) {
//     var data = input || {};

//     if (!data.updates || typeof data.updates !== 'object') {
//       throw new CartError('Cart.update requires an updates object');
//     }

//     return this.mutate('update', {
//       updates: data.updates,
//       note: data.note,
//       attributes: data.attributes,
//       sections: data.sections,
//       sections_url: data.sections_url || this.defaultSectionsUrl
//     });
//   }

//   async change(input) {
//     var data = input || {};
//     var quantity = Number(data.quantity);

//     if (!Number.isFinite(quantity) || quantity < 0) {
//       throw new CartError('Cart.change requires a quantity >= 0');
//     }

//     if (!data.line && !data.id) {
//       throw new CartError('Cart.change requires line or id');
//     }

//     return this.mutate('change', {
//       line: data.line,
//       id: data.id,
//       quantity: quantity,
//       properties: data.properties,
//       selling_plan: data.selling_plan,
//       sections: data.sections,
//       sections_url: data.sections_url || this.defaultSectionsUrl
//     });
//   }

//   async remove(input) {
//     var data = input || {};

//     return this.change({
//       line: data.line,
//       id: data.id,
//       quantity: 0,
//       sections: data.sections,
//       sections_url: data.sections_url || this.defaultSectionsUrl
//     });
//   }

//   async clear(input) {
//     var data = input || {};

//     return this.mutate('clear', {
//       sections: data.sections,
//       sections_url: data.sections_url || this.defaultSectionsUrl
//     });
//   }

//   async mutate(routeKey, body) {
//     var path = this.routes[routeKey];

//     if (!path) {
//       throw new CartError('Unknown cart route: ' + routeKey);
//     }

//     var result = await this.request(path, {
//       method: 'POST',
//       body: body
//     });

//     document.dispatchEvent(new CustomEvent('cart:updated', {
//       detail: {
//         path: routeKey,
//         cart: result
//       }
//     }));

//     return result;
//   }

//   async request(path, options) {
//     var requestOptions = options || {};
//     var method = requestOptions.method || 'POST';
//     var endpoint = this.resolveUrl(path);
//     var fetchOptions = {
//       method: method,
//       headers: {
//         Accept: 'application/json'
//       },
//       credentials: 'same-origin'
//     };

//     if (requestOptions.body && method !== 'GET') {
//       fetchOptions.headers['Content-Type'] = 'application/json';
//       fetchOptions.body = JSON.stringify(this.compact(requestOptions.body));
//     }

//     var response = await fetch(endpoint, fetchOptions);
//     var payload = await this.parseResponse(response);

//     if (!response.ok) {
//       throw new CartError(this.getErrorMessage(payload), {
//         status: response.status,
//         response: payload
//       });
//     }

//     return payload;
//   }

//   async parseResponse(response) {
//     var text = await response.text();

//     if (!text) {
//       return {};
//     }

//     try {
//       return JSON.parse(text);
//     } catch (error) {
//       return text;
//     }
//   }

//   compact(value) {
//     var output = {};

//     Object.keys(value || {}).forEach(function (key) {
//       var current = value[key];
//       if (current === undefined || current === null || current === '') {
//         return;
//       }

//       output[key] = current;
//     });

//     return output;
//   }

//   resolveUrl(path) {
//     if (!path) {
//       return '';
//     }

//     if (path.indexOf('http://') === 0 || path.indexOf('https://') === 0) {
//       return path;
//     }

//     if (path.charAt(0) === '/') {
//       return path;
//     }

//     return this.baseUrl + path;
//   }

//   toAjaxPath(path) {
//     var value = path || '';
//     var queryIndex = value.indexOf('?');
//     var hashIndex = value.indexOf('#');
//     var splitIndex = -1;
//     var suffix = '';
//     var base = value;

//     if (queryIndex >= 0 && hashIndex >= 0) {
//       splitIndex = Math.min(queryIndex, hashIndex);
//     } else {
//       splitIndex = queryIndex >= 0 ? queryIndex : hashIndex;
//     }

//     if (splitIndex >= 0) {
//       base = value.slice(0, splitIndex);
//       suffix = value.slice(splitIndex);
//     }

//     if (base.slice(-3) === '.js') {
//       return base + suffix;
//     }

//     return base + '.js' + suffix;
//   }

//   getErrorMessage(payload) {
//     if (!payload) {
//       return 'Cart request failed';
//     }

//     if (typeof payload === 'string') {
//       return payload;
//     }

//     return payload.description || payload.message || 'Cart request failed';
//   }
// }

// window.Cart = Cart;
// window.themeCart = window.themeCart || new Cart();
