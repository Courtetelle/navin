/* =====================================================================
   MODE ÉDITION DES BOUTONS (demande de Corban, 2026-10-31)
   Chaque bouton peut être renommé (texte principal et petit texte),
   changer de taille et de façon d'afficher un texte long :
   retour à la ligne, une seule ligne coupée, ou texte déroulant au toucher.
   Les changements sont gardés sur le téléphone (ldb.uiEdits), inclus dans
   la sauvegarde complète, et exportables pour être intégrés aux versions suivantes.
   ===================================================================== */
let uiEdits = store.get('ldb.uiEdits', {}); // { clé: { label, sub, size, wrap, view, orig, origSub, at } }
let uiEditMode = false;
const APP_VERSION = 'v453';
const UI_SIZES = [['s', 'Petit'], ['m', 'Normal'], ['l', 'Grand'], ['xl', 'Très grand']];
const UI_WRAPS = [['wrap', 'Retour à la ligne'], ['clip', 'Une ligne (coupée)'], ['roll', 'Déroulant au toucher']];
const saveUiEdits = () => { store.set('ldb.uiEdits', uiEdits); store.set('ldb.uiEdits.at', new Date().toISOString()); };

// Texte principal d'un bouton : ses nœuds texte directs, ou sinon le texte d'un <span> (onglets du bas).
function uiLabelNodes(b) {
  const direct = [...b.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim());
  if (direct.length) return direct;
  const span = [...b.children].find((c) => c.tagName === 'SPAN' && !c.children.length && c.textContent.trim());
  return span ? [span.firstChild] : [];
}
const uiText = (b) => uiLabelNodes(b).map((n) => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
// Clé stable : la vue + l'identifiant ou l'action du bouton, sinon son texte d'origine.
function uiKey(b) {
  if (b.dataset.ueKey) return b.dataset.ueKey;
  const view = b.closest('.topnav') ? 'onglets' : b.closest('#view') ? (currentView || '') : 'haut';
  let sig = b.id ? '#' + b.id : '';
  if (!sig) {
    const a = [...b.attributes].filter((x) => x.name.startsWith('data-') && !x.name.startsWith('data-ue')).map((x) => `${x.name}=${x.value}`);
    sig = a.join('&');
  }
  if (!sig) sig = 'txt=' + uiText(b).slice(0, 60);
  const k = `${view}|${sig}`;
  b.dataset.ueKey = k;
  b.dataset.ueOrig = uiText(b);
  const sm = b.querySelector(':scope > small');
  if (sm) b.dataset.ueOrigSub = sm.textContent;
  return k;
}
function uiApply(b) {
  const k = uiKey(b);
  const e = uiEdits[k];
  b.classList.remove('ue-s', 'ue-m', 'ue-l', 'ue-xl', 'ue-clip', 'ue-roll');
  if (!e) return;
  if (e.label != null && e.label !== '') {
    const nodes = uiLabelNodes(b);
    if (nodes.length) {
      // On garde un éventuel emoji de tête si le nouveau texte n'en a pas.
      nodes[0].textContent = (nodes[0].nodeType === 3 && nodes[0].textContent.startsWith(' ') ? ' ' : '') + e.label + (nodes[0].nodeType === 3 && /\s$/.test(nodes[0].textContent) && b.querySelector(':scope > small') ? ' ' : '');
      nodes.slice(1).forEach((n) => { n.textContent = ''; });
    }
  }
  if (e.sub != null && e.sub !== '') {
    let sm = b.querySelector(':scope > small');
    if (!sm) { sm = document.createElement('small'); b.appendChild(sm); }
    sm.textContent = e.sub;
  }
  if (e.size && e.size !== 'm') b.classList.add('ue-' + e.size);
  if (e.wrap === 'clip' || e.wrap === 'roll') b.classList.add('ue-' + e.wrap);
  if (e.wrap === 'roll') { uiWrapRoll(b); setTimeout(() => uiRoll(b), 400); } // déroule une première fois à l'affichage
}
// Texte déroulant : le texte est placé dans un ruban qui défile au toucher.
function uiWrapRoll(b) {
  if (b.querySelector(':scope > .ue-track')) return;
  const tr = document.createElement('span');
  tr.className = 'ue-track';
  while (b.firstChild) tr.appendChild(b.firstChild);
  b.appendChild(tr);
}
let uiPending = false;
function uiApplyAll() {
  uiPending = false;
  uiAutoRollAll();
  for (const b of document.querySelectorAll('.btn, .tab')) {
    if (b.closest('#uiEditor, #uiEditBar')) continue;
    if (b.dataset.ueDone === '1') continue;
    uiApply(b);
    b.dataset.ueDone = '1';
  }
}
/* Textes coupés (Corban, 2026-10-31) : le nom de la croisière et tout texte qui ne tient pas sur sa ligne
   défilent selon la même règle que les boutons « déroulant » : une fois à l'affichage, puis à chaque effleurement.
   Les éléments concernés sont ceux que la feuille de style coupe (text-overflow: ellipsis). */
let uiCutSel = null;
function uiCutSelector() {
  if (uiCutSel != null) return uiCutSel;
  const sels = ['.voyage'];
  try {
    for (const sh of document.styleSheets) {
      let rules; try { rules = sh.cssRules; } catch { continue; }
      const walk = (rs) => { for (const r of rs) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.style && r.style.textOverflow === 'ellipsis' && !/ue-|@media print/.test(r.selectorText || '')) sels.push(r.selectorText); } };
      walk(rules);
    }
  } catch {}
  uiCutSel = [...new Set(sels)].join(', ');
  return uiCutSel;
}
function uiAutoRollAll() {
  let list; try { list = document.querySelectorAll(uiCutSelector()); } catch { return; }
  for (const el of list) {
    if (el.closest('#uiEditor, #uiEditBar') || el.classList.contains('ue-roll') || el.classList.contains('ue-clip')) continue;
    const tr = el.querySelector(':scope > .ue-track');
    if (tr) { if (tr.dataset.txt !== tr.textContent) { tr.dataset.txt = tr.textContent; setTimeout(() => uiRoll(el), 400); } continue; }
    if (!el.textContent.trim() || el.scrollWidth <= el.clientWidth + 1) continue;
    uiWrapRoll(el);
    el.classList.add('ue-roll-auto');
    const t = el.querySelector(':scope > .ue-track'); t.dataset.txt = t.textContent;
    setTimeout(() => uiRoll(el), 400);
  }
  // Un texte qui tient de nouveau (rotation de l'écran) n'a plus besoin de défiler : rien à faire, uiRoll ne bouge pas.
}
new MutationObserver(() => { if (!uiPending) { uiPending = true; requestAnimationFrame(uiApplyAll); } }).observe(document.documentElement, { childList: true, subtree: true });

// Texte déroulant : il défile une fois à l'affichage, puis à chaque effleurement (l'action du bouton se fait quand même au toucher).
function uiRoll(b) {
  if (!b || !b.isConnected || uiEditMode) return;
  const tr = b.querySelector('.ue-track');
  if (!tr) return;
  const over = tr.scrollWidth - b.clientWidth + 24;
  if (over <= 0) return;
  tr.style.setProperty('--ue-shift', `-${over}px`);
  tr.style.setProperty('--ue-dur', `${Math.max(2, over / 40)}s`);
  if (tr.classList.contains('rolling') && tr.dataset.rollEnd > Date.now()) return; // déjà en cours
  tr.dataset.rollEnd = Date.now() + parseFloat(tr.style.getPropertyValue('--ue-dur')) * 1000;
  tr.classList.remove('rolling'); void tr.offsetWidth; tr.classList.add('rolling');
}
const uiRollFrom = (e) => uiRoll(e.target.closest && e.target.closest('.ue-roll, .ue-roll-auto'));
document.addEventListener('pointerdown', uiRollFrom, { passive: true, capture: true });
document.addEventListener('pointerover', uiRollFrom, { passive: true });
document.addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) uiRoll(document.elementFromPoint(t.clientX, t.clientY)?.closest('.ue-roll, .ue-roll-auto')); }, { passive: true });

/* ---------- Le mode édition ---------- */
function setUiEditMode(on) {
  uiEditMode = on;
  document.body.classList.toggle('ui-editing', on);
  let bar = $('#uiEditBar');
  if (on && !bar) {
    bar = document.createElement('div');
    bar.id = 'uiEditBar';
    bar.innerHTML = `<span id="uiEditMsg"></span><button class="btn" id="uiEditNav"></button><button class="btn" id="uiEditDone">✔ Terminer</button>`;
    document.body.appendChild(bar);
    // Basculer entre « Modifier » (un toucher ouvre l'éditeur) et « Naviguer » (les boutons marchent normalement,
    // pour aller jusqu'à la page du bouton à modifier) sans quitter le mode édition.
    $('#uiEditNav').onclick = () => { buzz(); setUiEditPick(!uiEditPick); };
    setUiEditPick(true);
    $('#uiEditDone').onclick = () => { buzz(); setUiEditMode(false); toast(`${Object.keys(uiEdits).length} bouton(s) modifié(s). Exportez-les depuis Réglages pour les envoyer à Claude.`); };
  }
  if (!on && bar) bar.remove();
}
let uiEditPick = true;
function setUiEditPick(on) {
  uiEditPick = on;
  document.body.classList.toggle('ui-edit-nav', !on);
  const m = $('#uiEditMsg'), n = $('#uiEditNav');
  if (m) m.textContent = on ? '✎ Touchez un bouton pour le modifier' : '➜ Navigation : allez à la page voulue';
  if (n) n.textContent = on ? '➜ Naviguer' : '✎ Modifier';
}
// En mode édition, un toucher sur un bouton ouvre l'éditeur au lieu de faire l'action.
const uiEditCatch = (e) => {
  if (!uiEditMode || !uiEditPick) return;
  const b = e.target.closest && e.target.closest('.btn, .tab');
  if (!b || b.closest('#uiEditor, #uiEditBar')) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  if (e.type === 'click') openUiEditor(b);
};
for (const t of ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup']) document.addEventListener(t, uiEditCatch, { capture: true, passive: false });

function openUiEditor(b) {
  const k = uiKey(b);
  const e = Object.assign({ size: 'm', wrap: 'wrap' }, uiEdits[k]);
  const orig = b.dataset.ueOrig || '', origSub = b.dataset.ueOrigSub;
  const ov = document.createElement('div');
  ov.id = 'uiEditor';
  ov.innerHTML = `<div class="ue-sheet">
    <h2>Modifier le bouton</h2>
    <p class="help">D’origine : <b>${esc(orig || '(sans texte)')}</b>${origSub ? `<br><small>${esc(origSub)}</small>` : ''}</p>
    <div class="cf"><label for="ueLabel">Texte du bouton</label><input class="text" id="ueLabel" type="text" value="${esc(e.label || orig)}"></div>
    ${origSub != null || e.sub ? `<div class="cf"><label for="ueSub">Petit texte</label><input class="text" id="ueSub" type="text" value="${esc(e.sub || origSub || '')}"></div>` : ''}
    <h3>Taille du texte</h3>
    <div class="row c4">${UI_SIZES.map(([v, l]) => `<button class="btn ${e.size === v ? 'on' : ''}" data-uesize="${v}">${l}</button>`).join('')}</div>
    <h3>Texte long</h3>
    <div class="row c3">${UI_WRAPS.map(([v, l]) => `<button class="btn ${e.wrap === v ? 'on' : ''}" data-uewrap="${v}">${l}</button>`).join('')}</div>
    <div class="row c2" style="margin-top:14px"><button class="btn big primary" id="ueSave">✔ Enregistrer</button><button class="btn big" id="ueCancel">Annuler</button></div>
    ${uiEdits[k] ? '<div class="row"><button class="btn danger" id="ueReset">↺ Revenir au bouton d’origine</button></div>' : ''}
  </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = (ev) => {
    const t = ev.target.closest('button');
    if (ev.target === ov) return close();
    if (!t) return;
    buzz();
    if (t.dataset.uesize) { e.size = t.dataset.uesize; ov.querySelectorAll('[data-uesize]').forEach((x) => x.classList.toggle('on', x === t)); }
    if (t.dataset.uewrap) { e.wrap = t.dataset.uewrap; ov.querySelectorAll('[data-uewrap]').forEach((x) => x.classList.toggle('on', x === t)); }
    if (t.id === 'ueCancel') close();
    if (t.id === 'ueReset') { delete uiEdits[k]; saveUiEdits(); close(); uiRefresh(); toast('Bouton remis d’origine'); }
    if (t.id === 'ueSave') {
      const label = $('#ueLabel').value.trim(), sub = $('#ueSub') ? $('#ueSub').value.trim() : '';
      const rec = { view: k.split('|')[0], orig, at: new Date().toISOString() };
      if (origSub != null) rec.origSub = origSub;
      if (label && label !== orig) rec.label = label;
      if (sub && sub !== (origSub || '')) rec.sub = sub;
      if (e.size !== 'm') rec.size = e.size;
      if (e.wrap !== 'wrap') rec.wrap = e.wrap;
      if (rec.label || rec.sub || rec.size || rec.wrap) uiEdits[k] = rec; else delete uiEdits[k];
      saveUiEdits(); close(); uiRefresh(); toast('Bouton modifié');
    }
  };
}
// Réaffiche la vue pour appliquer (ou retirer) les changements proprement.
function uiRefresh() {
  for (const b of document.querySelectorAll('.topnav .tab')) {
    delete b.dataset.ueDone;
    const k = b.dataset.ueKey;
    if (k && !uiEdits[k] && b.dataset.ueOrig != null) { const n = uiLabelNodes(b); if (n[0]) n[0].textContent = b.dataset.ueOrig; b.classList.remove('ue-s', 'ue-l', 'ue-xl', 'ue-clip', 'ue-roll'); }
  }
  if (typeof go === 'function' && currentView && VIEWS[currentView]) { const y = window.scrollY; go(currentView); window.scrollTo(0, y); }
  uiApplyAll();
}

/* ---------- Réglages : activer, exporter, importer, tout effacer ---------- */
function uiEditHtml() {
  const n = Object.keys(uiEdits).length;
  return `<section class="field"><h2>✎ Mode édition des boutons</h2>
    <p class="help">Renommer un bouton, changer la taille du texte, le retour à la ligne ou le texte déroulant. ${n} bouton${n > 1 ? 's' : ''} modifié${n > 1 ? 's' : ''}.</p>
    <div class="row set-stack"><button class="btn big primary" id="uiEditOn">✎ Activer le mode édition<small>toucher ensuite un bouton pour le modifier</small></button>
    <button class="btn big" id="uiEditExport" ${n ? '' : 'disabled'}>⇪ Exporter les modifications<small>fichier à envoyer à Claude</small></button><button class="btn big" id="uiEditImport">⇩ Importer<small>fichier de modifications</small></button>
    ${n ? '<button class="btn big danger" id="uiEditClear">↺ Remettre tous les boutons d’origine<small>efface les modifications</small></button>' : ''}</div>
    <input type="file" id="uiEditFile" accept=".json,application/json" hidden>
  </section>`;
}
function uiEditExportData() {
  const d = new Date();
  return { app: 'livre-de-bord', kind: 'ui-edits', version: 1, saved: d.toISOString(), sw: APP_VERSION, edits: uiEdits };
}
function bindUiEdit(main) {
  const on = $('#uiEditOn', main);
  if (!on) return;
  on.onclick = () => { buzz(); setUiEditMode(true); toast('Touchez un bouton pour le modifier'); };
  const ex = $('#uiEditExport', main);
  if (ex) ex.onclick = () => { buzz(); const d = new Date(); deliver(JSON.stringify(uiEditExportData(), null, 2), `navin-boutons-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`, 'application/json'); };
  const file = $('#uiEditFile', main);
  $('#uiEditImport', main).onclick = () => { buzz(); file.click(); };
  file.onchange = async () => {
    try {
      const data = JSON.parse(await file.files[0].text());
      const n = mergeUiEdits(data.edits || (data.data && data.data.uiEdits) || {});
      toast(`${n} bouton(s) importé(s)`); go('settings');
    } catch { toast('Fichier illisible'); }
  };
  const cl = $('#uiEditClear', main);
  if (cl) cl.onclick = () => armed(cl, 'Toucher encore : tout remettre d’origine', () => { uiEdits = {}; saveUiEdits(); location.reload(); });
}
function mergeUiEdits(list) {
  let n = 0;
  for (const [k, v] of Object.entries(list || {})) {
    if (!v || typeof v !== 'object') continue;
    if (!uiEdits[k] || (v.at || '') > (uiEdits[k].at || '')) { uiEdits[k] = v; n++; }
  }
  if (n) saveUiEdits();
  return n;
}
