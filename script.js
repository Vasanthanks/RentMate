/* ==========================================================
   RentMate – script.js
   Vanilla JavaScript. Data persisted in browser Local Storage.
   NOTE: Local Storage is for single-browser demo purposes only.
   ========================================================== */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. CONSTANTS & STATE
     --------------------------------------------------------- */
  var KEYS = {
    items: 'rentmate_items',
    requests: 'rentmate_requests',
    seeded: 'rentmate_seeded_v1'
  };

  var CATEGORIES = ['Cameras', 'Bicycles', 'Power Tools', 'Laptops', 'Electronics', 'Outdoor & Camping', 'Other'];
  var CATEGORY_EMOJI = {
    'Cameras': '📷', 'Bicycles': '🚲', 'Power Tools': '🔧', 'Laptops': '💻',
    'Electronics': '🎧', 'Outdoor & Camping': '⛺', 'Other': '📦'
  };
  var STATUS = { PENDING: 'Pending', APPROVED: 'Approved', REJECTED: 'Rejected', RETURNED: 'Returned' };

  var state = {
    items: [],
    requests: [],
    filters: { search: '', category: 'All', location: 'All', sort: 'newest' },
    requestTab: 'All',
    openItemId: null
  };

  /* ---------------------------------------------------------
     2. SMALL HELPERS
     --------------------------------------------------------- */
  function $(id) { return document.getElementById(id); }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function formatINR(n) {
    return '₹' + Number(n).toLocaleString('en-IN');
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function addDaysStr(dateStr, days) {
    var p = dateStr.split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2] + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function parseDate(str) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(str || '')) return null;
    var p = str.split('-').map(Number);
    var ms = Date.UTC(p[0], p[1] - 1, p[2]);
    var check = new Date(ms);
    if (check.getUTCFullYear() !== p[0] || check.getUTCMonth() !== p[1] - 1 || check.getUTCDate() !== p[2]) return null;
    return ms;
  }

  function formatDate(str) {
    var ms = parseDate(str);
    if (ms === null) return str;
    return new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  }

  /** Inclusive number of rental days between two yyyy-mm-dd strings. */
  function calcDays(start, end) {
    var s = parseDate(start), e = parseDate(end);
    if (s === null || e === null) return 0;
    return Math.round((e - s) / 86400000) + 1;
  }

  function placeholderImage(category, name) {
    var emoji = CATEGORY_EMOJI[category] || '📦';
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#dcf5e7"/><stop offset="1" stop-color="#9fe0bb"/></linearGradient></defs>' +
      '<rect width="640" height="480" fill="url(#g)"/>' +
      '<text x="320" y="270" font-size="150" text-anchor="middle">' + emoji + '</text></svg>';
    return 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg);
  }

  function itemImage(item) {
    return item.image && item.image.trim() ? item.image : placeholderImage(item.category, item.name);
  }

  /** Builds an <img> tag whose broken URL falls back to the category placeholder. */
  function imgTag(item, alt) {
    var fallback = placeholderImage(item.category, item.name);
    return '<img src="' + esc(itemImage(item)) + '" alt="' + esc(alt || item.name) + '" loading="lazy" ' +
      'data-fallback="' + esc(fallback) + '">';
  }

  // Global (capture) error handler for images: swap to placeholder once.
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.dataset && t.dataset.fallback && t.src !== t.dataset.fallback) {
      t.src = t.dataset.fallback;
    }
  }, true);

  function isValidUrl(str) {
    try {
      var u = new URL(str);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (err) { return false; }
  }

  /* ---------------------------------------------------------
     3. LOCAL STORAGE LAYER
     --------------------------------------------------------- */
  function readStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : fallback;
    } catch (err) {
      console.warn('RentMate: could not read', key, err);
      return fallback;
    }
  }

  var storageOk = true;
  function writeStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      storageOk = false;
      console.warn('RentMate: could not save', key, err);
      toast('Could not save data. Local Storage may be disabled or full.', 'error');
      return false;
    }
  }

  function saveItems() { return writeStore(KEYS.items, state.items); }
  function saveRequests() { return writeStore(KEYS.requests, state.requests); }

  function sampleItems() {
    var now = Date.now();
    return [
      { id: 'item_s1', name: 'Canon EOS 200D DSLR Camera', category: 'Cameras', price: 800, location: 'Chennai',
        image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=70',
        description: '24MP DSLR with 18-55mm kit lens, two batteries, 32GB card and a padded bag. Great for weddings, trips and events.',
        owner: 'Arjun K.', createdAt: now - 6 * 3600000 },
      { id: 'item_s2', name: 'Hero Sprint Mountain Bike', category: 'Bicycles', price: 350, location: 'Bengaluru',
        image: 'https://images.unsplash.com/photo-1485965120184-e220f721d03e?auto=format&fit=crop&w=800&q=70',
        description: '21-speed mountain bike, recently serviced. Helmet and lock included. Perfect for weekend trail rides.',
        owner: 'Priya S.', createdAt: now - 5 * 3600000 },
      { id: 'item_s3', name: 'Bosch Cordless Drill Kit', category: 'Power Tools', price: 250, location: 'Hyderabad',
        image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=70',
        description: '18V drill with 40-piece bit set and two batteries. Ideal for furniture assembly and home repairs.',
        owner: 'Rahul M.', createdAt: now - 4 * 3600000 },
      { id: 'item_s4', name: 'MacBook Air M1 13"', category: 'Laptops', price: 900, location: 'Chennai',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=70',
        description: '8GB RAM / 256GB SSD. Good for presentations, coding sprints and short projects. Charger included.',
        owner: 'Divya R.', createdAt: now - 3 * 3600000 },
      { id: 'item_s5', name: 'JBL Party Bluetooth Speaker', category: 'Electronics', price: 450, location: 'Mumbai',
        image: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=800&q=70',
        description: 'Loud, bass-heavy speaker with light show and 10-hour battery. Great for parties and college events.',
        owner: 'Sana A.', createdAt: now - 2 * 3600000 },
      { id: 'item_s6', name: '4-Person Camping Tent', category: 'Outdoor & Camping', price: 300, location: 'Bengaluru',
        image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=70',
        description: 'Waterproof dome tent that sets up in 10 minutes. Includes pegs, rain fly and carry bag.',
        owner: 'Karthik V.', createdAt: now - 1 * 3600000 },
      { id: 'item_s7', name: 'DJI Mini Drone with Controller', category: 'Cameras', price: 1500, location: 'Mumbai',
        image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=800&q=70',
        description: 'Under 250g foldable drone with 4K camera, 3 batteries and carrying case. Beginner friendly.',
        owner: 'Neha P.', createdAt: now - 30 * 60000 }
    ];
  }

  function sampleRequests() {
    var t = todayStr();
    function mk(id, itemId, name, renter, s, e, status, price) {
      var days = calcDays(s, e);
      return { id: id, itemId: itemId, itemName: name, renter: renter, startDate: s, endDate: e,
        days: days, total: days * price, status: status, createdAt: Date.now() - 86400000 };
    }
    return [
      mk('req_s1', 'item_s1', 'Canon EOS 200D DSLR Camera', 'Meera Nair', addDaysStr(t, 3), addDaysStr(t, 5), STATUS.PENDING, 800),
      mk('req_s2', 'item_s2', 'Hero Sprint Mountain Bike', 'Vikram Rao', addDaysStr(t, -1), addDaysStr(t, 2), STATUS.APPROVED, 350),
      mk('req_s3', 'item_s3', 'Bosch Cordless Drill Kit', 'Anita Joseph', addDaysStr(t, -12), addDaysStr(t, -9), STATUS.RETURNED, 250)
    ];
  }

  function initData() {
    var seeded = localStorage.getItem(KEYS.seeded);
    if (!seeded) {
      state.items = sampleItems();
      state.requests = sampleRequests();
      saveItems();
      saveRequests();
      try { localStorage.setItem(KEYS.seeded, '1'); } catch (err) { /* ignore */ }
    } else {
      state.items = readStore(KEYS.items, []);
      state.requests = readStore(KEYS.requests, []);
    }
  }

  function resetDemo() {
    if (!window.confirm('Reset all data back to the original demo items and requests?')) return;
    state.items = sampleItems();
    state.requests = sampleRequests();
    saveItems();
    saveRequests();
    state.filters = { search: '', category: 'All', location: 'All', sort: 'newest' };
    state.requestTab = 'All';
    syncFilterControls();
    closeModal();
    renderAll();
    toast('Demo data has been reset.');
  }

  /* ---------------------------------------------------------
     4. TOASTS
     --------------------------------------------------------- */
  function toast(message, type) {
    var box = $('toastContainer');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast' + (type === 'error' ? ' error' : '');
    el.textContent = message;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
    }, 3200);
  }

  /* ---------------------------------------------------------
     5. DATA QUERIES
     --------------------------------------------------------- */
  function getItem(id) {
    for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i];
    return null;
  }

  function getRequest(id) {
    for (var i = 0; i < state.requests.length; i++) if (state.requests[i].id === id) return state.requests[i];
    return null;
  }

  function rangesOverlap(aStart, aEnd, bStart, bEnd) {
    return parseDate(aStart) <= parseDate(bEnd) && parseDate(bStart) <= parseDate(aEnd);
  }

  /** Approved (not yet returned) rentals of an item. These block the calendar. */
  function bookedRanges(itemId, excludeRequestId) {
    return state.requests.filter(function (r) {
      return r.itemId === itemId && r.status === STATUS.APPROVED && r.id !== excludeRequestId;
    });
  }

  function findConflict(itemId, start, end, excludeRequestId) {
    var list = bookedRanges(itemId, excludeRequestId);
    for (var i = 0; i < list.length; i++) {
      if (rangesOverlap(start, end, list[i].startDate, list[i].endDate)) return list[i];
    }
    return null;
  }

  function isRentedNow(itemId) {
    var t = todayStr();
    return bookedRanges(itemId).some(function (r) { return r.startDate <= t && t <= r.endDate; });
  }

  function getFilteredItems() {
    var f = state.filters;
    var q = f.search.trim().toLowerCase();
    var list = state.items.filter(function (it) {
      if (q && it.name.toLowerCase().indexOf(q) === -1) return false;
      if (f.category !== 'All' && it.category !== f.category) return false;
      if (f.location !== 'All' && it.location.toLowerCase() !== f.location.toLowerCase()) return false;
      return true;
    });
    list.sort(function (a, b) {
      if (f.sort === 'price-asc') return a.price - b.price;
      if (f.sort === 'price-desc') return b.price - a.price;
      return b.createdAt - a.createdAt;
    });
    return list;
  }

  function uniqueLocations() {
    var seen = {}, out = [];
    state.items.forEach(function (it) {
      var key = it.location.toLowerCase();
      if (!seen[key]) { seen[key] = true; out.push(it.location); }
    });
    return out.sort(function (a, b) { return a.localeCompare(b); });
  }

  /* ---------------------------------------------------------
     6. RENDERING
     --------------------------------------------------------- */
  function renderStats() {
    var pending = state.requests.filter(function (r) { return r.status === STATUS.PENDING; }).length;
    $('statItems').textContent = state.items.length;
    $('statRequests').textContent = state.requests.length;
    $('statPending').textContent = pending;
    var badge = $('navPendingBadge');
    badge.textContent = pending;
    badge.classList.toggle('hidden', pending === 0);
  }

  function fillSelect(select, options, selected) {
    select.innerHTML = '';
    options.forEach(function (opt) {
      var o = document.createElement('option');
      o.value = opt.value;
      o.textContent = opt.label;
      select.appendChild(o);
    });
    select.value = selected;
  }

  function renderFilterOptions() {
    var cats = [{ value: 'All', label: 'All categories' }].concat(CATEGORIES.map(function (c) { return { value: c, label: c }; }));
    fillSelect($('categoryFilter'), cats, state.filters.category);

    var locs = [{ value: 'All', label: 'All locations' }].concat(uniqueLocations().map(function (l) { return { value: l, label: l }; }));
    var current = state.filters.location;
    var exists = locs.some(function (l) { return l.value.toLowerCase() === current.toLowerCase(); });
    if (!exists) { state.filters.location = 'All'; current = 'All'; }
    fillSelect($('locationFilter'), locs, current);
  }

  function renderListFormOptions() {
    var opts = [{ value: '', label: 'Select a category' }].concat(CATEGORIES.map(function (c) { return { value: c, label: c }; }));
    fillSelect($('itemCategory'), opts, '');
  }

  function syncFilterControls() {
    $('searchInput').value = state.filters.search;
    $('sortSelect').value = state.filters.sort;
    renderFilterOptions();
  }

  function renderItems() {
    var grid = $('itemsGrid');
    var empty = $('emptyState');
    var list = getFilteredItems();

    $('resultCount').textContent = list.length === 0
      ? ''
      : 'Showing ' + list.length + ' of ' + state.items.length + ' item' + (state.items.length === 1 ? '' : 's');

    if (list.length === 0) {
      grid.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    grid.innerHTML = list.map(function (it) {
      return '<article class="item-card">' +
        '<div class="item-img-wrap">' + imgTag(it) +
          '<span class="chip">' + esc(it.category) + '</span>' +
          (isRentedNow(it.id) ? '<span class="chip rented">Rented now</span>' : '') +
        '</div>' +
        '<div class="item-body">' +
          '<h3>' + esc(it.name) + '</h3>' +
          '<div class="item-loc">📍 ' + esc(it.location) + ' · by ' + esc(it.owner || 'You') + '</div>' +
          '<p class="item-desc">' + esc(it.description) + '</p>' +
          '<div class="item-foot">' +
            '<div class="price">' + formatINR(it.price) + ' <small>/ day</small></div>' +
            '<button type="button" class="btn btn-primary btn-sm" data-action="open-item" data-id="' + esc(it.id) + '">View &amp; Rent</button>' +
          '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderTabs() {
    var tabs = document.querySelectorAll('#requestTabs .tab');
    Array.prototype.forEach.call(tabs, function (tab) {
      var f = tab.getAttribute('data-filter');
      tab.classList.toggle('active', f === state.requestTab);
      tab.setAttribute('aria-selected', f === state.requestTab ? 'true' : 'false');
      var count = f === 'All' ? state.requests.length
        : state.requests.filter(function (r) { return r.status === f; }).length;
      var badge = tab.querySelector('.tab-count');
      if (badge) badge.textContent = count;
    });
  }

  function sortedRequests() {
    return state.requests.slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
  }

  function requestActionsHtml(r) {
    if (r.status === STATUS.PENDING) {
      return '<button type="button" class="btn btn-primary btn-sm" data-action="approve" data-id="' + esc(r.id) + '">Approve</button>' +
             '<button type="button" class="btn btn-danger btn-sm" data-action="reject" data-id="' + esc(r.id) + '">Reject</button>';
    }
    if (r.status === STATUS.APPROVED) {
      return '<button type="button" class="btn btn-outline btn-sm" data-action="return" data-id="' + esc(r.id) + '">Mark as returned</button>';
    }
    return '';
  }

  function renderRequests() {
    var list = $('requestsList');
    var empty = $('requestsEmpty');
    var data = sortedRequests().filter(function (r) {
      return state.requestTab === 'All' || r.status === state.requestTab;
    });

    renderTabs();

    if (data.length === 0) {
      list.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    list.innerHTML = data.map(function (r) {
      var item = getItem(r.itemId) || { name: r.itemName, category: 'Other', image: '' };
      return '<article class="request-card">' +
        imgTag(item, r.itemName) +
        '<div class="request-info">' +
          '<h3>' + esc(r.itemName) + '</h3>' +
          '<div class="request-meta">' +
            '<span>Renter: <b>' + esc(r.renter) + '</b></span>' +
            '<span>📅 <b>' + formatDate(r.startDate) + '</b> → <b>' + formatDate(r.endDate) + '</b></span>' +
            '<span>' + r.days + ' day' + (r.days === 1 ? '' : 's') + '</span>' +
            '<span>Total: <b>' + formatINR(r.total) + '</b></span>' +
          '</div>' +
        '</div>' +
        '<div class="request-actions">' +
          '<span class="status status-' + esc(r.status) + '">' + esc(r.status) + '</span>' +
          '<div class="request-buttons">' + requestActionsHtml(r) + '</div>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderHistory() {
    var body = $('historyBody');
    var empty = $('historyEmpty');
    var data = sortedRequests();

    var returned = data.filter(function (r) { return r.status === STATUS.RETURNED; });
    var earned = data.filter(function (r) { return r.status === STATUS.APPROVED || r.status === STATUS.RETURNED; })
      .reduce(function (sum, r) { return sum + r.total; }, 0);

    $('historySummary').innerHTML =
      '<div class="summary-box"><strong>' + data.length + '</strong><span>Total requests</span></div>' +
      '<div class="summary-box"><strong>' + data.filter(function (r) { return r.status === STATUS.APPROVED; }).length + '</strong><span>Active rentals</span></div>' +
      '<div class="summary-box"><strong>' + returned.length + '</strong><span>Completed (returned)</span></div>' +
      '<div class="summary-box"><strong>' + formatINR(earned) + '</strong><span>Value of approved &amp; completed</span></div>';

    if (data.length === 0) {
      body.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    body.innerHTML = data.map(function (r) {
      var item = getItem(r.itemId) || { name: r.itemName, category: 'Other', image: '' };
      return '<tr>' +
        '<td><div class="cell-item">' + imgTag(item, r.itemName) + '<span>' + esc(r.itemName) + '</span></div></td>' +
        '<td>' + esc(r.renter) + '</td>' +
        '<td>' + formatDate(r.startDate) + ' → ' + formatDate(r.endDate) + '</td>' +
        '<td>' + r.days + '</td>' +
        '<td><b>' + formatINR(r.total) + '</b></td>' +
        '<td><span class="status status-' + esc(r.status) + '">' + esc(r.status) + '</span></td>' +
      '</tr>';
    }).join('');
  }

  function renderAll() {
    renderStats();
    renderFilterOptions();
    renderItems();
    renderRequests();
    renderHistory();
  }

  /* ---------------------------------------------------------
     7. LISTING FORM
     --------------------------------------------------------- */
  function setFieldError(inputId, message) {
    var input = $(inputId);
    var field = input.closest('.field');
    var errEl = field.querySelector('.error');
    if (message) {
      field.classList.add('invalid');
      errEl.textContent = message;
    } else {
      field.classList.remove('invalid');
      errEl.textContent = '';
    }
  }

  function validateListing() {
    var v = {
      name: $('itemName').value.trim(),
      category: $('itemCategory').value,
      price: $('itemPrice').value.trim(),
      location: $('itemLocation').value.trim(),
      image: $('itemImage').value.trim(),
      description: $('itemDescription').value.trim()
    };
    var ok = true;
    function check(id, cond, msg) { setFieldError(id, cond ? '' : msg); if (!cond) ok = false; }

    check('itemName', v.name.length >= 3 && v.name.length <= 60, 'Enter an item name (3–60 characters).');
    check('itemCategory', CATEGORIES.indexOf(v.category) !== -1, 'Please choose a category.');
    var priceNum = Number(v.price);
    check('itemPrice', v.price !== '' && isFinite(priceNum) && priceNum >= 1 && priceNum <= 1000000, 'Enter a daily price of ₹1 or more.');
    check('itemLocation', v.location.length >= 2 && v.location.length <= 40, 'Enter a location (2–40 characters).');
    check('itemImage', v.image === '' || isValidUrl(v.image), 'Enter a valid http(s) image URL, or leave it blank.');
    check('itemDescription', v.description.length >= 10 && v.description.length <= 400, 'Description must be 10–400 characters.');

    v.price = Math.round(priceNum);
    return ok ? v : null;
  }

  function handleListSubmit(e) {
    e.preventDefault();
    var v = validateListing();
    if (!v) { toast('Please fix the highlighted fields.', 'error'); return; }

    var item = {
      id: uid('item'), name: v.name, category: v.category, price: v.price,
      location: v.location, image: v.image, description: v.description,
      owner: 'You', createdAt: Date.now()
    };
    state.items.unshift(item);
    if (!saveItems()) { state.items.shift(); return; }

    $('listForm').reset();
    ['itemName', 'itemCategory', 'itemPrice', 'itemLocation', 'itemImage', 'itemDescription'].forEach(function (id) { setFieldError(id, ''); });

    // Show the new listing: clear filters that could hide it.
    state.filters = { search: '', category: 'All', location: 'All', sort: 'newest' };
    syncFilterControls();
    renderAll();
    toast('"' + item.name + '" is now listed!');
    $('browse').scrollIntoView({ behavior: 'smooth' });
  }

  /* ---------------------------------------------------------
     8. MODAL: ITEM DETAILS + AVAILABILITY + REQUEST
     --------------------------------------------------------- */
  function openItemModal(itemId) {
    var item = getItem(itemId);
    if (!item) { toast('That item is no longer available.', 'error'); return; }
    state.openItemId = itemId;

    var booked = bookedRanges(itemId);
    var bookedHtml = booked.length
      ? '<div class="booked-box"><strong>Already booked:</strong><ul>' +
        booked.map(function (r) { return '<li>' + formatDate(r.startDate) + ' → ' + formatDate(r.endDate) + '</li>'; }).join('') +
        '</ul></div>'
      : '';

    var t = todayStr();
    $('modalBody').innerHTML =
      '<div class="modal-grid">' +
        '<div class="modal-media">' + imgTag(item) + '</div>' +
        '<div class="modal-content">' +
          '<span class="chip">' + esc(item.category) + '</span>' +
          '<h2>' + esc(item.name) + '</h2>' +
          '<div class="item-loc">📍 ' + esc(item.location) + ' · Owner: ' + esc(item.owner || 'You') + '</div>' +
          '<div class="price" style="margin:.5rem 0">' + formatINR(item.price) + ' <small>/ day</small></div>' +
          '<p class="modal-desc">' + esc(item.description) + '</p>' +
          bookedHtml +
          '<form id="requestForm" novalidate>' +
            '<div class="field">' +
              '<label for="renterName">Your name</label>' +
              '<input type="text" id="renterName" placeholder="Full name" maxlength="50" autocomplete="name">' +
              '<small class="error" data-error-for="renterName"></small>' +
            '</div>' +
            '<div class="date-row">' +
              '<div class="field"><label for="startDate">Start date</label>' +
                '<input type="date" id="startDate" min="' + t + '">' +
                '<small class="error" data-error-for="startDate"></small></div>' +
              '<div class="field"><label for="endDate">End date</label>' +
                '<input type="date" id="endDate" min="' + t + '">' +
                '<small class="error" data-error-for="endDate"></small></div>' +
            '</div>' +
            '<div class="quote-box" id="quoteBox">' +
              '<div class="quote-row"><span>Daily price</span><span>' + formatINR(item.price) + '</span></div>' +
              '<div class="quote-row"><span>Rental days</span><span id="quoteDays">–</span></div>' +
              '<div class="quote-row total"><span>Estimated total</span><span id="quoteTotal">–</span></div>' +
            '</div>' +
            '<div id="availMsg" class="avail-msg" aria-live="polite"></div>' +
            '<div class="modal-actions">' +
              '<button type="button" class="btn btn-outline" id="checkAvailBtn">Check availability</button>' +
              '<button type="submit" class="btn btn-primary">Send rental request</button>' +
            '</div>' +
          '</form>' +
        '</div>' +
      '</div>';

    $('modal').classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    $('requestForm').addEventListener('submit', handleRequestSubmit);
    $('checkAvailBtn').addEventListener('click', function () { evaluateDates(true); });
    $('startDate').addEventListener('change', onStartChange);
    $('endDate').addEventListener('change', function () { evaluateDates(false); });
    $('renterName').focus();
  }

  function closeModal() {
    $('modal').classList.add('hidden');
    $('modalBody').innerHTML = '';
    document.body.style.overflow = '';
    state.openItemId = null;
  }

  function onStartChange() {
    var s = $('startDate').value;
    var endEl = $('endDate');
    if (s) {
      endEl.min = s;
      if (endEl.value && endEl.value < s) endEl.value = '';
    } else {
      endEl.min = todayStr();
    }
    evaluateDates(false);
  }

  /**
   * Validates the date inputs, updates price quote, and checks availability.
   * @param {boolean} showFeedback - show errors/messages even if fields are empty.
   * @returns {object|null} {start, end, days, total} when valid and available, else null.
   */
  function evaluateDates(showFeedback) {
    var item = getItem(state.openItemId);
    if (!item) return null;

    var start = $('startDate').value;
    var end = $('endDate').value;
    var msg = $('availMsg');
    var daysEl = $('quoteDays');
    var totalEl = $('quoteTotal');

    function fail(startMsg, endMsg, text) {
      setFieldError('startDate', startMsg || '');
      setFieldError('endDate', endMsg || '');
      daysEl.textContent = '–';
      totalEl.textContent = '–';
      msg.className = 'avail-msg' + (text ? ' bad' : '');
      msg.textContent = text || '';
      return null;
    }

    if (!start || !end) {
      daysEl.textContent = '–';
      totalEl.textContent = '–';
      if (!showFeedback) { msg.textContent = ''; msg.className = 'avail-msg'; return null; }
      return fail(start ? '' : 'Choose a start date.', end ? '' : 'Choose an end date.', 'Please select both dates.');
    }
    if (parseDate(start) === null) return fail('Invalid date.', '', 'Start date is not valid.');
    if (parseDate(end) === null) return fail('', 'Invalid date.', 'End date is not valid.');
    if (start < todayStr()) return fail('Start date cannot be in the past.', '', 'Start date cannot be in the past.');
    if (end < start) return fail('', 'End must be on or after start.', 'End date cannot be before the start date.');

    var days = calcDays(start, end);
    if (days > 90) return fail('', 'Maximum rental is 90 days.', 'Maximum rental period is 90 days.');
    var total = days * item.price;

    setFieldError('startDate', '');
    setFieldError('endDate', '');
    daysEl.textContent = days + (days === 1 ? ' day' : ' days');
    totalEl.textContent = formatINR(total);

    var conflict = findConflict(item.id, start, end);
    if (conflict) {
      msg.className = 'avail-msg bad';
      msg.textContent = '✖ Not available. Already booked ' + formatDate(conflict.startDate) + ' → ' + formatDate(conflict.endDate) + '.';
      return null;
    }
    msg.className = 'avail-msg ok';
    msg.textContent = '✔ Available for the selected dates.';
    return { start: start, end: end, days: days, total: total };
  }

  function handleRequestSubmit(e) {
    e.preventDefault();
    var item = getItem(state.openItemId);
    if (!item) { toast('That item is no longer available.', 'error'); closeModal(); return; }

    var name = $('renterName').value.trim().replace(/\s+/g, ' ');
    var nameOk = name.length >= 2 && name.length <= 50 && /[A-Za-z]/.test(name);
    setFieldError('renterName', nameOk ? '' : 'Enter your name (at least 2 letters).');

    var result = evaluateDates(true);
    if (!nameOk || !result) {
      toast(nameOk ? 'Please choose valid, available dates.' : 'Please enter your name.', 'error');
      return;
    }

    var req = {
      id: uid('req'), itemId: item.id, itemName: item.name, renter: name,
      startDate: result.start, endDate: result.end, days: result.days, total: result.total,
      status: STATUS.PENDING, createdAt: Date.now()
    };
    state.requests.push(req);
    if (!saveRequests()) { state.requests.pop(); return; }

    renderAll();
    showConfirmation(req, item);
  }

  function showConfirmation(req, item) {
    $('modalBody').innerHTML =
      '<div class="confirm-box">' +
        '<div class="confirm-icon">✓</div>' +
        '<h2>Request sent!</h2>' +
        '<p class="muted">The owner will review your request. Track its status in Rental History.</p>' +
        '<div class="confirm-details">' +
          '<div><span>Item</span><b>' + esc(item.name) + '</b></div>' +
          '<div><span>Renter</span><b>' + esc(req.renter) + '</b></div>' +
          '<div><span>Dates</span><b>' + formatDate(req.startDate) + ' → ' + formatDate(req.endDate) + '</b></div>' +
          '<div><span>Days</span><b>' + req.days + '</b></div>' +
          '<div><span>Estimated total</span><b>' + formatINR(req.total) + '</b></div>' +
          '<div><span>Status</span><b><span class="status status-Pending">Pending</span></b></div>' +
        '</div>' +
        '<div class="modal-actions" style="max-width:380px;margin:0 auto">' +
          '<button type="button" class="btn btn-outline" data-close-modal>Close</button>' +
          '<a href="#history" class="btn btn-primary" data-close-modal>View history</a>' +
        '</div>' +
      '</div>';
    toast('Rental request submitted.');
  }

  /* ---------------------------------------------------------
     9. OWNER ACTIONS: APPROVE / REJECT / RETURN
     --------------------------------------------------------- */
  function updateRequestStatus(id, newStatus) {
    var req = getRequest(id);
    if (!req) { toast('Request not found.', 'error'); return; }

    if (newStatus === STATUS.APPROVED) {
      if (req.status !== STATUS.PENDING) { toast('Only pending requests can be approved.', 'error'); return; }
      var conflict = findConflict(req.itemId, req.startDate, req.endDate, req.id);
      if (conflict) {
        toast('Cannot approve: dates overlap with an approved rental (' + conflict.renter + ').', 'error');
        return;
      }
    }
    if (newStatus === STATUS.REJECTED && req.status !== STATUS.PENDING) {
      toast('Only pending requests can be rejected.', 'error'); return;
    }
    if (newStatus === STATUS.RETURNED && req.status !== STATUS.APPROVED) {
      toast('Only approved rentals can be marked as returned.', 'error'); return;
    }

    var previous = req.status;
    req.status = newStatus;
    if (!saveRequests()) { req.status = previous; return; }
    renderAll();

    var messages = {};
    messages[STATUS.APPROVED] = 'Request approved.';
    messages[STATUS.REJECTED] = 'Request rejected.';
    messages[STATUS.RETURNED] = 'Item marked as returned. Rental completed.';
    toast(messages[newStatus]);
  }

  /* ---------------------------------------------------------
     10. EVENT LISTENERS
     --------------------------------------------------------- */
  function bindEvents() {
    // Mobile navigation
    var toggle = $('navToggle');
    var links = $('navLinks');
    toggle.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Search & filters
    $('searchInput').addEventListener('input', function (e) { state.filters.search = e.target.value; renderItems(); });
    $('categoryFilter').addEventListener('change', function (e) { state.filters.category = e.target.value; renderItems(); });
    $('locationFilter').addEventListener('change', function (e) { state.filters.location = e.target.value; renderItems(); });
    $('sortSelect').addEventListener('change', function (e) { state.filters.sort = e.target.value; renderItems(); });
    $('clearFilters').addEventListener('click', function () {
      state.filters = { search: '', category: 'All', location: 'All', sort: 'newest' };
      syncFilterControls();
      renderItems();
    });

    // Item grid (event delegation)
    $('itemsGrid').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action="open-item"]');
      if (btn) openItemModal(btn.getAttribute('data-id'));
    });

    // Listing form
    $('listForm').addEventListener('submit', handleListSubmit);
    ['itemName', 'itemCategory', 'itemPrice', 'itemLocation', 'itemImage', 'itemDescription'].forEach(function (id) {
      var el = $(id);
      el.addEventListener('input', function () { if (el.closest('.field').classList.contains('invalid')) validateListing(); });
    });

    // Owner dashboard
    $('requestTabs').addEventListener('click', function (e) {
      var tab = e.target.closest('.tab');
      if (!tab) return;
      state.requestTab = tab.getAttribute('data-filter');
      renderRequests();
    });
    $('requestsList').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-action]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var action = btn.getAttribute('data-action');
      if (action === 'approve') updateRequestStatus(id, STATUS.APPROVED);
      else if (action === 'reject') updateRequestStatus(id, STATUS.REJECTED);
      else if (action === 'return') updateRequestStatus(id, STATUS.RETURNED);
    });

    // Modal close (backdrop, X, any [data-close-modal])
    $('modal').addEventListener('click', function (e) {
      if (e.target.closest('[data-close-modal]')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal();
    });

    // Reset
    $('resetDemo').addEventListener('click', resetDemo);

    // Keep tabs in sync if another browser tab changes the data
    window.addEventListener('storage', function (e) {
      if (e.key === KEYS.items || e.key === KEYS.requests) {
        state.items = readStore(KEYS.items, state.items);
        state.requests = readStore(KEYS.requests, state.requests);
        renderAll();
      }
    });
  }

  /* ---------------------------------------------------------
     11. INIT
     --------------------------------------------------------- */
  function init() {
    try {
      initData();
    } catch (err) {
      console.error('RentMate: storage unavailable, using in-memory demo data.', err);
      state.items = sampleItems();
      state.requests = sampleRequests();
    }
    renderListFormOptions();
    bindEvents();
    renderAll();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // Exposed only for debugging/testing in the console
  window.RentMate = { state: state, calcDays: calcDays, findConflict: findConflict, updateRequestStatus: updateRequestStatus };
})();
