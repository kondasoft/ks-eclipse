class PredictiveSearch extends HTMLElement {
  constructor() {
    super();

    this.input = this.querySelector('input[type="search"]');
    this.predictiveSearchResults = this.querySelector('#predictive-search');
    this.statusMessage = this.querySelector('#predictive-search-status');
    this.isOpen = false;
    this.selectedIndex = -1;

    this.input.addEventListener(
      'input',
      this.debounce((event) => {
        this.onChange(event);
      }, 300).bind(this)
    );

    this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));

    this.predictiveSearchResults.addEventListener('click', (e) => {
      const option = e.target.closest('[role="option"]');
      if (option) {
        this.selectOption(option);
      }
    });

    this.predictiveSearchResults.addEventListener('mouseenter', (e) => {
      const option = e.target.closest('[role="option"]');
      if (option) {
        const allOptions = this.predictiveSearchResults.querySelectorAll('[role="option"]');
        this.selectedIndex = Array.from(allOptions).indexOf(option);
        this.highlightOption(option);
      }
    }, true);

    const dialog = this.closest('dialog');
    if (dialog) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'open' && dialog.open) {
            setTimeout(() => this.input.focus(), 100);
          }
        });
      });
      observer.observe(dialog, { attributes: true });
    }
  }

  onChange() {
    const searchTerm = this.input.value.trim();

    if (!searchTerm.length) {
      this.close();
      return;
    }

    this.setLoading(true);
    this.getSearchResults(searchTerm);
  }

  getSearchResults(searchTerm) {
    fetch(`${window.theme.routes.predictiveSearch}${searchTerm}&section_id=predictive-search&resources[type]=product,collection,page,article,query&resources[limit]=10`)
      .then((response) => {
        if (!response.ok) {
          var error = new Error(response.status);
          this.close();
          throw error;
        }

        return response.text();
      })
      .then((text) => {
        const resultsMarkup = new DOMParser()
          .parseFromString(text, 'text/html')
          .querySelector('#predictive-search-results');

        this.predictiveSearchResults.innerHTML = resultsMarkup.outerHTML;
        this.selectedIndex = -1;
        this.announceResults();
        this.open();
      })
      .catch((error) => {
        this.close();
        throw error;
      })
      .finally(() => {
        this.setLoading(false);
      });
  }

  open() {
    this.input.setAttribute('aria-expanded', 'true');
    this.isOpen = true;
  }

  close() {
    this.predictiveSearchResults.innerHTML = '';
    this.statusMessage.textContent = '';
    this.input.setAttribute('aria-expanded', 'false');
    this.isOpen = false;
    this.selectedIndex = -1;
  }

  setLoading(isLoading) {
    if (isLoading) {
      this.statusMessage.textContent = window.theme.strings.search.searching;
    }
  }

  highlightOption(option) {
    this.clearHighlight();
    option.setAttribute('aria-selected', 'true');
    option.classList.add('is-highlighted');
    option.scrollIntoView({ block: 'nearest' });
  }

  announceResults() {
    const options = this.predictiveSearchResults.querySelectorAll('[role="option"]');
    const count = options.length;
    
    setTimeout(() => {
      if (count === 0) {
        this.statusMessage.textContent = window.theme.strings.search.noResults;
      } else if (count === 1) {
        this.statusMessage.textContent = window.theme.strings.search.resultsOne;
      } else {
        this.statusMessage.textContent = window.theme.strings.search.resultsOther.replace('{{ count }}', count);
      }
    }, 1000);
  }

  clearHighlight() {
    const highlighted = this.predictiveSearchResults.querySelector('[aria-selected="true"]');
    if (highlighted) {
      highlighted.setAttribute('aria-selected', 'false');
      highlighted.classList.remove('is-highlighted');
    }
  }

  selectOption(option) {
    const link = option.querySelector('a');
    if (link) {
      window.location.href = link.href;
    }
  }

  debounce(fn, wait) {
    let debounceTimer;
    return function (...args) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fn.apply(this, args), wait);
    };
  }

  handleKeyDown(e) {
    if (!this.isOpen) return;

    const options = Array.from(this.predictiveSearchResults.querySelectorAll('[role="option"]'));
    const optionsCount = options.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.selectedIndex = Math.min(this.selectedIndex + 1, optionsCount - 1);
        this.highlightOption(options[this.selectedIndex]);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.selectedIndex = Math.max(this.selectedIndex - 1, -1);
        if (this.selectedIndex >= 0) {
          this.highlightOption(options[this.selectedIndex]);
        } else {
          this.clearHighlight();
        }
        break;

      case 'Enter':
        e.preventDefault();
        if (this.selectedIndex >= 0 && options[this.selectedIndex]) {
          this.selectOption(options[this.selectedIndex]);
        } else if (this.input.value.trim()) {
          this.input.form.submit();
        }
        break;

      case 'Escape':
        e.preventDefault();
        this.close();
        this.input.focus();
        break;
    }
  }
}

customElements.define('predictive-search', PredictiveSearch);
