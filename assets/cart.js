class ThemeCart {
  static sectionsToRender = ['cart-badge', 'cart-drawer'];
  static defaultSectionsUrl = window.location.pathname;

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

  static async get() {
    console.log('Getting cart');
  }

  static async add(payload) {
    console.log('Adding to cart', payload);

    let body, headers

    if (payload instanceof FormData) {
      body = payload;
      body.append('sections', ThemeCart.sectionsToRender.join(','));
      body.append('sections_url', ThemeCart.defaultSectionsUrl);
    } else {
      body = JSON.stringify({
        ...(payload || {}),
        sections: ThemeCart.sectionsToRender,
        sections_url: ThemeCart.defaultSectionsUrl
      });
      headers = { 'Content-Type': 'application/json' };
    }

    const response = await fetch(`${window.theme.routes.cart.add}.js`, {
      method: 'POST',
      headers,
      body
    });

    console.log('Cart add response', response);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.description || 'Unable to add to cart');
    }

    const result = await response.json();
    ThemeCart.dispatchCartUpdated('add', result);

    return result;
  }

  static async update(payload) {
    console.log('Updating cart', payload);
  }

  static async change(payload) {
    console.log('Changing cart', payload);
  }

  static async remove(payload) {
    console.log('Removing from cart', payload);
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
