(function () {
  function press(group, btn) {
    group.forEach(function (b) {
      b.setAttribute('aria-pressed', String(b === btn));
    });
  }
  function all(sel) {
    return [].slice.call(document.querySelectorAll(sel));
  }
  // Cartes à une image : chaque bouton remplace l'image
  var sets = {};
  all('button[data-set]').forEach(function (b) {
    (sets[b.dataset.set] = sets[b.dataset.set] || []).push(b);
  });
  Object.keys(sets).forEach(function (k) {
    sets[k].forEach(function (b) {
      b.addEventListener('click', function () {
        document.getElementById('img-' + k).src = b.dataset.src;
        press(sets[k], b);
      });
    });
  });
  // Régional, local, courants : jour + annotations
  ['reg', 'loc', 'cur'].forEach(function (k) {
    var days = all('button[data-day="' + k + '"]');
    var ann = document.querySelector('button[data-ann="' + k + '"]');
    var img = document.getElementById('img-' + k);
    if (!days.length || !img) return;
    var state = { v: days[0].dataset.v, a: false };
    function draw() {
      img.src =
        'fig/' +
        k +
        '_' +
        state.v +
        '_' +
        (state.a ? 'annot' : 'base') +
        '.webp';
    }
    days.forEach(function (b) {
      b.addEventListener('click', function () {
        state.v = b.dataset.v;
        press(days, b);
        draw();
      });
    });
    if (ann)
      ann.addEventListener('click', function () {
        state.a = !state.a;
        ann.setAttribute('aria-pressed', String(state.a));
        draw();
      });
  });
  // Calques simples (DWD 500 hPa)
  all('button[data-layer]').forEach(function (b) {
    b.addEventListener('click', function () {
      var l = document.getElementById(b.dataset.layer);
      l.hidden = !l.hidden;
      var on = 'inverse' in b.dataset ? l.hidden : !l.hidden;
      b.setAttribute('aria-pressed', String(on));
    });
  });
  // Vent, vagues, courants toutes les 3 h
  var data = document.getElementById('sys-data');
  if (data) {
    var H = JSON.parse(data.textContent);
    var cur = 0;
    var on = { vent: true };
    var dayBox = document.getElementById('sys-days');
    var hourBox = document.getElementById('sys-hours');
    var label = document.getElementById('sys-label');
    var days = [];
    H.forEach(function (h) {
      if (days.indexOf(h.d) < 0) days.push(h.d);
    });
    function draw() {
      var h = H[cur];
      all('img[data-sys]').forEach(function (i) {
        var k = i.dataset.sys;
        var has = h.l.indexOf(k) >= 0;
        if (has) i.src = 'fig/sys_' + h.t + '_' + k + '.webp';
        i.hidden = !(on[k] && has);
      });
      label.textContent = h.q + (h.e.length ? ' · ' + h.e.join(' ; ') : '');
      all('#sys-days button').forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.d === h.d));
      });
      hourBox.innerHTML = '';
      var prev = document.createElement('button');
      prev.type = 'button';
      prev.textContent = '◀';
      prev.setAttribute('aria-label', 'Heure précédente');
      prev.disabled = cur === 0;
      prev.onclick = function () {
        cur -= 1;
        draw();
      };
      hourBox.appendChild(prev);
      H.forEach(function (x, i) {
        if (x.d !== h.d) return;
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = x.h + (x.e.length ? ' •' : '');
        if (x.e.length) b.title = x.e.join(' ; ');
        b.setAttribute('aria-pressed', String(i === cur));
        b.onclick = function () {
          cur = i;
          draw();
        };
        hourBox.appendChild(b);
      });
      var next = document.createElement('button');
      next.type = 'button';
      next.textContent = '▶';
      next.setAttribute('aria-label', 'Heure suivante');
      next.disabled = cur === H.length - 1;
      next.onclick = function () {
        cur += 1;
        draw();
      };
      hourBox.appendChild(next);
    }
    days.forEach(function (d) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = d;
      b.dataset.d = d;
      b.onclick = function () {
        for (var i = 0; i < H.length; i++)
          if (H[i].d === d) {
            cur = i;
            break;
          }
        draw();
      };
      dayBox.appendChild(b);
    });
    all('button[data-sys-layer]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.sysLayer;
        on[k] = !on[k];
        b.setAttribute('aria-pressed', String(!!on[k]));
        draw();
      });
    });
    draw();
  }
  // Plein écran
  var zoom = document.getElementById('zoom');
  var stack = zoom.querySelector('.stack');
  all('[data-zoom]').forEach(function (m) {
    m.addEventListener('click', function () {
      stack.innerHTML = '';
      m.querySelectorAll('img').forEach(function (i) {
        if (i.hidden) return;
        var c = i.cloneNode();
        c.removeAttribute('id');
        c.removeAttribute('loading');
        stack.appendChild(c);
      });
      zoom.hidden = false;
    });
  });
  zoom.addEventListener('click', function () {
    zoom.hidden = true;
    stack.innerHTML = '';
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') zoom.hidden = true;
  });
  // Taille du texte
  var size = 17;
  try {
    var s = parseInt(localStorage.getItem('asq-font'), 10);
    if (s >= 13 && s <= 26) size = s;
  } catch (e) {}
  function apply() {
    document.documentElement.style.fontSize = size + 'px';
    try {
      localStorage.setItem('asq-font', String(size));
    } catch (e) {}
  }
  if (size !== 17) apply();
  document.getElementById('fplus').addEventListener('click', function () {
    size = Math.min(26, size + 1);
    apply();
  });
  document.getElementById('fminus').addEventListener('click', function () {
    size = Math.max(13, size - 1);
    apply();
  });
  // Menu déroulant des versions (fichier index.json deux dossiers plus haut)
  var wrap = document.querySelector('.wrap');
  var zone = wrap.dataset.zone;
  var me = wrap.dataset.version;
  fetch('../../index.json', { cache: 'no-cache' })
    .then(function (r) {
      return r.ok ? r.json() : null;
    })
    .then(function (idx) {
      if (!idx || !idx.zones || !idx.zones[zone]) return;
      var vs = idx.zones[zone].versions;
      var sel = document.getElementById('vsel');
      vs.forEach(function (v) {
        var o = document.createElement('option');
        o.value = v.path;
        o.textContent = v.label + (v.auto || v.claude ? '' : ' (relancée)');
        if (v.id === me) o.selected = true;
        sel.appendChild(o);
      });
      sel.onchange = function () {
        location.href = '../../' + sel.value;
      };
      document.getElementById('versions').hidden = false;
      if (vs.length && vs[0].id !== me) {
        var a = document.getElementById('vlast');
        a.href = '../../' + vs[0].path;
        a.hidden = false;
      }
    })
    .catch(function () {});
})();
