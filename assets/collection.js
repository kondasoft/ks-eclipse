class CollectionFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.priceDebounceTimer = null;
    this.announcementTimer = null;
    this.clearAnnouncementTimer = null;
    this.handleFormChange = this.handleFormChange.bind(this);
    this.handleFormInput = this.handleFormInput.bind(this);
    this.handleClearFiltersClick = this.handleClearFiltersClick.bind(this);
  }

  connectedCallback() {
    this.addEventListener('change', this.handleFormChange);
    this.addEventListener('input', this.handleFormInput);
    this.clearFiltersButton = document.querySelector('button[data-btn-clear-filters]');
    if (this.clearFiltersButton) {
      this.clearFiltersButton.addEventListener('click', this.handleClearFiltersClick);
    }
  }

  disconnectedCallback() {
    this.removeEventListener('change', this.handleFormChange);
    this.removeEventListener('input', this.handleFormInput);
    if (this.clearFiltersButton) {
      this.clearFiltersButton.removeEventListener('click', this.handleClearFiltersClick);
    }
    clearTimeout(this.priceDebounceTimer);
    clearTimeout(this.announcementTimer);
    clearTimeout(this.clearAnnouncementTimer);
  }

  handleClearFiltersClick() {
    this.clearFilters();
  }

  handleFormChange(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.matches('.collection-filter-price-range input')) return;

    if (target.type === 'checkbox' || target.type === 'radio') {
      this.submitFilters();
    }
  }

  handleFormInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.matches('.collection-filter-price-range input')) return;

    clearTimeout(this.priceDebounceTimer);
    this.priceDebounceTimer = setTimeout(() => {
      this.submitFilters();
    }, 1500);
  }

  submitFilters() {
    const url = new URL(window.location);
    url.search = '';
    const searchParams = url.searchParams;

    // Collect all active filters
    const filterInputs = this.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    const activeFilters = {};
    filterInputs.forEach(input => {
      if (input.checked) {
        const paramName = input.name;
        const value = input.value;
        
        if (!activeFilters[paramName]) {
          activeFilters[paramName] = new Set();
        }
        activeFilters[paramName].add(value);
      }
    });

    // Add filter params
    Object.entries(activeFilters).forEach(([paramName, values]) => {
      values.forEach(value => {
        searchParams.append(paramName, value);
      });
    });

    // Handle price range
    const priceInputs = this.querySelectorAll('.collection-filter-price-range input');
    priceInputs.forEach(input => {
      if (input.value) {
        searchParams.set(input.name, input.value);
      }
    });

    // Handle sorting
    const sortInput = this.querySelector('input[type="radio"][name="sort_by"]:checked');
    if (sortInput) {
      searchParams.set('sort_by', sortInput.value);
    }

    // Fetch filtered results dynamically
    this.fetchFilteredResults(url.toString());
  }

  clearFilters() {
    this.querySelectorAll('input[type="checkbox"]:checked').forEach(input => {
      input.checked = false;
    });

    this.querySelectorAll('.collection-filter-price-range input').forEach(input => {
      input.value = '';
    });

    this.submitFilters();
  }

  announceFilterResults(countText, delay = 300) {
    if (!countText) return;

    const liveRegion = this.querySelector('[data-collection-live-region]');
    if (!liveRegion) return;

    const template = liveRegion.dataset.text || 'Filters updated. [count]';
    const message = template.replace('[count]', countText.trim());
    clearTimeout(this.announcementTimer);
    clearTimeout(this.clearAnnouncementTimer);
    liveRegion.textContent = '';

    this.announcementTimer = window.setTimeout(() => {
      liveRegion.textContent = message;

      this.clearAnnouncementTimer = window.setTimeout(() => {
        liveRegion.textContent = '';
      }, 2000);
    }, delay);
  }

  async fetchFilteredResults(urlString) {
    const currentProductGrid = document.querySelector('.collection-grid');

    // Add loading state
    if (currentProductGrid) {
      currentProductGrid.style.opacity = '0.5';
    }

    try {
      const response = await fetch(urlString);
      if (!response.ok) {
        throw new Error(`Failed to fetch collection filters: ${response.status}`);
      }

      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      const newLiveRegion = doc.querySelector('[data-collection-live-region]');
      const announcementCountText = newLiveRegion?.dataset.countText || '';
      
      // Update the collection bar count
      const currentCount = document.querySelector('.collection-bar-count');
      const newCount = doc.querySelector('.collection-bar-count');
      if (newCount && currentCount) {
        currentCount.textContent = newCount.textContent;
      }

      // Update the product grid
      const newProductGrid = doc.querySelector('.collection-grid');
      if (newProductGrid && currentProductGrid) {
        currentProductGrid.outerHTML = newProductGrid.outerHTML;
      }

      const updatedProductGrid = document.querySelector('.collection-grid');
      if (updatedProductGrid) {
        updatedProductGrid.style.opacity = '1';
      }

      // Update the empty message
      const currentEmptyMessage = document.querySelector('.collection-grid-empty');
      const newEmptyMessage = doc.querySelector('.collection-grid-empty');
      if (newEmptyMessage && currentEmptyMessage) {
        currentEmptyMessage.outerHTML = newEmptyMessage.outerHTML;
      }

      // Update product grid and empty message visibility
      const updatedEmptyMessage = document.querySelector('.collection-grid-empty');
      const hasProducts = Boolean(newProductGrid && newProductGrid.children.length > 0);
      if (updatedProductGrid) {
        updatedProductGrid.hidden = !hasProducts;
      }
      if (updatedEmptyMessage) {
        updatedEmptyMessage.hidden = hasProducts;
      }

      // Update pagination
      const currentPagination = document.querySelector('.pagination-wrapper');
      const newPagination = doc.querySelector('.pagination-wrapper');
      if (newPagination && currentPagination) {
        currentPagination.innerHTML = newPagination.innerHTML;
      }

      // Update filter contents
      this.querySelectorAll('.theme-collapse-content').forEach(content => {
        const newContent = doc.querySelector(`.collection-filters-form .theme-collapse-content[data-filter="${content.dataset.filter}"]`);
        if (newContent) {
          content.innerHTML = newContent.innerHTML;
        }
      });

      // Update the "View results" button
      const currentViewResultsButton = document.querySelector('button[data-btn-view-results]');
      const newViewResultsButton = doc.querySelector('button[data-btn-view-results]');
      if (newViewResultsButton && currentViewResultsButton) {
        currentViewResultsButton.innerHTML = newViewResultsButton.innerHTML;
      }

      // Announce the number of results (screen readers)
      this.announceFilterResults(announcementCountText, 400);

      // Update browser history
      window.history.pushState({}, '', urlString);
    } catch (error) {
      console.error('Error fetching filtered results:', error);
      // Reset opacity on error
      if (currentProductGrid) {
        currentProductGrid.style.opacity = '1';
      }
    }
  }
}

customElements.define('collection-filters-form', CollectionFiltersForm);
