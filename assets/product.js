/*
  Product gallery
*/
class ProductGallery extends HTMLElement {
  constructor() {
    super();
    this.items = [];
    this.prevButton = null;
    this.nextButton = null;
    this.activeIndex = 0;
    this.onPrevClick = this.onPrevClick.bind(this);
    this.onNextClick = this.onNextClick.bind(this);
  }

  connectedCallback() {
    this.items = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-item]'));
    this.prevButton = this.querySelector('[data-gallery-prev]');
    this.nextButton = this.querySelector('[data-gallery-next]');

    if (!this.items.length || !this.prevButton || !this.nextButton) {
      return;
    }

    this.activeIndex = this.items.findIndex((item) => !item.hasAttribute('hidden'));
    if (this.activeIndex < 0) {
      this.activeIndex = 0;
    }

    this.prevButton.addEventListener('click', this.onPrevClick);
    this.nextButton.addEventListener('click', this.onNextClick);
    this.showItem(this.activeIndex);
  }

  disconnectedCallback() {
    if (this.prevButton) {
      this.prevButton.removeEventListener('click', this.onPrevClick);
    }

    if (this.nextButton) {
      this.nextButton.removeEventListener('click', this.onNextClick);
    }
  }

  onPrevClick() {
    this.showItem(this.activeIndex - 1);
  }

  onNextClick() {
    this.showItem(this.activeIndex + 1);
  }

  updateButtons() {
    this.prevButton.disabled = this.activeIndex === 0;
    this.nextButton.disabled = this.activeIndex === this.items.length - 1;
  }

  showItem(index) {
    if (index < 0 || index >= this.items.length) {
      return;
    }

    this.items.forEach((item, itemIndex) => {
      if (itemIndex === index) {
        item.removeAttribute('hidden');
        return;
      }

      item.setAttribute('hidden', '');
    });

    this.activeIndex = index;
    this.updateButtons();
  }
}

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}
