/*
  Product gallery
*/
class ProductGallery extends HTMLElement {
  constructor() {
    super();
    this.items = [];
    this.thumbs = [];
    this.prevButton = null;
    this.nextButton = null;
    this.activeIndex = 0;
    this.onPrevClick = this.onPrevClick.bind(this);
    this.onNextClick = this.onNextClick.bind(this);
    this.onThumbClick = this.onThumbClick.bind(this);
  }

  connectedCallback() {
    this.items = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-item]'));
    this.thumbs = Array.prototype.slice.call(this.querySelectorAll('[data-gallery-thumb]'));
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
      thumb.setAttribute('aria-current', String(isActive));
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
