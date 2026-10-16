/* nad.world: interactions. No dependencies. Everything degrades to plain links and static content without JS. */
(() => {
  'use strict';
  const d = document, root = d.documentElement;
  const RM = matchMedia('(prefers-reduced-motion: reduce)');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)');
  const still = () => RM.matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ------------------------------------------------------------ scroll-driven bits (one rAF per frame) */
  const header = d.querySelector('.site-header');
  const bar = d.querySelector('.progress span');
  const tl = d.querySelector('.tl');
  const tlItems = tl ? [...tl.querySelectorAll('.tl-item')] : [];
  const scrollers = [];
  let lastY = scrollY, queued = false;

  function frame() {
    queued = false;
    const y = scrollY, vh = innerHeight;
    if (header && !root.classList.contains('lb-open')) {
      header.classList.toggle('solid', y > 24);
      if (Math.abs(y - lastY) > 6) {
        const hide = y > lastY && y > 200 && !header.contains(d.activeElement);
        header.classList.toggle('hide', hide);
        lastY = y;
      }
    }
    if (bar) {
      const h = root.scrollHeight - vh;
      bar.style.transform = `scaleX(${h > 0 ? clamp(y / h, 0, 1) : 0})`;
    }
    if (tl) {
      const r = tl.getBoundingClientRect();
      const p = still() ? 1 : clamp((vh * 0.62 - r.top) / r.height, 0, 1);
      tl.style.setProperty('--p', p.toFixed(4));
      tlItems.forEach(li => li.classList.toggle('lit', still() || li.getBoundingClientRect().top < vh * 0.62));
    }
    parallax();
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(frame); } };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  if (header) header.addEventListener('focusin', () => header.classList.remove('hide'));

  /* ------------------------------------------------------------ reveal on scroll (only what starts below the fold) */
  const reveals = [...d.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !still()) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    reveals.forEach(el => {
      if (el.getBoundingClientRect().top < innerHeight) return;
      const sibs = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
      el.style.setProperty('--d', (sibs.indexOf(el) % 3) * 90 + 'ms');
      el.classList.add('pre');
      io.observe(el);
    });
  }

  /* ------------------------------------------------------------ home cover: collage follows the pointer and the scroll */
  const collage = d.querySelector('.collage');
  const cols = collage ? [...collage.querySelectorAll('.ccol')] : [];
  let px = 0, py = 0, tx = 0, ty = 0, praf = 0;
  function parallax() {
    if (!cols.length || still()) return;
    const sy = Math.min(scrollY, innerHeight * 1.2);
    tx += (px - tx) * 0.08; ty += (py - ty) * 0.08;
    cols[0].style.setProperty('--mx', (tx * -12).toFixed(2) + 'px');
    cols[0].style.setProperty('--my', (ty * -12 - sy * 0.06).toFixed(2) + 'px');
    cols[1].style.setProperty('--mx', (tx * 16).toFixed(2) + 'px');
    cols[1].style.setProperty('--my', (ty * 16 - sy * 0.18).toFixed(2) + 'px');
  }
  if (cols.length && FINE.matches) {
    const loop = () => { parallax(); praf = (Math.abs(px - tx) + Math.abs(py - ty) > 0.002) ? requestAnimationFrame(loop) : 0; };
    d.querySelector('.cover').addEventListener('pointermove', e => {
      px = e.clientX / innerWidth - 0.5; py = e.clientY / innerHeight - 0.5;
      if (!praf) praf = requestAnimationFrame(loop);
    });
  }

  /* ------------------------------------------------------------ cursor label ("View", "Drag", "Open") */
  if (FINE.matches && !still()) {
    const cur = d.createElement('div');
    cur.className = 'cursor'; cur.setAttribute('aria-hidden', 'true'); cur.innerHTML = '<span></span>';
    d.body.appendChild(cur);
    const label = cur.firstChild;
    let x = -200, y = -200, cx = x, cy = y, raf = 0;
    const loop = () => {
      cx += (x - cx) * 0.25; cy += (y - cy) * 0.25;
      cur.style.transform = `translate3d(${cx.toFixed(1)}px, ${cy.toFixed(1)}px, 0)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.4 ? requestAnimationFrame(loop) : 0;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX; y = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);
      const t = e.target.closest ? e.target.closest('[data-cursor]') : null;
      const sc = t && t.classList.contains('scroller') && !t.classList.contains('scrollable');
      if (t && !sc) { if (label.textContent !== t.dataset.cursor) label.textContent = t.dataset.cursor; cur.classList.add('show'); }
      else cur.classList.remove('show');
    }, { passive: true });
    d.addEventListener('pointerleave', () => cur.classList.remove('show'));
    addEventListener('blur', () => cur.classList.remove('show'));
  }

  /* ------------------------------------------------------------ long-page tracks: drag to scroll, edge fades, active section */
  d.querySelectorAll('.scroller').forEach(sc => {
    scrollers.push(sc);
    const edges = () => {
      const max = sc.scrollWidth - sc.clientWidth;
      sc.classList.toggle('scrollable', max > 8);
      sc.classList.toggle('at-start', sc.scrollLeft < 8);
      sc.classList.toggle('at-end', sc.scrollLeft > max - 8);
    };
    sc.addEventListener('scroll', edges, { passive: true });
    addEventListener('resize', edges);
    addEventListener('load', edges);
    edges();

    let down = false, moved = false, sx = 0, sl = 0, vx = 0, lx = 0, lt = 0;
    sc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      down = true; moved = false; sx = lx = e.clientX; sl = sc.scrollLeft; lt = performance.now(); vx = 0;
    });
    addEventListener('pointermove', e => {
      if (!down) return;
      const dx = e.clientX - sx;
      if (!moved && Math.abs(dx) > 6) { moved = true; sc.classList.add('dragging'); }
      if (moved) {
        sc.scrollLeft = sl - dx;
        const now = performance.now(); vx = (e.clientX - lx) / Math.max(1, now - lt); lx = e.clientX; lt = now;
      }
    });
    addEventListener('pointerup', () => {
      if (!down) return;
      down = false;
      if (moved) {
        sc.dataset.dragged = '1';
        setTimeout(() => { delete sc.dataset.dragged; sc.classList.remove('dragging'); }, 30);
        if (!still() && Math.abs(vx) > 0.2) {          // a little glide after a flick
          let v = vx * 16;
          const glide = () => { sc.scrollLeft -= v; v *= 0.92; if (Math.abs(v) > 0.5) requestAnimationFrame(glide); };
          requestAnimationFrame(glide);
        }
      }
    });
    sc.addEventListener('click', e => { if (sc.dataset.dragged) { e.preventDefault(); e.stopPropagation(); } }, true);
    sc.addEventListener('dragstart', e => e.preventDefault());

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('on', e.intersectionRatio > 0.55)),
        { root: sc, threshold: [0, 0.55, 1] });
      sc.querySelectorAll('.part').forEach(p => io.observe(p));
    }
  });

  /* ------------------------------------------------------------ archive: preview follows the pointer */
  const arc = d.querySelector('.arc-list');
  if (arc && FINE.matches) {
    const pv = d.createElement('img');
    pv.className = 'arc-preview'; pv.alt = ''; pv.setAttribute('aria-hidden', 'true');
    d.body.appendChild(pv);
    let x = 0, y = 0, cx = 0, cy = 0, raf = 0;
    const place = () => {
      cx += (x - cx) * (still() ? 1 : 0.16); cy += (y - cy) * (still() ? 1 : 0.16);
      const rot = still() ? 0 : clamp((x - cx) * 0.05, -6, 6);
      pv.style.transform = `translate3d(${cx.toFixed(1)}px, ${(cy - pv.offsetHeight / 2).toFixed(1)}px, 0) rotate(${rot.toFixed(2)}deg)`;
      raf = Math.abs(x - cx) + Math.abs(y - cy) > 0.4 ? requestAnimationFrame(place) : 0;
    };
    const target = e => {                     // keep clear of the title (left) and the type (right)
      const r = arc.getBoundingClientRect();
      x = r.left + r.width * 0.56 + (e.clientX - (r.left + r.width / 2)) * 0.12; y = e.clientY;
    };
    arc.querySelectorAll('a[data-preview]').forEach(a => {
      a.addEventListener('pointerenter', e => {
        if (pv.getAttribute('src') !== a.dataset.preview) pv.src = a.dataset.preview;
        target(e);
        if (!pv.classList.contains('show')) { cx = x; cy = y; }
        pv.classList.add('show'); if (!raf) raf = requestAnimationFrame(place);
      });
      a.addEventListener('pointerleave', () => pv.classList.remove('show'));
    });
    arc.addEventListener('pointermove', e => { target(e); if (!raf) raf = requestAnimationFrame(place); });
  }

  /* ------------------------------------------------------------ copy email */
  d.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    const value = b.dataset.copy, lab = b.querySelector('.btn-label') || b;
    let ok = false;
    try { await navigator.clipboard.writeText(value); ok = true; } catch (_) {
      const ta = d.createElement('textarea');
      ta.value = value; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      d.body.appendChild(ta); ta.select();
      try { ok = d.execCommand('copy'); } catch (__) { ok = false; }
      ta.remove();
    }
    const live = d.querySelector('.sr-live');
    const msg = ok ? 'Email address copied' : 'Copy not available here. Use the Email me button.';
    if (!b.dataset.label) b.dataset.label = lab.textContent;
    lab.textContent = ok ? 'Copied' : 'Copy not available';
    b.classList.toggle('done', ok);
    if (live) live.textContent = msg;
    clearTimeout(b._t);
    b._t = setTimeout(() => { lab.textContent = b.dataset.label; b.classList.remove('done'); }, 2200);
  }));

  /* ------------------------------------------------------------ full-screen image viewer */
  const triggers = [...d.querySelectorAll('a.vz')];
  if (triggers.length) viewer(triggers);

  function viewer(triggers) {
    const I = {
      close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
      prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
      next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
      zin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M11 8v6M8 11h6"/></svg>',
      zout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5M8 11h6"/></svg>'
    };
    const lb = d.createElement('div');
    lb.className = 'lb'; lb.hidden = true;
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', 'Image viewer');
    lb.innerHTML =
      '<div class="lb-bg"></div><div class="lb-stage"><img class="lb-img" alt="" draggable="false"></div>' +
      '<div class="lb-bar"><p class="lb-cap"></p><div class="lb-ctrl"><span class="lb-count" aria-live="polite"></span>' +
      `<button type="button" class="lb-btn lb-zoom" aria-pressed="false" aria-label="Zoom to actual size">${I.zin}</button>` +
      `<button type="button" class="lb-btn lb-prev" aria-label="Previous image">${I.prev}</button>` +
      `<button type="button" class="lb-btn lb-next" aria-label="Next image">${I.next}</button>` +
      `<button type="button" class="lb-btn lb-close" aria-label="Close viewer">${I.close}</button></div></div><div class="lb-load"></div>`;
    d.body.appendChild(lb);
    const $ = s => lb.querySelector(s);
    const bg = $('.lb-bg'), stage = $('.lb-stage'), img = $('.lb-img'), barEl = $('.lb-bar'),
      cap = $('.lb-cap'), count = $('.lb-count'), bZoom = $('.lb-zoom'), bPrev = $('.lb-prev'), bNext = $('.lb-next'), bClose = $('.lb-close');

    let items = [], idx = 0, zoomed = false, L = null, opener = null, openedFrom = null, token = 0, inerted = [];

    const itemOf = a => {
      const sec = a.closest('section'), t = sec && sec.querySelector('.sec-title');
      const st = t ? t.textContent.trim() : '', c = a.dataset.cap || '';
      const caption = !st || st === 'In context' ? c : (!c || c.includes(st) ? (c || st) : `${st}: ${c}`);
      return { href: a.getAttribute('href'), w: +a.dataset.w, h: +a.dataset.h, cap: caption, lw: +(a.dataset.lw || 0), el: a };
    };

    function group(a) {
      const scope = a.closest('section') || d.body;
      const seen = new Map();
      triggers.filter(t => scope.contains(t)).forEach(t => {
        const href = t.getAttribute('href');
        if (!seen.has(href)) seen.set(href, itemOf(t));
      });
      return [...seen.values()];
    }

    function layout(it, z) {
      const pad = innerWidth < 700 ? 12 : 40;
      lb.style.setProperty('--pad', pad + 'px');
      const barH = barEl.offsetHeight || 76;
      lb.style.setProperty('--barh', barH + 'px');
      const aw = innerWidth - pad * 2, ah = innerHeight - barH - pad * 2;
      const fitS = Math.min(1, aw / it.w, ah / it.h);
      const tall = it.h / it.w > 2 && it.h * Math.min(1, aw / it.w) > ah * 1.15;
      let w, mode;
      if (z) { w = it.w; mode = 'zoom'; }                                   // actual pixels, never more
      else if (tall) {                                                       // long pages: fit the width, scroll down
        const cap = it.lw ? (it.lw < 700 ? Math.round(it.lw * 1.25) : it.lw) : 1440;
        w = Math.min(it.w, aw, cap); mode = 'tall';
      } else { w = it.w * fitS; mode = 'fit'; }
      w = Math.round(w);
      return { w, h: Math.round(it.h * w / it.w), mode, canZoom: w < it.w - 1 };
    }

    function apply() {
      img.style.width = L.w + 'px'; img.style.height = L.h + 'px';
      lb.classList.toggle('can-zoom', L.canZoom || zoomed);
      lb.classList.toggle('zoomed', zoomed);
      bZoom.hidden = !(L.canZoom || zoomed);
      bZoom.innerHTML = zoomed ? I.zout : I.zin;
      bZoom.setAttribute('aria-pressed', String(zoomed));
      bZoom.setAttribute('aria-label', zoomed ? 'Fit to screen' : 'Zoom to actual size');
    }

    function load(it) {
      const my = ++token;
      lb.classList.add('loading');
      const pre = new Image();
      pre.decoding = 'async';
      pre.onload = () => { if (my !== token) return; img.src = it.href; lb.classList.remove('loading'); };
      pre.onerror = () => { if (my === token) lb.classList.remove('loading'); };
      pre.src = it.href;
      [items[(idx + 1) % items.length], items[(idx - 1 + items.length) % items.length]].forEach(n => { if (n && n !== it) { const p = new Image(); p.src = n.href; } });
    }

    function show(i, from, start, dir) {
      idx = (i + items.length) % items.length;
      const it = items[idx];
      zoomed = false;
      const thumb = (from || it.el).querySelector('img');
      img.removeAttribute('src');
      const same = thumb && thumb.naturalWidth && Math.abs(thumb.naturalHeight / thumb.naturalWidth - it.h / it.w) < 0.03 * (it.h / it.w);
      if (same) img.src = thumb.currentSrc || thumb.src;                 // instant preview while the full image loads (same framing only)
      img.alt = it.cap;
      cap.textContent = it.cap;
      count.textContent = items.length > 1 ? `${idx + 1} / ${items.length}` : '';
      bPrev.hidden = bNext.hidden = items.length < 2;
      L = layout(it, false); apply();
      stage.scrollLeft = 0;
      stage.scrollTop = start && L.mode === 'tall' ? Math.max(0, start * L.h - 8) : 0;
      load(it);
      if (still()) return;
      if (from && thumb) {
        const t = thumb.getBoundingClientRect(), f = img.getBoundingClientRect();
        if (t.width && f.width) {
          const oy = (start && L.mode === 'tall') ? start * L.h : 0;
          const k = t.width / f.width;
          img.animate([
            { transformOrigin: `0 ${oy}px`, transform: `translate(${t.left - f.left}px, ${t.top - (f.top + oy)}px) scale(${k})`, opacity: 0.4 },
            { transformOrigin: `0 ${oy}px`, transform: 'none', opacity: 1 }
          ], { duration: 460, easing: 'cubic-bezier(.2,.8,.2,1)' });
        }
      } else if (dir) {
        img.animate([{ transform: `translateX(${dir * 48}px)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
          { duration: 320, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    }

    function open(a) {
      items = group(a);
      const href = a.getAttribute('href');
      const i = Math.max(0, items.findIndex(x => x.href === href));
      opener = d.activeElement; openedFrom = a;
      const sw = innerWidth - root.clientWidth;
      root.classList.add('lb-open');
      if (sw > 0) root.style.paddingRight = sw + 'px';
      inerted = [...d.body.children].filter(c => c !== lb && !c.inert);
      inerted.forEach(c => { c.inert = true; });
      lb.hidden = false;
      show(i, a, +(a.dataset.start || 0));
      if (!still()) {
        bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
        barEl.animate([{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 120, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
      }
      bClose.focus({ preventScroll: true });
    }

    function close() {
      if (lb.hidden) return;
      const done = () => {
        lb.hidden = true; img.removeAttribute('src'); token++;
        root.classList.remove('lb-open'); root.style.paddingRight = '';
        inerted.forEach(c => { c.inert = false; }); inerted = [];
        if (opener && opener.focus) opener.focus({ preventScroll: true });
      };
      if (still()) return done();
      const it = items[idx];
      const thumb = openedFrom && it.href === openedFrom.getAttribute('href') && !zoomed ? openedFrom.querySelector('img') : null;
      const t = thumb && thumb.getBoundingClientRect();
      const visible = t && t.width && t.bottom > 0 && t.top < innerHeight;
      const f = img.getBoundingClientRect();
      let anim;
      if (visible && L.mode !== 'tall') {
        const k = t.width / f.width;
        anim = img.animate([{ transformOrigin: '0 0', transform: 'none', opacity: 1 },
          { transformOrigin: '0 0', transform: `translate(${t.left - f.left}px, ${t.top - f.top}px) scale(${k})`, opacity: 0.6 }],
          { duration: 360, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      } else {
        anim = img.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.96)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' });
      }
      barEl.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      bg.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 340, easing: 'ease-in', fill: 'forwards' }).onfinish = () => {
        done(); anim.cancel(); if (lb.getAnimations) lb.getAnimations({ subtree: true }).forEach(x => x.cancel());
      };
    }

    function go(step) { if (items.length > 1) show(idx + step, null, 0, step); }

    function setZoom(z, cx, cy) {
      const it = items[idx];
      const before = img.getBoundingClientRect(), sr = stage.getBoundingClientRect();
      const rx = cx == null ? 0.5 : clamp((cx - before.left) / before.width, 0, 1);
      const ry = cy == null ? (stage.scrollTop + sr.height / 2) / Math.max(1, before.height) : clamp((cy - before.top) / before.height, 0, 1);
      const ax = cx == null ? sr.width / 2 : cx - sr.left, ay = cy == null ? sr.height / 2 : cy - sr.top;
      zoomed = z; L = layout(it, z); apply();
      stage.scrollLeft = img.offsetLeft + rx * L.w - ax;
      stage.scrollTop = img.offsetTop + ry * L.h - ay;
      if (!still()) img.animate([{ opacity: 0.6 }, { opacity: 1 }], { duration: 200 });
    }

    // open from any thumbnail
    d.addEventListener('click', e => {
      const a = e.target.closest && e.target.closest('a.vz');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      open(a);
    });

    bClose.addEventListener('click', close);
    bPrev.addEventListener('click', () => go(-1));
    bNext.addEventListener('click', () => go(1));
    bZoom.addEventListener('click', () => setZoom(!zoomed));

    // background closes; the image zooms; mouse drag pans
    let pan = null;
    stage.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button === 0 && e.target === img && (zoomed || L.mode === 'tall')) {
        pan = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop, moved: false };
      }
    });
    addEventListener('pointermove', e => {
      if (!pan) return;
      const dx = e.clientX - pan.x, dy = e.clientY - pan.y;
      if (!pan.moved && Math.hypot(dx, dy) > 5) { pan.moved = true; lb.classList.add('panning'); }
      if (pan.moved) { stage.scrollLeft = pan.l - dx; stage.scrollTop = pan.t - dy; }
    });
    addEventListener('pointerup', () => { if (pan) { setTimeout(() => { pan = null; lb.classList.remove('panning'); }, 0); } });
    stage.addEventListener('click', e => {
      if (pan && pan.moved) return;
      if (e.target === img) { if (L.canZoom || zoomed) setZoom(!zoomed, e.clientX, e.clientY); }
      else close();
    });

    // swipe between images on touch screens
    let sw = null;
    stage.addEventListener('touchstart', e => { if (e.touches.length === 1 && !zoomed) sw = { x: e.touches[0].clientX, y: e.touches[0].clientY }; }, { passive: true });
    stage.addEventListener('touchend', e => {
      if (!sw) return;
      const t = e.changedTouches[0], dx = t.clientX - sw.x, dy = t.clientY - sw.y; sw = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 50) go(dx < 0 ? 1 : -1);
    }, { passive: true });

    // keyboard: Esc, arrows, zoom, focus trap
    d.addEventListener('keydown', e => {
      if (lb.hidden) return;
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); close(); }
      else if (k === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (k === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if ((k === '+' || k === '=' || k === 'z') && (L.canZoom || zoomed)) { e.preventDefault(); setZoom(!zoomed); }
      else if (k === '-' && zoomed) { e.preventDefault(); setZoom(false); }
      else if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'PageDown' || k === 'PageUp' || k === 'Home' || k === 'End' || (k === ' ' && e.target.tagName !== 'BUTTON')) {
        e.preventDefault();
        const page = stage.clientHeight * 0.85;
        const by = { ArrowDown: 80, ArrowUp: -80, PageDown: page, PageUp: -page, ' ': e.shiftKey ? -page : page }[k];
        if (k === 'Home') stage.scrollTo({ top: 0, behavior: still() ? 'auto' : 'smooth' });
        else if (k === 'End') stage.scrollTo({ top: stage.scrollHeight, behavior: still() ? 'auto' : 'smooth' });
        else stage.scrollBy({ top: by, behavior: still() ? 'auto' : 'smooth' });
      } else if (k === 'Tab') {
        const f = [...lb.querySelectorAll('button')].filter(b => !b.hidden);
        const i = f.indexOf(d.activeElement);
        e.preventDefault();
        f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });

    addEventListener('resize', () => {
      if (lb.hidden) return;
      const it = items[idx], top = stage.scrollTop / Math.max(1, L.h);
      L = layout(it, zoomed); apply(); stage.scrollTop = top * L.h;
    });
  }

  frame();
})();
