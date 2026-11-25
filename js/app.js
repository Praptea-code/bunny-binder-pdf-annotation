'use strict';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

/* ---------- helpers ---------- */
const $ = s => document.querySelector(s);
const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e };
const icon = id => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('class', 'ico'); s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use'); u.setAttribute('href', '#' + id); s.append(u); return s;
};
const uid = () => Math.random().toString(36).slice(2, 10);
const C = [['#ffb3cf', '#e0457b'], ['#fff2a8', '#c99700'], ['#b8f0d4', '#1f9d6a'], ['#bfe3ff', '#2f7fd0'], ['#dcc8ff', '#7a4fd1']]; // [soft, deep]
let toastT;
const toast = m => { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600) };
const ask = (msg, val) => new Promise(r => {
  const d = $('#dlg'), i = $('#dlgIn'); $('#dlgMsg').textContent = msg; i.hidden = val == null; i.value = val || '';
  d.returnValue = ''; d.showModal(); if (val != null) i.focus();
  d.onclose = () => r(d.returnValue === 'ok' ? (val == null ? true : i.value.trim()) : null);
});

/* ---------- storage (IndexedDB) ---------- */
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open('bunny-binder', 1);
  r.onupgradeneeded = () => { r.result.createObjectStore('docs', { keyPath: 'id' }); r.result.createObjectStore('ann', { keyPath: 'id' }) };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
const tx = async (s, m, f) => { const d = await dbp; return new Promise((res, rej) => { const t = d.transaction(s, m), q = f(t.objectStore(s)); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error) }) };
const put = (s, v) => tx(s, 'readwrite', o => o.put(v));
const get = (s, k) => tx(s, 'readonly', o => o.get(k));
const all = s => tx(s, 'readonly', o => o.getAll());
const del = (s, k) => tx(s, 'readwrite', o => o.delete(k));

/* ---------- library ---------- */
let docs = [], onlyFav = false, tagF = null;
const show = v => { $('#libView').hidden = v !== 'lib'; $('#readView').hidden = v !== 'read' };

async function loadLib() { docs = await all('docs'); renderLib() }

async function addFiles(files) {
  for (const f of files) {
    const isPdf = f.type === 'application/pdf' || /\.(pdf)$/i.test(f.name);
    if (!isPdf) { toast('Only PDF files, please'); continue }
    toast('Adding ' + f.name + '…');
    const d = { id: uid(), name: f.name.replace(/\.pdf$/i, ''), blob: f, size: f.size, added: Date.now(), opened: 0, fav: false, tags: [] };
    try {
      if (f.size > 50 * 1024 * 1024) { toast(f.name + ' is too large (max 50MB)'); continue }
      const p = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise; d.pages = p.numPages;
      const pg = await p.getPage(1), v0 = pg.getViewport({ scale: 1 }), v = pg.getViewport({ scale: 300 / v0.width }), c = document.createElement('canvas');
      c.width = v.width; c.height = v.height;
      await pg.render({ canvasContext: c.getContext('2d'), viewport: v }).promise; d.thumb = c.toDataURL('image/jpeg', .7);
    } catch (e) { console.error(e); toast("Couldn't read " + f.name); continue }
    try { await put('docs', d) } catch (e) { if (e.name === 'QuotaExceededError') toast('Storage full: ' + f.name + ' cannot be saved'); else toast('Error saving ' + f.name) }
  }
  loadLib();
}

function renderLib() {
  const q = $('#q').value.toLowerCase(), sort = $('#sort').value;
  const tags = [...new Set(docs.flatMap(d => d.tags))].sort();
  if (tagF && !tags.includes(tagF)) tagF = null;
  const tr = $('#tags'); tr.textContent = '';
  if (tags.length) [null, ...tags].forEach(t => { const b = h('button', 'chip' + (t === tagF ? ' on' : ''), t || 'All tags'); b.onclick = () => { tagF = t; renderLib() }; tr.append(b) });
  const list = docs.filter(d => (!onlyFav || d.fav) && (!tagF || d.tags.includes(tagF)) && (d.name.toLowerCase().includes(q) || d.tags.some(t => t.toLowerCase().includes(q))))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'added' ? b.added - a.added : (b.opened || b.added) - (a.opened || a.added));
  const g = $('#grid'); g.textContent = ''; list.forEach(d => g.append(card(d)));
  $('#empty').hidden = list.length > 0;
  $('#empty').innerHTML = docs.length ? 'Nothing matches that search.' : 'No PDFs yet.<br>Drop files anywhere on this page or press “Add PDFs”.';
}

function card(d) {
  const c = h('article', 'card'), th = h('div', 'thumb');
  if (d.thumb) th.style.backgroundImage = `url(${d.thumb})`;
  th.onclick = () => openDoc(d.id);
  const s = h('button', 'star' + (d.fav ? ' on' : ''), '★'); s.title = 'Favorite';
  s.onclick = async e => { e.stopPropagation(); d.fav = !d.fav; await put('docs', d); renderLib() }; th.append(s);
  const n = h('h3', '', d.name); n.onclick = () => openDoc(d.id);
  const tg = h('div', 'tg'); d.tags.forEach(t => tg.append(h('span', 'tag', t)));
  const a = h('div', 'acts');
  const bt = (l, f) => { const b = h('button', 'ghost', l); b.onclick = f; a.append(b) };
  bt('Rename', async () => { const v = await ask('Rename this PDF', d.name); if (v) { d.name = v; await put('docs', d); renderLib() } });
  bt('Tags', async () => { const v = await ask('Tags, separated by commas', d.tags.join(', ')); if (v !== null) { d.tags = [...new Set(v.split(',').map(t => t.trim()).filter(Boolean))]; await put('docs', d); renderLib() } });
  bt('Delete', async () => { if (await ask(`Delete “${d.name}” and all its notes?`, null)) { await del('docs', d.id); await del('ann', d.id); loadLib() } });
  c.append(th, n, h('p', 'meta', `${d.pages || '?'} pages, ${(d.size / 1048576).toFixed(1)} MB`), tg, a);
  return c;
}

$('#q').oninput = renderLib; $('#sort').onchange = renderLib;
$('#favBtn').onclick = e => { onlyFav = !onlyFav; e.currentTarget.classList.toggle('on', onlyFav); renderLib() };
$('#file').onchange = e => { addFiles([...e.target.files]); e.target.value = '' };
addEventListener('dragover', e => { e.preventDefault(); if (!$('#libView').hidden) document.body.classList.add('drop') });
addEventListener('dragleave', e => { if (!e.relatedTarget) document.body.classList.remove('drop') });
addEventListener('drop', e => { e.preventDefault(); document.body.classList.remove('drop'); if (!$('#libView').hidden) addFiles([...e.dataTransfer.files]) });

/* ---------- reader ---------- */
let cur, pdf, anns = [], sizes = [], tool = 'select', ci = 0, scale = 1.2, io, saveT, hlDrag;

async function openDoc(id) {
  cur = docs.find(x => x.id === id); cur.opened = Date.now(); put('docs', cur);
  show('read'); $('#title').textContent = cur.name; $('#stage').textContent = 'Opening…';
  const rec = await get('ann', id); anns = rec ? rec.list : [];
  try {
    pdf = await pdfjsLib.getDocument({ data: await cur.blob.arrayBuffer() }).promise;
    sizes = []; for (let i = 1; i <= pdf.numPages; i++) { const v = (await pdf.getPage(i)).getViewport({ scale: 1 }); sizes.push([v.width, v.height]) }
  } catch (e) { toast("Couldn't open this PDF"); return closeDoc() }
  scale = Math.max(.6, Math.min(1.6, ($('#stage').clientWidth - 32) / sizes[0][0]));
  build(); renderSide();
}

function closeDoc() {
  clearTimeout(saveT); if (cur) put('ann', { id: cur.id, list: anns });
  $('#pop').hidden = true; $('#side').classList.remove('open'); pdf && pdf.destroy(); pdf = null;
  show('lib'); loadLib();
}

function build() {
  const st = $('#stage'); st.textContent = ''; st.style.setProperty('--s', scale); $('#zl').textContent = Math.round(scale * 100) + '%';
  io && io.disconnect();
  io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !e.target._r) { e.target._r = 1; paint(e.target) } }), { root: st, rootMargin: '700px' });
  sizes.forEach(([w, hh], i) => {
    const p = h('div', 'page'); p.dataset.i = i; p.style.width = w * scale + 'px'; p.style.height = hh * scale + 'px';
    p.innerHTML = '<canvas></canvas><div class="hl"></div><div class="tl textLayer"></div><svg class="ink" viewBox="0 0 1 1" preserveAspectRatio="none"></svg><div class="an"></div>';
    p.onpointerdown = e => down(e, p);
    st.append(p); io.observe(p); draw(i);
  });
}

async function paint(p) {
  const pg = await pdf.getPage(+p.dataset.i + 1), v = pg.getViewport({ scale }), c = p.querySelector('canvas'), r = devicePixelRatio || 1;
  c.width = v.width * r; c.height = v.height * r; c.style.width = v.width + 'px'; c.style.height = v.height + 'px';
  pg.render({ canvasContext: c.getContext('2d'), viewport: v, transform: r !== 1 ? [r, 0, 0, r, 0, 0] : null });
  const tl = p.querySelector('.tl'); tl.style.setProperty('--scale-factor', scale);
  pdfjsLib.renderTextLayer({ textContentSource: await pg.getTextContent(), container: tl, viewport: v, textDivs: [] });
}

/* tools */
function setTool(t) { tool = t; $('#stage').dataset.tool = t; document.querySelectorAll('#tools button').forEach(b => b.classList.toggle('on', b.dataset.t === t)) }
document.querySelectorAll('#tools button').forEach(b => b.onclick = () => setTool(b.dataset.t));
C.forEach((c, k) => { const b = h('button'); b.style.background = c[0]; b.title = 'Color'; b.onclick = () => { ci = k; [...$('#sw').children].forEach((x, j) => x.classList.toggle('on', j === k)) }; $('#sw').append(b) });
$('#sw').children[0].classList.add('on'); setTool('select');
addEventListener('keydown', e => {
  if ($('#readView').hidden || e.target.closest('input,textarea,[contenteditable]') || e.metaKey || e.ctrlKey) return;
  const k = { v: 'select', h: 'hl', n: 'note', t: 'text', p: 'pen', e: 'erase' }[e.key.toLowerCase()]; if (k) { e.preventDefault(); setTool(k) }
  if (e.key === 'Escape') setTool('select');
});

/* annotation model: coordinates are fractions of the page, so zoom never breaks them */
const pos = (e, p) => { const r = p.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] };
const ay = a => a.rects ? a.rects[0].y : a.rect ? a.rect.y : a.pts ? a.pts[0][1] : a.y;
function save() { clearTimeout(saveT); saveT = setTimeout(() => put('ann', { id: cur.id, list: anns }), 300) }
function add(a) {
  a.id = uid(); a.c = ci; anns.push(a); save(); draw(a.page); renderSide(); setTool('select');
  const el = $(`[data-id="${a.id}"] textarea, [data-id="${a.id}"] .tx`);
  if (el) setTimeout(() => el.focus(), 0);
}
function rm(a) { anns = anns.filter(x => x !== a); save(); draw(a.page); renderSide() }

function down(e, p) {
  if (e.target.closest('.n,.t,.bub')) return;
  const i = +p.dataset.i, [x, y] = pos(e, p);
  if (tool === 'note' || tool === 'text') {
    e.preventDefault(); e.stopPropagation();
    add({ type: tool, page: i, x, y, text: '' });
  }
  else if (tool === 'hl') hlDrag = { p, i, x, y, cx: e.clientX, cy: e.clientY };
  else if (tool === 'pen') stroke(e, p, i);
  else if (tool === 'erase') { const a = anns.find(a => a.page === i && (a.type === 'pen' ? a.pts.some(q => Math.hypot(q[0] - x, q[1] - y) < .015) : a.type === 'hl' && hlAt(i, x, y) === a)); if (a) rm(a) }
}
const hlAt = (i, x, y) => [...anns].reverse().find(a => a.type === 'hl' && a.page === i && a.rects.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h));

/* pen */
const D = pts => pts.map((q, k) => (k ? 'L' : 'M') + q[0] + ' ' + q[1]).join('');
function pathEl(a) { const e = document.createElementNS('http://www.w3.org/2000/svg', 'path'); e.setAttribute('d', D(a.pts)); e.setAttribute('stroke', C[a.c][1]); return e }
function stroke(e, p, i) {
  const a = { id: uid(), type: 'pen', page: i, c: ci, pts: [pos(e, p)] }; anns.push(a);
  const el = pathEl(a); p.querySelector('.ink').append(el);
  const mv = ev => { a.pts.push(pos(ev, p)); el.setAttribute('d', D(a.pts)) };
  const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); save(); renderSide() };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}

/* highlights and comments from text selections or dragged regions */
$('#stage').addEventListener('pointerup', e => {
  if (tool !== 'hl') return;
  setTimeout(() => {
    const s = getSelection();
    if (s.rangeCount && !s.isCollapsed) { hlDrag = null; makeHl(e); return }
    const d = hlDrag; hlDrag = null;
    if (!d || Math.hypot(e.clientX - d.cx, e.clientY - d.cy) < 6) return;
    const [x, y] = pos(e, d.p), rect = { x: Math.min(d.x, x), y: Math.min(d.y, y), w: Math.abs(x - d.x), h: Math.abs(y - d.y) };
    if (rect.w < .01 || rect.h < .005) return;
    pop({ id: uid(), type: 'comment', page: d.i, rect, text: '', comment: '', time: Date.now(), c: ci }, e, true);
  }, 0);
});
function makeHl(e) {
  const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
  const rs = [...s.getRangeAt(0).getClientRects()].filter(r => r.width > 2 && r.height > 2), txt = s.toString().replace(/\s+/g, ' ').trim(), made = [];
  [...$('#stage').children].forEach((p, i) => {
    const pr = p.getBoundingClientRect();
    const m = rs.filter(r => { const cy = r.top + r.height / 2; return cy > pr.top && cy < pr.bottom && r.width < pr.width * .97 })
      .map(r => ({ x: (r.left - pr.left) / pr.width, y: (r.top - pr.top) / pr.height, w: r.width / pr.width, h: r.height / pr.height }));
    if (m.length) made.push({ id: uid(), type: 'hl', page: i, rects: m, c: ci, text: txt });
  });
  if (!made.length) return;
  anns.push(...made); s.removeAllRanges(); save(); made.forEach(a => draw(a.page)); renderSide();
  const a = made[0];
  pop({ id: uid(), type: 'comment', page: a.page, rects: a.rects, text: txt, comment: '', time: Date.now(), c: ci }, e, true);
}

/* draw one page's annotations */
function draw(i) {
  const p = $('#stage').children[i]; if (!p || !p.querySelector) return;
  const hl = p.querySelector('.hl'), ink = p.querySelector('.ink'), an = p.querySelector('.an'); hl.textContent = ink.textContent = an.textContent = '';
  anns.filter(a => a.page === i).forEach(a => {
    if (a.type === 'hl' || a.type === 'comment') {
      const rects = a.rects || (a.rect ? [a.rect] : []);
      rects.forEach(r => {
        const d = h('i', a.type === 'comment' ? 'cm' : '');
        d.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%;background:${C[a.c][0]}`;
        if (a.type === 'comment') d.style.borderBottom = `2px dashed ${C[a.c][1]}`;
        hl.append(d);
      });
      if (a.type === 'comment') {
        const r = rects[0]; if (!r) return;
        const b = h('button', 'bub'); b.append(icon('i-comment'));
        b.title = 'Open comment'; b.setAttribute('aria-label', 'Open comment');
        b.style.left = (r.x + r.w) * 100 + '%'; b.style.top = r.y * 100 + '%';
        b.onpointerdown = e => e.stopPropagation();
        b.onclick = e => { e.stopPropagation(); pop(a, e) };
        an.append(b);
      }
    } else if (a.type === 'pen') ink.append(pathEl(a));
    else an.append(a.type === 'note' ? noteEl(a) : textEl(a));
  });
}
function drag(grip, el, a) {
  grip.onpointerdown = e => {
    e.preventDefault(); const r = el.closest('.page').getBoundingClientRect(), ox = e.clientX - (a.x * r.width + r.left), oy = e.clientY - (a.y * r.height + r.top);
    const mv = ev => { a.x = Math.min(.97, Math.max(0, (ev.clientX - ox - r.left) / r.width)); a.y = Math.min(.97, Math.max(0, (ev.clientY - oy - r.top) / r.height)); el.style.left = a.x * 100 + '%'; el.style.top = a.y * 100 + '%' };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); save() };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  };
}
function noteEl(a) {
  const n = h('div', 'n'); n.dataset.id = a.id; n.style.cssText = `left:${a.x * 100}%;top:${a.y * 100}%;background:${C[a.c][0]}`;
  const stop = e => e.stopPropagation();
  ['pointerdown', 'mousedown', 'click', 'keydown'].forEach(t => n.addEventListener(t, stop));
  const hd = h('div', 'nh'), x = h('button', '', '×'); x.title = 'Delete note'; x.onclick = () => rm(a);
  const pin = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); pin.setAttribute('class', 'ico'); pin.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-note'); pin.append(use);
  hd.append(pin, x); drag(hd, n, a);
  const t = h('textarea'); t.value = a.text; t.placeholder = 'Write a note…'; t.setAttribute('aria-label', 'Note text');
  t.oninput = () => { a.text = t.value; save() };
  t.onblur = () => { a.text = t.value; save() };
  n.append(hd, t); return n;
}
function textEl(a) {
  const t = h('div', 't'); t.dataset.id = a.id; t.style.cssText = `left:${a.x * 100}%;top:${a.y * 100}%;color:${C[a.c][1]}`;
  const g = h('span', 'g', '⠿'), x = h('span', 'tx'), del = h('button', 'x', '×'); x.contentEditable = 'true'; x.textContent = a.text; x.spellcheck = false;
  x.oninput = () => { a.text = x.textContent; save(); renderSide() }; x.onblur = () => { if (!a.text.trim()) rm(a) };
  del.onclick = () => rm(a); drag(g, t, a); t.append(g, x, del); return t;
}

/* comment popover */
function pop(a, e, isNew = false) {
  const o = $('#pop'), w = { ...a };
  o.hidden = false;
  o.style.left = Math.max(8, Math.min(e.clientX, innerWidth - 276)) + 'px';
  o.style.top = Math.max(8, Math.min(e.clientY + 14, innerHeight - 250)) + 'px';
  $('#pq').textContent = w.text ? '“' + w.text.slice(0, 110) + (w.text.length > 110 ? '…' : '') + '”' : 'Selected region';
  const t = $('#pt'); t.value = w.comment || '';
  $('#pDelete').hidden = isNew;
  $('#pc').replaceChildren(...C.map((c, k) => {
    const b = h('button', k === w.c ? 'on' : ''); b.style.background = c[0]; b.title = 'Comment color';
    b.onclick = () => { w.c = k; [...$('#pc').children].forEach((x, j) => x.classList.toggle('on', j === k)) }; return b;
  }));
  $('#pSave').onclick = () => {
    const v = t.value.trim(); if (!v) { toast('Write a comment first'); return }
    w.comment = v; w.time = w.time || Date.now(); Object.assign(a, w);
    if (isNew) anns.push(a);
    o.hidden = true; save(); draw(a.page); renderSide();
  };
  $('#pCancel').onclick = () => { o.hidden = true };
  $('#pDelete').onclick = () => { o.hidden = true; rm(a) };
  setTimeout(() => t.focus(), 0);
}
addEventListener('pointerdown', e => { if (!e.target.closest('#pop,.bub')) $('#pop').hidden = true }, true);

/* side panel: only comments */
function renderSide() {
  const s = $('#side'); s.textContent = '';
  const comments = anns.filter(a => a.type === 'comment' && a.comment).sort((a, b) => a.page - b.page || ay(a) - ay(b));
  s.append(h('h2', '', `Comments (${comments.length})`));
  if (!comments.length) s.append(h('p', 'hint', 'No comments yet. Select text or drag a region with the highlight tool, then add a comment.'));
  comments.forEach(a => {
    const it = h('button', 'item');
    it.append(h('b', '', 'p.' + (a.page + 1)), icon('i-comment'));
    if (a.text) it.append(h('q', '', a.text.slice(0, 90)));
    it.append(h('em', '', a.comment));
    it.append(h('small', '', new Date(a.time || Date.now()).toLocaleString()));
    it.onclick = () => {
      const p = $('#stage').children[a.page];
      if (p) {
        $('#stage').scrollTo({ top: p.offsetTop + ay(a) * p.offsetHeight - 90, behavior: 'smooth' });
        flashSpot(a, p);
      }
      if (innerWidth < 700) s.classList.remove('open');
    };
    s.append(it);
  });
}
function flashSpot(a, p) {
  const r = (a.rects || (a.rect ? [a.rect] : []))[0]; if (!r) return;
  const f = h('i', 'flash-spot');
  f.style.cssText = `left:${r.x * 100}%;top:${r.y * 100}%;width:${r.w * 100}%;height:${r.h * 100}%`;
  p.querySelector('.hl').append(f); setTimeout(() => f.remove(), 1600);
}
$('#sideBtn').onclick = () => $('#side').classList.toggle('open');

/* nav + zoom */
$('#back').onclick = closeDoc;
$('#stage').onscroll = () => { const st = $('#stage'), y = st.scrollTop + st.clientHeight / 3; let k = 0; [...st.children].forEach((p, i) => { if (p.offsetTop <= y) k = i }); $('#pg').textContent = `${k + 1} / ${sizes.length}` };
$('#pg').onclick = async () => { const v = parseInt(await ask('Go to page (1 to ' + sizes.length + ')', ''), 10); if (v >= 1 && v <= sizes.length) $('#stage').scrollTo({ top: $('#stage').children[v - 1].offsetTop - 10 }) };
function zoom(d) {
  const st = $('#stage'), k = Math.max(0, [...st.children].findIndex(p => p.offsetTop + p.offsetHeight > st.scrollTop + 10));
  scale = Math.min(3, Math.max(.4, +(scale + d).toFixed(2))); build(); st.scrollTop = st.children[k].offsetTop - 10;
}
$('#zin').onclick = () => zoom(.2); $('#zout').onclick = () => zoom(-.2);

loadLib();