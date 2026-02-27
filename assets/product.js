/*
  Product form
*/
class ProductForm extends HTMLElement {
  constructor() {
    super();
    this.form = null;
    this.submitButton = null;
    this.submitButtonLabel = null;
    this.variantInput = null;
    this.quantityInput = null;
    this.onSubmit = this.onSubmit.bind(this);
    this.onVariantChange = this.onVariantChange.bind(this);
  }

  connectedCallback() {
    this.form = this.querySelector('form');
    this.submitButton = this.form.querySelector('button[type="submit"]');
    this.submitButtonLabel = this.submitButton.querySelector('span');
    this.variantInput = this.form.querySelector('input[name="id"]');
    this.quantityInput = this.form.querySelector('input[name="quantity"]');
    this.form.addEventListener('submit', this.onSubmit);
    document.addEventListener('product:variant-change', this.onVariantChange);
  }

  disconnectedCallback() {
    this.form.removeEventListener('submit', this.onSubmit);
    document.removeEventListener('product:variant-change', this.onVariantChange);
  }

  getSectionId() {
    return this.getAttribute('data-section-id');
  }

  updateSubmitButtonState(variant) {
    const productStrings =
      window.theme && window.theme.strings && window.theme.strings.product
        ? window.theme.strings.product
        : {};

    let buttonText = productStrings.unavailable || 'Unavailable';
    let disabled = true;

    if (variant && variant.available) {
      buttonText = productStrings.addToCart || 'Add to cart';
      disabled = false;
    } else if (variant && !variant.available) {
      buttonText = productStrings.soldOut || 'Sold out';
    }

    this.submitButton.disabled = disabled;
    this.submitButtonLabel.textContent = buttonText;
  }

  onVariantChange(event) {
    const detail = event.detail || {};
    const variant = detail.variant || null;
    const eventSectionId = detail.sectionId || null;
    const sectionId = this.getSectionId();

    if (sectionId && eventSectionId && sectionId !== String(eventSectionId)) {
      return;
    }

    if (!variant || !variant.id) {
      this.updateSubmitButtonState(null);
      return;
    }

    this.variantInput.value = String(variant.id);
    this.updateSubmitButtonState(variant);
  }

  async onSubmit(event) {
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
      ThemeNotification.show(
        window.theme.strings.product.cartErrorTitle,
        error.message,
        'error'
      );
    } finally {
      this.submitButton.disabled = false;
      this.submitButton.removeAttribute('aria-busy');
      this.submitButton.classList.remove('is-loading');
    }
  }
}
customElements.define('product-form', ProductForm);

/*
  Product options
*/
class ProductOptions extends HTMLElement {
  constructor() {
    super();
    this.optionInputs = [];
    this.onOptionChange = this.onOptionChange.bind(this);
  }

  connectedCallback() {
    this.optionInputs = Array.from(this.querySelectorAll('input[type="radio"], select'));
    this.optionInputs.forEach((input) => {
      input.addEventListener('change', this.onOptionChange);
    });
    this.handleOptionsAvailability();
  }

  disconnectedCallback() {
    this.optionInputs.forEach((input) => {
      input.removeEventListener('change', this.onOptionChange);
    });
  }

  getSelectedOptions() {
    const selectedOptions = [];
    const controls = Array.from(this.querySelectorAll('input[type="radio"]:checked, select'));

    controls.forEach((control) => {
      if (control.tagName === 'SELECT') {
        if (control.value !== '') {
          selectedOptions.push(control.value);
        }
        return;
      }

      selectedOptions.push(control.value);
    });

    return selectedOptions;
  }

  getVariants() {
    const variantsScript = this.querySelector('script[data-product-variants]');
    if (!variantsScript) {
      return [];
    }

    try {
      const variants = JSON.parse(variantsScript.textContent || '[]');
      return Array.isArray(variants) ? variants : [];
    } catch (_error) {
      return [];
    }
  }

  findSelectedVariant() {
    const selectedOptions = this.getSelectedOptions();
    if (!selectedOptions.length) {
      return null;
    }

    const variants = this.getVariants();
    return (
      variants.find((variant) => {
        const variantOptions = [variant.option1, variant.option2, variant.option3];
        return selectedOptions.every((optionValue, optionIndex) => {
          return variantOptions[optionIndex] === optionValue;
        });
      }) || null
    );
  }

  getSectionId() {
    return this.getAttribute('data-section-id');
  }

  getSelectedOptionsByPosition() {
    const selectedOptions = {};
    const checkedRadios = Array.from(this.querySelectorAll('input[type="radio"][data-option-position]:checked'));
    const selects = Array.from(this.querySelectorAll('select[data-option-position]'));

    checkedRadios.forEach((input) => {
      const position = Number(input.dataset.optionPosition);
      if (Number.isFinite(position) && position > 0) {
        selectedOptions[position] = input.value;
      }
    });

    selects.forEach((select) => {
      const position = Number(select.dataset.optionPosition);
      if (Number.isFinite(position) && position > 0 && select.value !== '') {
        selectedOptions[position] = select.value;
      }
    });

    return selectedOptions;
  }

  isOptionValueAvailable(position, value, selectedByPosition) {
    const variants = this.getVariants();

    return variants.some((variant) => {
      if (!variant.available) {
        return false;
      }

      const variantOptions = [variant.option1, variant.option2, variant.option3];

      for (let index = 1; index <= 3; index += 1) {
        const selectedValue = index === position ? value : selectedByPosition[index];
        if (!selectedValue) {
          continue;
        }

        if (variantOptions[index - 1] !== selectedValue) {
          return false;
        }
      }

      return true;
    });
  }

  handleOptionsAvailability() {
    const selectedByPosition = this.getSelectedOptionsByPosition();

    const radioInputs = Array.from(
      this.querySelectorAll('input[type="radio"][data-option-position]')
    );
    radioInputs.forEach((input) => {
      const position = Number(input.dataset.optionPosition);
      if (!Number.isFinite(position) || position < 1) {
        return;
      }

      const isAvailable = this.isOptionValueAvailable(position, input.value, selectedByPosition);
      input.classList.toggle('disabled', !isAvailable);
      if (isAvailable) {
        input.removeAttribute('aria-disabled');
      } else {
        input.setAttribute('aria-disabled', 'true');
      }
    });

    const selectInputs = Array.from(this.querySelectorAll('select[data-option-position]'));
    selectInputs.forEach((select) => {
      const position = Number(select.dataset.optionPosition);
      if (!Number.isFinite(position) || position < 1) {
        return;
      }

      Array.from(select.options).forEach((option) => {
        const isAvailable = this.isOptionValueAvailable(position, option.value, selectedByPosition);
        option.classList.toggle('disabled', !isAvailable);
        if (isAvailable) {
          option.removeAttribute('aria-disabled');
        } else {
          option.setAttribute('aria-disabled', 'true');
        }
      });
    });
  }

  updateSelectedOptionLabels() {
    const swatchValueLabels = Array.from(this.querySelectorAll('[data-selected-option-value]'));

    swatchValueLabels.forEach((label) => {
      const fieldset = label.closest('fieldset');
      if (!fieldset) {
        return;
      }

      const checkedRadio = fieldset.querySelector('input[type="radio"]:checked');
      if (checkedRadio) {
        label.textContent = checkedRadio.value;
      }
    });
  }

  updateVariantUrl(variant) {
    const url = new URL(window.location.href);

    if (variant && variant.id) {
      url.searchParams.set('variant', String(variant.id));
    } else {
      url.searchParams.delete('variant');
    }

    window.history.replaceState({}, '', url.toString());
  }

  onOptionChange() {
    this.updateSelectedOptionLabels();
    this.handleOptionsAvailability();
    const selectedVariant = this.findSelectedVariant();
    console.log('Selected variant', selectedVariant);
    this.updateVariantUrl(selectedVariant);

    this.dispatchEvent(
      new CustomEvent('product:variant-change', {
        bubbles: true,
        detail: {
          variant: selectedVariant || null,
          sectionId: this.getSectionId()
        }
      })
    );
  }
}
customElements.define('product-options', ProductOptions);

/*
  Product price
*/
class ProductPrice extends HTMLElement {
  constructor() {
    super();
    this.sectionId = null;
    this.currentVariantId = null;
    this.priceElement = null;
    this.comparePriceElement = null;
    this.priceElements = [];
    this.unitPriceElement = null;
    this.saleBadgeElement = null;
    this.priceDataById = new Map();
    this.onVariantChange = this.onVariantChange.bind(this);
  }

  connectedCallback() {
    this.sectionId = this.getAttribute('data-section-id');
    this.currentVariantId = this.getAttribute('data-current-variant-id');
    this.priceElement = this.querySelector('.price');
    this.comparePriceElement = this.querySelector('[data-compare-price]');
    this.priceElements = Array.from(this.querySelectorAll('[data-price]'));
    this.unitPriceElement = this.querySelector('[data-unit-price]');
    this.saleBadgeElement = this.querySelector('.badge-sale');
    this.priceDataById = this.getPriceDataById();

    document.addEventListener('product:variant-change', this.onVariantChange);

    if (this.currentVariantId) {
      this.updatePrice(this.currentVariantId);
    }
  }

  disconnectedCallback() {
    document.removeEventListener('product:variant-change', this.onVariantChange);
  }

  getPriceDataById() {
    const valuesScript = this.querySelector('script[data-product-price-values]');
    if (!valuesScript) {
      return new Map();
    }

    try {
      const values = JSON.parse(valuesScript.textContent || '[]');
      if (!Array.isArray(values)) {
        return new Map();
      }

      return new Map(values.map((value) => [String(value.id), value]));
    } catch (_error) {
      return new Map();
    }
  }

  onVariantChange(event) {
    const detail = event.detail || {};
    const variant = detail.variant || null;
    const eventSectionId = detail.sectionId || null;

    if (this.sectionId && eventSectionId && this.sectionId !== String(eventSectionId)) {
      return;
    }

    if (!variant || !variant.id) {
      return;
    }

    this.updatePrice(String(variant.id));
  }

  updatePrice(variantId) {
    const priceData = this.priceDataById.get(String(variantId));
    if (!priceData || !this.priceElement) {
      return;
    }

    this.priceElement.dataset.hasPriceCompare = priceData.hasCompare ? 'true' : 'false';
    this.priceElement.dataset.hasPriceUnit = priceData.hasUnit ? 'true' : 'false';
    this.priceElement.dataset.available = priceData.available ? 'true' : 'false';

    if (this.comparePriceElement) {
      this.comparePriceElement.textContent = priceData.comparePrice || '';
    }

    this.priceElements.forEach((element) => {
      element.textContent = priceData.price || '';
    });

    if (this.unitPriceElement) {
      this.unitPriceElement.textContent = priceData.hasUnit ? priceData.unitPrice || '' : '';
    }

    if (this.saleBadgeElement) {
      this.saleBadgeElement.textContent = priceData.saleBadge || '';
    }
  }
}
customElements.define('product-price', ProductPrice);

/*
  Product buy button
*/
class ProductBuyButton extends HTMLElement {
  constructor() {
    super();
    this.button = null;
    this.loadingTimeout = null;
    this.onVariantChange = this.onVariantChange.bind(this);
    this.onQuantityChange = this.onQuantityChange.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  connectedCallback() {
    this.button = this.querySelector('button[name="buy"]');
    if (!this.button) {
      return;
    }

    this.button.addEventListener('click', this.onClick);
    document.addEventListener('product:variant-change', this.onVariantChange);
    document.addEventListener('product:quantity-change', this.onQuantityChange);
  }

  disconnectedCallback() {
    if (this.button) {
      this.button.removeEventListener('click', this.onClick);
    }

    if (this.loadingTimeout) {
      window.clearTimeout(this.loadingTimeout);
      this.loadingTimeout = null;
    }

    document.removeEventListener('product:variant-change', this.onVariantChange);
    document.removeEventListener('product:quantity-change', this.onQuantityChange);
  }

  getSectionId() {
    return this.getAttribute('data-section-id');
  }

  updateButtonState(variant) {
    let disabled = true;

    if (variant && variant.available) {
      disabled = false;
    }

    this.button.disabled = disabled;
  }

  getVariantId() {
    const variantId = this.getAttribute('data-variant-id');
    return variantId && variantId !== '' ? variantId : null;
  }

  getQuantity() {
    const quantity = Number(this.getAttribute('data-quantity'));
    if (!Number.isFinite(quantity) || quantity < 1) {
      return 1;
    }

    return quantity;
  }

  onClick() {
    const variantId = this.getVariantId();
    if (!variantId) {
      return;
    }

    const quantity = this.getQuantity();
    this.button.disabled = true;
    this.button.setAttribute('aria-busy', 'true');
    this.button.classList.add('is-loading');

    if (this.loadingTimeout) {
      window.clearTimeout(this.loadingTimeout);
    }

    this.loadingTimeout = window.setTimeout(() => {
      this.button.disabled = false;
      this.button.removeAttribute('aria-busy');
      this.button.classList.remove('is-loading');
      this.loadingTimeout = null;
    }, 3000);

    window.location.href = `/cart/${encodeURIComponent(variantId)}:${encodeURIComponent(quantity)}`;
  }

  onVariantChange(event) {
    const detail = event.detail || {};
    const variant = detail.variant || null;
    const eventSectionId = detail.sectionId || null;
    const sectionId = this.getSectionId();

    if (sectionId && eventSectionId && sectionId !== String(eventSectionId)) {
      return;
    }

    if (variant && variant.id) {
      this.setAttribute('data-variant-id', String(variant.id));
    }

    this.updateButtonState(variant);
  }

  onQuantityChange(event) {
    const detail = event.detail || {};
    const quantity = detail.quantity || null;
    const eventSectionId = detail.sectionId || null;
    const sectionId = this.getSectionId();

    if (sectionId && eventSectionId && sectionId !== String(eventSectionId)) {
      return;
    }

    if (!Number.isFinite(Number(quantity)) || Number(quantity) < 1) {
      return;
    }

    this.setAttribute('data-quantity', String(quantity));
  }
}
customElements.define('product-buy-button', ProductBuyButton);


/*
  Product qty switcher
*/
class ProductQtySwitcher extends HTMLElement {
  constructor() {
    super();
    this.input = null;
    this.decreaseButton = null;
    this.increaseButton = null;
    this.lastEmittedQuantity = null;
    this.onDecreaseClick = this.onDecreaseClick.bind(this);
    this.onIncreaseClick = this.onIncreaseClick.bind(this);
    this.onInputChange = this.onInputChange.bind(this);
    this.onVariantChange = this.onVariantChange.bind(this);
  }

  connectedCallback() {
    this.input = this.querySelector('input[name="quantity"]');
    this.decreaseButton = this.querySelector('button[name="decrease"]');
    this.increaseButton = this.querySelector('button[name="increase"]');

    if (!this.input || !this.decreaseButton || !this.increaseButton) {
      return;
    }

    this.decreaseButton.addEventListener('click', this.onDecreaseClick);
    this.increaseButton.addEventListener('click', this.onIncreaseClick);
    this.input.addEventListener('input', this.onInputChange);
    this.input.addEventListener('change', this.onInputChange);
    this.input.addEventListener('blur', this.onInputChange);
    document.addEventListener('product:variant-change', this.onVariantChange);

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
      this.input.removeEventListener('change', this.onInputChange);
      this.input.removeEventListener('blur', this.onInputChange);
    }

    document.removeEventListener('product:variant-change', this.onVariantChange);
  }

  getSectionId() {
    return this.getAttribute('data-section-id');
  }

  emitQuantityChange(quantity) {
    if (this.lastEmittedQuantity === quantity) {
      return;
    }

    this.lastEmittedQuantity = quantity;
    this.dispatchEvent(
      new CustomEvent('product:quantity-change', {
        bubbles: true,
        detail: {
          quantity,
          sectionId: this.getSectionId()
        }
      })
    );
  }

  updateMaxFromVariant(variant) {
    if (
      variant &&
      variant.inventory_management !== null &&
      variant.inventory_policy === 'deny' &&
      Number.isFinite(Number(variant.inventory_quantity))
    ) {
      const min = this.getMin();
      const max = Math.max(Number(variant.inventory_quantity), min);
      this.input.max = String(max);
    } else {
      this.input.removeAttribute('max');
    }

    this.setValue(this.getValue());
  }

  onVariantChange(event) {
    const detail = event.detail || {};
    const variant = detail.variant || null;
    const eventSectionId = detail.sectionId || null;
    const sectionId = this.getSectionId();

    if (sectionId && eventSectionId && sectionId !== String(eventSectionId)) {
      return;
    }

    this.updateMaxFromVariant(variant);
  }

  getMin() {
    const min = Number(this.input?.min);
    return Number.isFinite(min) ? min : 1;
  }

  getMax() {
    const max = Number(this.input?.max);
    return Number.isFinite(max) && max > 0 ? max : null;
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
    const normalizedValue = this.normalizeValue(nextValue);
    this.input.value = String(normalizedValue);
    this.syncState();
  }

  syncState() {
    const min = this.getMin();
    const max = this.getMax();
    const value = this.normalizeValue(this.getValue());
    const disabled = this.input.disabled;

    if (String(value) !== this.input.value) {
      this.input.value = String(value);
    }

    this.decreaseButton.disabled = disabled || value <= min;
    this.increaseButton.disabled = disabled || (max !== null && value >= max);
    this.emitQuantityChange(value);
  }

  onDecreaseClick() {
    const value = this.getValue();
    this.setValue(value - this.getStep());
  }

  onIncreaseClick() {
    const value = this.getValue();
    this.setValue(value + this.getStep());
  }

  onInputChange() {
    this.syncState();
  }
}
customElements.define('product-qty-switcher', ProductQtySwitcher);

/*
  Product gallery
*/
class ProductGallery extends HTMLElement {
  constructor() {
    super();
    this.items = [];
    this.thumbs = [];
    this.thumbsList = null;
    this.main = null;
    this.prevButton = null;
    this.nextButton = null;
    this.activeIndex = 0;
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
    this.isTouchTracking = false;
    this.sectionId = null;
    this.stickyHost = null;
    this.desktopQuery = null;
    this.headerGroup = null;
    this.oldScroll = 0;
    this.onPrevClick = this.onPrevClick.bind(this);
    this.onNextClick = this.onNextClick.bind(this);
    this.onThumbClick = this.onThumbClick.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
    this.onVariantChange = this.onVariantChange.bind(this);
    this.onStickyScroll = this.onStickyScroll.bind(this);
    this.onStickyMediaChange = this.onStickyMediaChange.bind(this);
  }

  connectedCallback() {
    this.sectionId = this.getAttribute('data-section-id');
    this.items = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-item]'));
    this.thumbs = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-thumb]'));
    this.thumbsList = this.querySelector('.product-gallery-thumbnails');
    this.main = this.querySelector('.product-gallery-main');
    this.prevButton = this.querySelector('[data-gallery-prev]');
    this.nextButton = this.querySelector('[data-gallery-next]');
    this.initStickyDesktop();

    if (!this.items.length) {
      return;
    }

    this.activeIndex = this.items.findIndex((item) => item.classList.contains('is-active'));
    if (this.activeIndex < 0) {
      this.activeIndex = 0;
    }

    if (this.prevButton) {
      this.prevButton.addEventListener('click', this.onPrevClick);
    }

    if (this.nextButton) {
      this.nextButton.addEventListener('click', this.onNextClick);
    }

    this.thumbs.forEach((thumb) => {
      thumb.addEventListener('click', this.onThumbClick);
    });

    if (this.main) {
      this.main.addEventListener('touchstart', this.onTouchStart, { passive: true });
      this.main.addEventListener('touchmove', this.onTouchMove, { passive: true });
      this.main.addEventListener('touchend', this.onTouchEnd);
      this.main.addEventListener('touchcancel', this.onTouchEnd);
    }

    document.addEventListener('product:variant-change', this.onVariantChange);
    this.showItem(this.activeIndex);
  }

  disconnectedCallback() {
    if (this.prevButton) {
      this.prevButton.removeEventListener('click', this.onPrevClick);
    }

    if (this.nextButton) {
      this.nextButton.removeEventListener('click', this.onNextClick);
    }

    this.thumbs.forEach((thumb) => {
      thumb.removeEventListener('click', this.onThumbClick);
    });

    if (this.main) {
      this.main.removeEventListener('touchstart', this.onTouchStart);
      this.main.removeEventListener('touchmove', this.onTouchMove);
      this.main.removeEventListener('touchend', this.onTouchEnd);
      this.main.removeEventListener('touchcancel', this.onTouchEnd);
    }

    document.removeEventListener('product:variant-change', this.onVariantChange);
    this.destroyStickyDesktop();
  }

  getHeaderHeight() {
    return this.headerGroup ? this.headerGroup.clientHeight : 0;
  }

  applyStickyDesktopState() {
    if (!this.stickyHost) {
      return;
    }

    if (!this.desktopQuery || !this.desktopQuery.matches) {
      this.stickyHost.style.position = '';
      this.stickyHost.style.alignSelf = '';
      this.stickyHost.style.top = '';
      return;
    }

    this.stickyHost.style.position = 'sticky';
    this.stickyHost.style.alignSelf = 'start';
    this.stickyHost.style.top = `${this.getHeaderHeight() + 20}px`;
  }

  onStickyMediaChange() {
    this.oldScroll = Math.max(window.scrollY, 0);
    this.applyStickyDesktopState();
  }

  onStickyScroll() {
    const newScroll = window.scrollY;
    if (!this.desktopQuery || !this.desktopQuery.matches || !this.stickyHost) {
      return;
    }

    if (newScroll > this.oldScroll) {
      if (newScroll > this.getHeaderHeight()) {
        this.stickyHost.style.top = '20px';
      }
    } else if (newScroll < this.oldScroll) {
      this.stickyHost.style.top = `${this.getHeaderHeight() + 20}px`;
    }

    this.oldScroll = Math.max(window.scrollY, 0);
  }

  initStickyDesktop() {
    this.stickyHost = this.closest('.product-left');
    if (!this.stickyHost) {
      return;
    }

    this.headerGroup = document.querySelector('#header-group');
    this.desktopQuery = window.matchMedia('(min-width: 1200px)');
    this.oldScroll = Math.max(window.scrollY, 0);

    this.applyStickyDesktopState();
    this.desktopQuery.addEventListener('change', this.onStickyMediaChange);
    window.addEventListener('scroll', this.onStickyScroll, { passive: true });
  }

  destroyStickyDesktop() {
    if (this.desktopQuery) {
      this.desktopQuery.removeEventListener('change', this.onStickyMediaChange);
    }
    window.removeEventListener('scroll', this.onStickyScroll);
  }

  onVariantChange(event) {
    const detail = event.detail || {};
    const variant = detail.variant || null;
    const eventSectionId = detail.sectionId || null;

    if (this.sectionId && eventSectionId && this.sectionId !== String(eventSectionId)) {
      return;
    }

    if (!variant || !variant.featured_media_id) {
      return;
    }

    const targetIndex = this.items.findIndex((item) => {
      return item.dataset.mediaId === String(variant.featured_media_id);
    });

    if (targetIndex < 0) {
      return;
    }

    this.showItem(targetIndex);
  }

  onPrevClick() {
    this.showItem(this.activeIndex - 1);
  }

  onNextClick() {
    this.showItem(this.activeIndex + 1);
  }

  onThumbClick(event) {
    const index = Number(event.currentTarget.dataset.galleryThumb);
    if (Number.isNaN(index)) {
      return;
    }

    this.showItem(index);
  }

  onTouchStart(event) {
    if (event.touches.length !== 1 || this.items.length < 2) {
      this.isTouchTracking = false;
      return;
    }

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
    this.isTouchTracking = true;
  }

  onTouchMove(event) {
    if (!this.isTouchTracking || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    this.touchDeltaX = touch.clientX - this.touchStartX;
    this.touchDeltaY = touch.clientY - this.touchStartY;
  }

  onTouchEnd() {
    if (!this.isTouchTracking) {
      return;
    }

    this.isTouchTracking = false;

    const horizontalDistance = Math.abs(this.touchDeltaX);
    const verticalDistance = Math.abs(this.touchDeltaY);
    if (horizontalDistance < 50 || horizontalDistance <= verticalDistance) {
      return;
    }

    if (this.touchDeltaX < 0) {
      this.onNextClick();
      return;
    }

    this.onPrevClick();
  }

  isVideoAutoplayEnabled(video) {
    if (video.autoplay) {
      return true;
    }

    if (!video.hasAttribute('data-autoplay')) {
      return false;
    }

    return video.dataset.autoplay !== 'false';
  }

  isIframeAutoplayEnabled(iframe) {
    if (!iframe.hasAttribute('data-autoplay')) {
      return false;
    }

    return iframe.dataset.autoplay !== 'false';
  }

  pauseMediaInItem(item) {
    const videos = item.querySelectorAll('video');
    videos.forEach((video) => {
      video.pause();
    });

    const iframes = item.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      const source = iframe.getAttribute('src') || iframe.dataset.src || '';

      if (source.indexOf('youtube.com/embed/') !== -1) {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'pauseVideo', args: '' }),
          '*'
        );
        return;
      }

      if (source.indexOf('player.vimeo.com/video/') !== -1) {
        iframe.contentWindow?.postMessage(JSON.stringify({ method: 'pause' }), '*');
      }
    });
  }

  playMediaInItem(item) {
    const videos = item.querySelectorAll('video');
    videos.forEach((video) => {
      if (!this.isVideoAutoplayEnabled(video)) {
        return;
      }

      video.preload = 'auto';
      video.play().catch(() => {
        // Ignore autoplay failures caused by browser policies.
      });
    });

    const iframes = item.querySelectorAll('iframe');
    iframes.forEach((iframe) => {
      if (!this.isIframeAutoplayEnabled(iframe)) {
        return;
      }

      if (!iframe.getAttribute('src') && iframe.dataset.src) {
        iframe.setAttribute('src', iframe.dataset.src);
      }

      const source = iframe.getAttribute('src') || iframe.dataset.src || '';

      if (source.indexOf('youtube.com/embed/') !== -1) {
        iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
          '*'
        );
        return;
      }

      if (source.indexOf('player.vimeo.com/video/') !== -1) {
        iframe.contentWindow?.postMessage(JSON.stringify({ method: 'play' }), '*');
      }
    });
  }

  pauseAllMedia() {
    this.items.forEach((item) => {
      this.pauseMediaInItem(item);
    });
  }

  updateButtons() {
    const hasMultipleItems = this.items.length > 1;
    if (this.prevButton) {
      this.prevButton.disabled = !hasMultipleItems;
    }

    if (this.nextButton) {
      this.nextButton.disabled = !hasMultipleItems;
    }
  }

  updateThumbs() {
    this.thumbs.forEach((thumb, thumbIndex) => {
      const isActive = thumbIndex === this.activeIndex;
      thumb.classList.toggle('is-active', isActive);
      if (isActive) {
        thumb.setAttribute('aria-current', 'true');
        return;
      }

      thumb.removeAttribute('aria-current');
    });

    if (!this.thumbsList || !this.thumbs[this.activeIndex]) {
      return;
    }

    const leadingThumbIndex = Math.max(this.activeIndex - 1, 0);
    const activeThumb = this.thumbs[leadingThumbIndex];
    const anchorItem = activeThumb.closest('.product-gallery-thumbnail-item') || activeThumb;
    const listRect = this.thumbsList.getBoundingClientRect();
    const anchorRect = anchorItem.getBoundingClientRect();
    const maxScrollLeft = this.thumbsList.scrollWidth - this.thumbsList.clientWidth;
    const relativeLeft = this.thumbsList.scrollLeft + (anchorRect.left - listRect.left);
    const targetScrollLeft = Math.min(Math.max(relativeLeft, 0), Math.max(maxScrollLeft, 0));

    this.thumbsList.scrollTo({
      left: targetScrollLeft,
      behavior: 'smooth'
    });
  }

  showItem(index) {
    if (!this.items.length) {
      return;
    }

    const normalizedIndex = ((index % this.items.length) + this.items.length) % this.items.length;

    this.pauseAllMedia();

    this.items.forEach((item, itemIndex) => {
      const isActive = itemIndex === normalizedIndex;
      item.classList.toggle('is-active', isActive);
      item.setAttribute('aria-hidden', String(!isActive));
      item.toggleAttribute('inert', !isActive);
    });

    this.activeIndex = normalizedIndex;
    this.updateButtons();
    this.updateThumbs();
    this.playMediaInItem(this.items[normalizedIndex]);
  }
}
customElements.define('product-gallery', ProductGallery);
