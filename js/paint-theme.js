// Paint-brush theme switch.
// A brush paints the screen row by row (left to right, then right to left) in the new
// background colour, the theme changes underneath, then the visible text is splashed
// with fresh paint. Only text is splashed, so the whole screen never flashes.
//
// Usage (see js/script.js):  PaintTheme.run('dark', applyFunction)
// It returns false if an animation is already running.

(function () {
  // Which text gets splashed. Only text currently on screen is used.
  const INK = 'main :is(h1,h2,h3,h4,h5,h6,p,li,blockquote,label,dt,dd,td,th)';
  const MAX_SPLATS = 14;

  const html = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  let wall, brush;

  function ensureLayers() {
    if (wall) return;
    wall = document.createElement('canvas');
    wall.className = 'pd-wall';
    wall.setAttribute('aria-hidden', 'true');
    brush = document.createElement('div');
    brush.className = 'pd-brush';
    brush.setAttribute('aria-hidden', 'true');
    brush.innerHTML = '<div class="b"><div class="pd-handle"></div><div class="pd-ferrule"></div><div class="pd-bristles"></div></div>';
    document.body.append(wall, brush);
  }

  // run a function with CSS transitions switched off, so colours change instantly
  function noTrans(fn) {
    html.classList.add('pd-notrans');
    const result = fn();
    void html.offsetWidth;
    html.classList.remove('pd-notrans');
    return result;
  }

  function bgOf() {
    for (const el of [document.body, html]) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c;
    }
    return '#fff';
  }

  async function run(nextTheme, apply) {
    if (busy) return false;
    if (reduce.matches) { noTrans(apply); return true; }
    busy = true;
    ensureLayers();

    // 1) text on screen right now, and its current colour
    const found = [...document.querySelectorAll(INK)].filter(function (el) {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden';
    }).slice(0, MAX_SPLATS);
    const inks = found.filter(function (el) { return !found.some(function (o) { return o !== el && el.contains(o); }); });
    const olds = inks.map(function (el) { return getComputedStyle(el).color; });
    inks.forEach(function (el, i) {
      el.style.setProperty('--pd-old', olds[i]);
      el.style.setProperty('--pd-r', '0px');
      el.classList.add('pd-painting');      // text keeps its old colour while the wall is painted over it
    });

    // 2) the colour of the new wall, read from the real stylesheet
    const prevTheme = html.getAttribute('data-bs-theme');
    const wallColor = noTrans(function () {
      html.setAttribute('data-bs-theme', nextTheme);
      const c = bgOf();
      html.setAttribute('data-bs-theme', prevTheme);
      return c;
    });

    // 3) paint the wall with a brush, zig-zag. ONE timeline draws the paint and moves the brush.
    wall.style.opacity = '1';
    wall.style.display = 'block';
    const box = wall.getBoundingClientRect();           // real visible size (phones, tablets, desktops)
    const W = box.width, VH = box.height;
    const rowTarget = W < 600 ? 80 : 110;
    const N = Math.max(4, Math.round(VH / rowTarget)), H = VH / N;
    const DROP = 0.14, total = N + (N - 1) * DROP;
    const dpr = devicePixelRatio || 1;
    wall.width = Math.ceil(W * dpr);
    wall.height = Math.ceil(VH * dpr);
    const ctx = wall.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = wallColor;
    brush.style.opacity = '1';
    brush.style.setProperty('--h', H + 'px');
    brush.style.setProperty('--paint', wallColor);
    const endX = (N - 1) % 2 === 0 ? W : 0, endY = (N - 0.5) * H;

    function state(t) {
      let u = Math.min(t, 1) * total;
      for (let k = 0; k < N; k++) {
        const ltr = k % 2 === 0, sgn = ltr ? 1 : -1, y = (k + 0.5) * H;
        if (u <= 1 || k === N - 1) {                    // sweeping along row k
          const f = Math.min(u, 1);
          return { k: k, ltr: ltr, x: ltr ? W * f : W * (1 - f), y: y, s: sgn };
        }
        u -= 1;
        const xEnd = ltr ? W : 0;
        if (u <= DROP) {                                // dropping to the next row and turning round
          const g = u / DROP;
          return { k: k, ltr: ltr, x: xEnd, y: y + H * g, s: sgn * (1 - 2 * g) };
        }
        u -= DROP;
      }
    }

    function draw(st) {
      ctx.clearRect(0, 0, W, VH);
      if (st.k > 0) ctx.fillRect(0, 0, W, st.k * H + 1);          // finished rows
      const top = st.k * H, h = st.k === N - 1 ? VH - top : H;
      if (st.ltr) ctx.fillRect(0, top, st.x, h); else ctx.fillRect(st.x, top, W - st.x, h);
      brush.style.transform = 'translate(' + st.x + 'px, ' + st.y + 'px) scaleX(' + st.s + ')';
    }

    draw(state(0));
    brush.style.display = 'block';

    const dur = N * Math.min(450, Math.max(260, W * 0.55));         // quicker rows on small screens
    await new Promise(function (resolve) {
      const t0 = performance.now();
      function tick(now) {
        const t = Math.min((now - t0) / dur, 1);
        draw(state(t));
        if (t < 1) requestAnimationFrame(tick); else resolve();
      }
      requestAnimationFrame(tick);
    });

    // 4) wall fully painted: switch the real theme underneath, read the new text colours
    noTrans(apply);
    const news = inks.map(function (el) {
      el.classList.remove('pd-painting');
      return getComputedStyle(el).color;
    });
    inks.forEach(function (el, i) {
      el.style.setProperty('--pd-new', news[i]);
      el.style.setProperty('--pd-old', 'transparent');   // text stays hidden (painted over) until its splat lands
      el.classList.add('pd-painting');
    });
    await new Promise(function (r) { requestAnimationFrame(function () { requestAnimationFrame(r); }); });

    // fade the wall out to reveal the finished page (cards, images and so on appear smoothly)
    wall.animate({ opacity: [1, 0] }, { duration: 300, fill: 'forwards' }).onfinish = function () {
      wall.getAnimations().forEach(function (a) { a.cancel(); });
      ctx.clearRect(0, 0, W, VH);
      wall.style.display = 'none';
    };

    // 5) throw paint at the text only
    inks.forEach(function (el, i) {
      setTimeout(function () { splat(el, endX, endY, news[i], H); }, 150 + i * 110);
    });
    setTimeout(function () {
      brush.animate({ opacity: [1, 0] }, { duration: 350, fill: 'forwards' }).onfinish = function () {
        brush.getAnimations().forEach(function (a) { a.cancel(); });
        brush.style.display = 'none';
      };
    }, 500);
    setTimeout(function () { busy = false; }, inks.length * 110 + 1900);
    return true;
  }

  function splat(el, fromX, fromY, color, H) {
    const b = el.getBoundingClientRect();
    const tx = Math.min(innerWidth - 8, Math.max(8, b.left + b.width * (0.2 + Math.random() * 0.6)));
    const ty = Math.min(innerHeight - 8, Math.max(8, b.top + Math.min(b.height, 40) * (0.3 + Math.random() * 0.4)));
    const size = Math.max(14, Math.min(22, H * 0.2));
    const blob = document.createElement('div');
    Object.assign(blob.style, {
      position: 'fixed', left: '0', top: '0', width: size + 'px', height: size + 'px',
      marginLeft: -size / 2 + 'px', marginTop: -size / 2 + 'px', borderRadius: '50%',
      background: color, pointerEvents: 'none', zIndex: 2147483002
    });
    blob.setAttribute('aria-hidden', 'true');
    document.body.appendChild(blob);
    const midX = (fromX + tx) / 2, midY = Math.max(0, Math.min(fromY, ty) - 80);
    blob.animate([
      { transform: 'translate(' + fromX + 'px, ' + fromY + 'px) scale(1)' },
      { transform: 'translate(' + midX + 'px, ' + midY + 'px) scale(1.2)', offset: 0.5 },
      { transform: 'translate(' + tx + 'px, ' + ty + 'px) scale(0.8)' }
    ], { duration: 480, easing: 'ease-in', fill: 'forwards' }).onfinish = function () {
      blob.animate(
        [{ transform: 'translate(' + tx + 'px, ' + ty + 'px) scale(.8)', opacity: 1 },
         { transform: 'translate(' + tx + 'px, ' + ty + 'px) scale(3)', opacity: 0 }],
        { duration: 280, easing: 'ease-out', fill: 'forwards' }
      ).onfinish = function () { blob.remove(); };

      const bb = el.getBoundingClientRect();
      el.style.setProperty('--pd-x', (tx - bb.left) + 'px');
      el.style.setProperty('--pd-y', (ty - bb.top) + 'px');
      void el.offsetWidth;
      el.style.setProperty('--pd-r', (Math.hypot(bb.width, bb.height) + 40) + 'px');
      setTimeout(function () {
        el.classList.remove('pd-painting');
        ['--pd-x', '--pd-y', '--pd-r', '--pd-old', '--pd-new'].forEach(function (p) { el.style.removeProperty(p); });
      }, 950);
    };
  }

  window.PaintTheme = { run: run };
})();
