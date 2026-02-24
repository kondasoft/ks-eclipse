/*
  Product form
*/
class ProductForm extends HTMLElement {
  constructor() {
    super();
    this.form = null;
    this.submitButton = null;
    this.variantInput = null;
    this.quantityInput = null;
    this.onSubmit = this.onSubmit.bind(this);
  }

  connectedCallback() {
    this.form = this.querySelector('form');
    this.submitButton = this.form.querySelector('button[type="submit"]');
    this.variantInput = this.form.querySelector('input[name="id"]');
    this.quantityInput = this.form.querySelector('input[name="quantity"]');
    this.form.addEventListener('submit', this.onSubmit);
  }

  disconnectedCallback() {
    this.form.removeEventListener('submit', this.onSubmit);
  }

  async onSubmit(event) {
    event.preventDefault();

    this.submitButton.disabled = true;
    this.submitButton.setAttribute('aria-busy', 'true');
    this.submitButton.classList.add('is-loading');

    try {
      const formData = new FormData(this.form);
      const result = await Cart.add(formData);
      console.log('Product added to cart', result);
    } catch (error) {
      console.error('Error adding product to cart', error);
      ThemeNotification.show(
        'Unable to add to cart',
        error && error.message ? error.message : 'Please try again.',
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
    this.onPrevClick = this.onPrevClick.bind(this);
    this.onNextClick = this.onNextClick.bind(this);
    this.onThumbClick = this.onThumbClick.bind(this);
    this.onTouchStart = this.onTouchStart.bind(this);
    this.onTouchMove = this.onTouchMove.bind(this);
    this.onTouchEnd = this.onTouchEnd.bind(this);
  }

  connectedCallback() {
    this.items = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-item]'));
    this.thumbs = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-thumb]'));
    this.thumbsList = this.querySelector('.product-gallery-thumbnails');
    this.main = this.querySelector('.product-gallery-main');
    this.prevButton = this.querySelector('[data-gallery-prev]');
    this.nextButton = this.querySelector('[data-gallery-next]');

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

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}
