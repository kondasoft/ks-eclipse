class CollectionFiltersForm extends HTMLElement {
  constructor() {
    super();
    this.priceDebounceTimer = null;
  }

  connectedCallback() {
    this.form = this;
    this.filterInputs = this.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    this.priceInputs = this.querySelectorAll('.collection-filter-price-range input');
    
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    this.filterInputs.forEach(input => {
      const clone = input.cloneNode(true);
      input.parentNode.replaceChild(clone, input);
    });

    this.filterInputs = this.querySelectorAll('input[type="checkbox"], input[type="radio"]');
    this.priceInputs = this.querySelectorAll('.collection-filter-price-range input');

    this.filterInputs.forEach(input => {
      input.addEventListener('change', () => this.handleChange());
    });

    this.priceInputs.forEach(input => {
      input.addEventListener('input', () => this.handlePriceChange());
    });
  }

  handleChange() {
    this.submitFilters();
  }

  handlePriceChange() {
    clearTimeout(this.priceDebounceTimer);
    this.priceDebounceTimer = setTimeout(() => {
      this.submitFilters();
    }, 1500);
  }

  submitFilters() {
    const url = new URL(window.location);
    const searchParams = url.searchParams;

    // Clear all existing params
    for (const [key] of searchParams.entries()) {
      searchParams.delete(key);
    }

    // Collect all active filters
    const activeFilters = {};
    this.filterInputs.forEach(input => {
      if (input.checked) {
        const paramName = input.name;
        const value = input.value;
        
        if (!activeFilters[paramName]) {
          activeFilters[paramName] = [];
        }
        activeFilters[paramName].push(value);
      }
    });

    // Add filter params
    Object.entries(activeFilters).forEach(([paramName, values]) => {
      values.forEach(value => {
        searchParams.append(paramName, value);
      });
    });

    // Handle price range
    const priceRangeDiv = this.querySelector('.collection-filter-price-range');
    if (priceRangeDiv) {
      const priceInputs = priceRangeDiv.querySelectorAll('input');
      priceInputs.forEach((input, index) => {
        if (input.value) {
          searchParams.set(input.name, input.value);
        }
      });
    }

    // Handle sorting
    const sortInput = this.querySelector('input[type="radio"][name="sort_by"]:checked');
    if (sortInput) {
      searchParams.set('sort_by', sortInput.value);
    }

    // Fetch filtered results dynamically
    this.fetchFilteredResults(url.toString());
  }

  async fetchFilteredResults(urlString) {
    const currentCount = document.querySelector('.collection-bar-count');
    const currentProductGrid = document.querySelector('.collection-grid');
    const currentEmptyMessage = document.querySelector('.collection-grid-empty');
    const currentPagination = document.querySelector('.pagination-wrapper');
    const currentViewResultsButton = document.querySelector('button[data-btn-view-results]');

    // Add loading state
    if (currentProductGrid) {
      currentProductGrid.style.opacity = '0.5';
    }

    try {
      const response = await fetch(urlString);
      const html = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Update the collection bar count
      const newCount = doc.querySelector('.collection-bar-count');
      if (newCount && currentCount) {
        currentCount.textContent = newCount.textContent;
      }

      // Update the product grid // empty meessage
      const newProductGrid = doc.querySelector('.collection-grid');
      const newEmptyMessage = doc.querySelector('.collection-grid-empty');
      if (newProductGrid && currentProductGrid) {
        currentProductGrid.outerHTML = newProductGrid.outerHTML;
        currentProductGrid.style.opacity = '1';
      }
      if (newEmptyMessage && currentEmptyMessage) {
        currentEmptyMessage.outerHTML = newEmptyMessage.outerHTML;
        if (newProductGrid.children.length === 0) {
          currentEmptyMessage.hidden = false;
          currentProductGrid.hidden = true;
        }
      }

      // Update pagination
      const newPagination = doc.querySelector('.pagination-wrapper');
      if (newPagination && currentPagination) {
        currentPagination.innerHTML = newPagination.innerHTML;
      }

      document.querySelectorAll('.collection-filters-form .theme-collapse-content').forEach(content => {
        const newContent = doc.querySelector(`.collection-filters-form .theme-collapse-content[data-filter="${content.dataset.filter}"]`);
        if (newContent) {
          content.innerHTML = newContent.innerHTML;
        }
      });

      // Update the "View results button"
      const newViewResultsButton = doc.querySelector('button[data-btn-view-results]');
      if (newViewResultsButton && currentViewResultsButton) {
        currentViewResultsButton.innerHTML = newViewResultsButton.innerHTML;
      }

      // Reinitialize event listeners on updated inputs
      this.initializeEventListeners();

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
