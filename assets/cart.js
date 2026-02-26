class ThemeCart {
  static sectionsToRender = ['cart-badge', 'cart-dialog'];
  static defaultSectionsUrl = `${window.location.pathname}${window.location.search}`;
  static loadingCount = 0;

  static dispatchCartUpdated(action, result) {
    document.dispatchEvent(
      new CustomEvent('cart:updated', {
        detail: {
          action,
          cart: result,
          sections: result && result.sections ? result.sections : {}
        }
      })
    );
  }

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

  static dispatchCartError(action, error) {
    document.dispatchEvent(
      new CustomEvent('cart:error', {
        detail: {
          action,
          error
        }
      })
    );
  }

  static async parseError(response) {
    const errorText = await response.text();

    try {
      const errorData = JSON.parse(errorText);
      return errorData.description || errorData.message || 'Unable to update cart';
    } catch (_error) {
      return errorText || 'Unable to update cart';
    }
  }

  static async get() {
    console.log('Getting cart');
  }

  static async add(payload, options) {
    let body;
    const config = options || {};

    if (payload instanceof FormData) {
      body = payload;
      body.set('sections', ThemeCart.sectionsToRender.join(','));
      body.set('sections_url', ThemeCart.defaultSectionsUrl);
    } else {
      body = JSON.stringify({
        ...(payload || {}),
        sections: ThemeCart.sectionsToRender,
        sections_url: ThemeCart.defaultSectionsUrl
      });
    }

    ThemeCart.setLoading(true);
    try {
      const response = await fetch(`${window.theme.routes.cart.add}.js`, {
        method: 'POST',
        body
      });

      if (!response.ok) {
        const message = await ThemeCart.parseError(response);
        const error = new Error(message);
        ThemeCart.dispatchCartError('add', error);
        throw error;
      }

      const result = await response.json();
      ThemeCart.dispatchCartUpdated('add', result);
      ThemeCart.openDrawer(config.returnFocusTarget);

      return result;
    } finally {
      ThemeCart.setLoading(false);
    }
  }

  static async update(payload) {
    console.log('Updating cart', payload);
  }

  static async change(payload) {
    ThemeCart.setLoading(true);
    try {
      const response = await fetch(`${window.theme.routes.cart.change}.js`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...(payload || {}),
          sections: ThemeCart.sectionsToRender,
          sections_url: ThemeCart.defaultSectionsUrl
        })
      });

      if (!response.ok) {
        const message = await ThemeCart.parseError(response);
        const error = new Error(message);
        ThemeCart.dispatchCartError('change', error);
        throw error;
      }

      const result = await response.json();
      ThemeCart.dispatchCartUpdated('change', result);

      return result;
    } finally {
      ThemeCart.setLoading(false);
    }
  }

  static async remove(payload) {
    return ThemeCart.change({
      ...(payload || {}),
      quantity: 0
    });
  }

  static async clear(payload) {
    console.log('Clearing cart', payload);
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
    const sectionHtml = sections['cart-dialog'] || sections['cart-drawer'];
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
  }

  connectedCallback() {
    this.input = this.querySelector('input[name="updates[]"]');
    this.decreaseButton = this.querySelector('button[name="decrease"]');
    this.increaseButton = this.querySelector('button[name="increase"]');

    this.lastCommittedQuantity = this.getValue();

    this.decreaseButton.addEventListener('click', this.onDecreaseClick);
    this.increaseButton.addEventListener('click', this.onIncreaseClick);
    this.input.addEventListener('input', this.onInputChange);
    this.input.addEventListener('change', this.onInputCommit);
    this.input.addEventListener('blur', this.onInputCommit);

    this.syncState();
  }

  disconnectedCallback() {
    this.decreaseButton.removeEventListener('click', this.onDecreaseClick);
    this.increaseButton.removeEventListener('click', this.onIncreaseClick);
    this.input.removeEventListener('input', this.onInputChange);
    this.input.removeEventListener('change', this.onInputCommit);
    this.input.removeEventListener('blur', this.onInputCommit);
  }

  getLineItemKey() {
    return this.input?.dataset?.lineItemKey || null;
  }

  getMin() {
    const min = Number(this.input?.min);
    return Number.isFinite(min) ? min : 0;
  }

  getMax() {
    const rawMax = this.input?.getAttribute('max');
    if (rawMax === null || rawMax === '') {
      return null;
    }

    const max = Number(rawMax);
    return Number.isFinite(max) && max >= this.getMin() ? max : null;
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
    const max = this.getMax();
    let value = Number.isFinite(nextValue) ? nextValue : min;

    if (value < min) {
      value = min;
    }

    if (max !== null && value > max) {
      value = max;
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
    const max = this.getMax();
    const value = this.normalizeValue(this.getValue());

    if (String(value) !== this.input.value) {
      this.input.value = String(value);
    }

    this.decreaseButton.disabled = value <= min;
    this.increaseButton.disabled = max !== null && value >= max;

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
}
customElements.define('cart-item-qty-switcher', CartItemQtySwitcher);

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
