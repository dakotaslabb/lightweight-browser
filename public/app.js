(function() {
  'use strict';

  // DOM Elements
  const urlForm = document.getElementById('url-form');
  const urlInput = document.getElementById('url-input');
  const btnBack = document.getElementById('btn-back');
  const btnForward = document.getElementById('btn-forward');
  const btnReload = document.getElementById('btn-reload');
  const btnHome = document.getElementById('btn-home');
  const btnBookmarkToggle = document.getElementById('btn-bookmark-toggle');
  const btnBookmarksMenu = document.getElementById('btn-bookmarks-menu');
  const bookmarksBar = document.getElementById('bookmarks-bar');
  const startPage = document.getElementById('start-page');
  const browserViewport = document.getElementById('browser-viewport');
  const startSearchForm = document.getElementById('start-search-form');
  const startSearchInput = document.getElementById('start-search-input');
  const quickLinks = document.getElementById('quick-links');
  const bookmarksModal = document.getElementById('bookmarks-modal');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const bookmarksList = document.getElementById('bookmarks-list');
  const bookmarkSearch = document.getElementById('bookmark-search');
  const btnExportBookmarks = document.getElementById('btn-export-bookmarks');
  const importBookmarksFile = document.getElementById('import-bookmarks-file');

  // State
  let historyStack = [];
  let historyIndex = -1;
  let currentUrl = '';
  let currentTitle = '';
  let bookmarks = loadBookmarks();

  // Initialize
  init();

  function init() {
    renderBookmarksBar();
    setupEventListeners();
  }

  function setupEventListeners() {
    // Omnibox Navigation
    urlForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawInput = urlInput.value.trim();
      if (rawInput) {
        navigateTo(resolveInputToUrl(rawInput));
      }
    });

    // Start Page Form
    startSearchForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawInput = startSearchInput.value.trim();
      if (rawInput) {
        navigateTo(resolveInputToUrl(rawInput));
      }
    });

    // Quick links
    quickLinks.addEventListener('click', (e) => {
      const chip = e.target.closest('.quick-chip');
      if (chip && chip.dataset.url) {
        navigateTo(chip.dataset.url);
      }
    });

    // History controls
    btnBack.addEventListener('click', goBack);
    btnForward.addEventListener('click', goForward);
    btnReload.addEventListener('click', reloadPage);
    btnHome.addEventListener('click', goHome);

    // Bookmarks toggle (Star)
    btnBookmarkToggle.addEventListener('click', toggleBookmarkCurrentPage);

    // Bookmarks Manager Modal
    btnBookmarksMenu.addEventListener('click', openBookmarksModal);
    btnCloseModal.addEventListener('click', closeBookmarksModal);
    bookmarksModal.addEventListener('click', (e) => {
      if (e.target === bookmarksModal) closeBookmarksModal();
    });

    bookmarkSearch.addEventListener('input', (e) => {
      renderBookmarksList(e.target.value.toLowerCase());
    });

    btnExportBookmarks.addEventListener('click', exportBookmarksJSON);
    importBookmarksFile.addEventListener('change', importBookmarksJSON);

    // Frame message listener
    window.addEventListener('message', handleFrameMessage);

    // Global keyboard shortcuts
    window.addEventListener('keydown', handleKeyShortcuts);
  }

  // URL resolution: detects domain vs search query
  function resolveInputToUrl(input) {
    // If already has protocol
    if (/^https?:\/\//i.test(input)) {
      return input;
    }

    // Has a domain extension (e.g. site.com, sub.domain.org/path)
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+/i.test(input) && !input.includes(' ')) {
      return 'https://' + input;
    }

    // Otherwise, treat as search query (using DuckDuckGo HTML)
    return 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(input);
  }

  function navigateTo(targetUrl, addToHistory = true) {
    if (!targetUrl) return;

    currentUrl = targetUrl;
    currentTitle = targetUrl;
    urlInput.value = targetUrl;

    if (addToHistory) {
      if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
      }
      historyStack.push(targetUrl);
      historyIndex = historyStack.length - 1;
    }

    updateNavButtons();
    updateBookmarkStar();

    // Show iframe, hide start page
    startPage.classList.add('hidden');
    browserViewport.classList.remove('hidden');

    // Route through backend proxy
    browserViewport.src = '/proxy?url=' + encodeURIComponent(targetUrl);
  }

  function goBack() {
    if (historyIndex > 0) {
      historyIndex--;
      navigateTo(historyStack[historyIndex], false);
    }
  }

  function goForward() {
    if (historyIndex < historyStack.length - 1) {
      historyIndex++;
      navigateTo(historyStack[historyIndex], false);
    }
  }

  function reloadPage() {
    if (currentUrl) {
      browserViewport.src = '/proxy?url=' + encodeURIComponent(currentUrl);
    }
  }

  function goHome() {
    currentUrl = '';
    currentTitle = '';
    urlInput.value = '';
    startPage.classList.remove('hidden');
    browserViewport.classList.add('hidden');
    browserViewport.src = 'about:blank';
    updateBookmarkStar();
  }

  function updateNavButtons() {
    btnBack.disabled = historyIndex <= 0;
    btnForward.disabled = historyIndex >= historyStack.length - 1;
  }

  // Handle messages from injected scripts in the proxy frame
  function handleFrameMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'BROWSER_NAVIGATED') {
      if (data.url) {
        currentUrl = data.url;
        urlInput.value = data.url;
      }
      if (data.title) {
        currentTitle = data.title;
        document.title = data.title + ' — Light Browser';
      }
      updateBookmarkStar();
    } else if (data.type === 'BROWSER_NAVIGATE_TO') {
      if (data.url) {
        navigateTo(data.url, true);
      }
    }
  }

  // --- Bookmarks Logic ---

  function loadBookmarks() {
    try {
      const stored = localStorage.getItem('light_browser_bookmarks');
      return stored ? JSON.parse(stored) : [
        { id: '1', title: 'Hacker News', url: 'https://news.ycombinator.com', createdAt: Date.now() },
        { id: '2', title: 'Wikipedia', url: 'https://en.wikipedia.org', createdAt: Date.now() },
        { id: '3', title: 'DuckDuckGo', url: 'https://lite.duckduckgo.com/lite/', createdAt: Date.now() }
      ];
    } catch (_) {
      return [];
    }
  }

  function saveBookmarks() {
    try {
      localStorage.setItem('light_browser_bookmarks', JSON.stringify(bookmarks));
    } catch (_) {}
  }

  function isBookmarked(url) {
    if (!url) return false;
    const cleanCurrent = cleanUrlForCompare(url);
    return bookmarks.some(b => cleanUrlForCompare(b.url) === cleanCurrent);
  }

  function cleanUrlForCompare(url) {
    return (url || '').replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
  }

  function updateBookmarkStar() {
    const bookmarked = isBookmarked(currentUrl);
    if (bookmarked) {
      btnBookmarkToggle.classList.add('active');
      btnBookmarkToggle.textContent = '★';
      btnBookmarkToggle.title = 'Remove Bookmark';
    } else {
      btnBookmarkToggle.classList.remove('active');
      btnBookmarkToggle.textContent = '☆';
      btnBookmarkToggle.title = 'Bookmark this page (Ctrl+D)';
    }
  }

  function toggleBookmarkCurrentPage() {
    if (!currentUrl) return;

    const existingIndex = bookmarks.findIndex(b => cleanUrlForCompare(b.url) === cleanUrlForCompare(currentUrl));
    if (existingIndex !== -1) {
      // Remove
      bookmarks.splice(existingIndex, 1);
    } else {
      // Add
      bookmarks.unshift({
        id: Date.now().toString(),
        title: currentTitle || currentUrl,
        url: currentUrl,
        createdAt: Date.now()
      });
    }

    saveBookmarks();
    updateBookmarkStar();
    renderBookmarksBar();
    if (!bookmarksModal.classList.contains('hidden')) {
      renderBookmarksList();
    }
  }

  function renderBookmarksBar() {
    bookmarksBar.innerHTML = '';
    if (bookmarks.length === 0) {
      bookmarksBar.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">No bookmarks saved yet. Use the star icon (☆) to bookmark sites.</span>';
      return;
    }

    bookmarks.slice(0, 10).forEach(bm => {
      const chip = document.createElement('button');
      chip.className = 'bookmark-chip';
      chip.textContent = bm.title || bm.url;
      chip.title = `${bm.title}\n${bm.url}`;
      chip.addEventListener('click', () => navigateTo(bm.url));
      bookmarksBar.appendChild(chip);
    });
  }

  function openBookmarksModal() {
    bookmarkSearch.value = '';
    renderBookmarksList();
    bookmarksModal.classList.remove('hidden');
    bookmarkSearch.focus();
  }

  function closeBookmarksModal() {
    bookmarksModal.classList.add('hidden');
  }

  function renderBookmarksList(query = '') {
    bookmarksList.innerHTML = '';

    const filtered = bookmarks.filter(b => {
      return (b.title || '').toLowerCase().includes(query) || (b.url || '').toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      bookmarksList.innerHTML = `<div class="empty-state">${query ? 'No bookmarks match your search.' : 'You have no bookmarks yet.'}</div>`;
      return;
    }

    filtered.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';

      const info = document.createElement('div');
      info.className = 'bookmark-info';
      info.innerHTML = `
        <div class="bookmark-title">${escapeHtml(bm.title || bm.url)}</div>
        <div class="bookmark-url">${escapeHtml(bm.url)}</div>
      `;
      info.addEventListener('click', () => {
        closeBookmarksModal();
        navigateTo(bm.url);
      });

      const delBtn = document.createElement('button');
      delBtn.className = 'bookmark-delete-btn';
      delBtn.innerHTML = '🗑️';
      delBtn.title = 'Delete Bookmark';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteBookmark(bm.id);
      });

      item.appendChild(info);
      item.appendChild(delBtn);
      bookmarksList.appendChild(item);
    });
  }

  function deleteBookmark(id) {
    bookmarks = bookmarks.filter(b => b.id !== id);
    saveBookmarks();
    updateBookmarkStar();
    renderBookmarksBar();
    renderBookmarksList(bookmarkSearch.value.toLowerCase());
  }

  function exportBookmarksJSON() {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bookmarks, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `bookmarks_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }

  function importBookmarksJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const imported = JSON.parse(event.target.result);
        if (Array.isArray(imported)) {
          // Merge imported bookmarks avoiding exact URL duplicates
          imported.forEach(item => {
            if (item.url && !bookmarks.some(b => cleanUrlForCompare(b.url) === cleanUrlForCompare(item.url))) {
              bookmarks.push({
                id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 4),
                title: item.title || item.url,
                url: item.url,
                createdAt: item.createdAt || Date.now()
              });
            }
          });
          saveBookmarks();
          renderBookmarksBar();
          renderBookmarksList();
          updateBookmarkStar();
        }
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleKeyShortcuts(e) {
    // Ctrl/Cmd + D -> Bookmark current page
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      toggleBookmarkCurrentPage();
    }
    // Ctrl/Cmd + B -> Bookmarks manager
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      if (bookmarksModal.classList.contains('hidden')) {
        openBookmarksModal();
      } else {
        closeBookmarksModal();
      }
    }
    // Ctrl/Cmd + L -> Focus URL input
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      urlInput.focus();
      urlInput.select();
    }
    // Esc -> Close modal if open
    else if (e.key === 'Escape') {
      if (!bookmarksModal.classList.contains('hidden')) {
        closeBookmarksModal();
      }
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
