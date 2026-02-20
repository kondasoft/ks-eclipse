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

    this.activeIndex = this.items.findIndex((item) => item.classList.contains('is-active'));
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
    this.prevButton.disabled = !hasMultipleItems;
    this.nextButton.disabled = !hasMultipleItems;
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
    this.playMediaInItem(this.items[normalizedIndex]);
  }
}

if (!customElements.get('product-gallery')) {
  customElements.define('product-gallery', ProductGallery);
}
