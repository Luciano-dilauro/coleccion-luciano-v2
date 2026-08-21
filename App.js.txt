// --- Estado global ---
let data = { collections: [] };
let currentId = null;
let filter = 'all';
let view = 'main';
let confirmCallback = null;

// --- Persistencia ---
function load() {
  try { data = JSON.parse(localStorage.getItem('coleccion_v2')) || { collections: [] }; }
  catch { data = { collections: [] }; }
}
function save() {
  localStorage.setItem('coleccion_v2', JSON.stringify(data));
}
function getCurrent() {
  return data.collections.find(c => c.id === currentId) || null;
}

// --- Helpers ---
function uid() { return Date.now() + '-' + Math.random().toString(36).slice(2,6); }

// --- Estadísticas ---
function updateStats() {
  const total = data.collections.length;
  let complete = 0, incomplete = 0;
  for (const c of data.collections) {
    const have = c.items.filter(it => it.have).length;
    if (have === c.items.length) complete++;
    else incomplete++;
  }
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-complete').textContent = complete;
  document.getElementById('stat-incomplete').textContent = incomplete;
}

// --- Navegación ---
function showView(name) {
  view = name;
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');
  if (name === 'main') updateStats();
  if (name === 'collections') renderShelf();
}

// --- Estantería ---
function renderShelf() {
  const shelf = document.getElementById('shelf');
  const search = document.getElementById('search').value.trim().toLowerCase();
  const filtered = data.collections.filter(c =>
    search.length < 3 || c.name.toLowerCase().includes(search)
  );
  shelf.innerHTML = '';
  if (filtered.length === 0) {
    shelf.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#6b7280;">No hay colecciones que coincidan.</p>';
    return;
  }
  for (const c of filtered) {
    const have = c.items.filter(it => it.have).length;
    const pct = c.items.length ? Math.round(have / c.items.length * 100) : 0;
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <div class="cover">${c.cover || '📘'}</div>
      <div class="name">${c.name}</div>
      <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
    `;
    div.addEventListener('click', () => openDetail(c.id));
    shelf.appendChild(div);
  }
}

// --- Detalle ---
function openDetail(id) {
  currentId = id;
  const col = getCurrent();
  if (!col) return;
  document.getElementById('detail-title').textContent = col.name;
  renderDetail();
  showView('detail');
}

function renderDetail() {
  const col = getCurrent();
  if (!col) return;
  const items = col.items;
  const have = items.filter(it => it.have).length;
  const total = items.length;
  const pct = total ? Math.round(have / total * 100) : 0;
  document.getElementById('d-total').textContent = total;
  document.getElementById('d-have').textContent = have;
  document.getElementById('d-missing').textContent = total - have;
  document.getElementById('d-pct').textContent = pct + '%';

  const grid = document.getElementById('detail-grid');
  grid.innerHTML = '';
  let filtered = items;
  if (filter === 'miss') filtered = items.filter(it => !it.have);
  if (filter === 'rep') filtered = items.filter(it => it.rep > 0);
  for (const it of filtered) {
    const div = document.createElement('div');
    div.className = 'sticker';
    if (it.have) div.classList.add('have');
    if (it.rep > 0) div.classList.add('rep');
    if (it.rep > 0) div.setAttribute('data-rep', it.rep > 99 ? '99+' : it.rep);
    div.textContent = it.label;
    let timer = null;
    let long = false;

    const start = () => {
      long = false;
      timer = setTimeout(() => { long = true; handleLongPress(it); }, 500);
    };
    const end = () => {
      clearTimeout(timer);
      if (!long) handleTap(it);
    };
    div.addEventListener('touchstart', start, {passive:true});
    div.addEventListener('touchend', end, {passive:true});
    div.addEventListener('touchcancel', () => { clearTimeout(timer); });
    div.addEventListener('mousedown', start);
    div.addEventListener('mouseup', end);
    div.addEventListener('mouseleave', () => { clearTimeout(timer); });
    grid.appendChild(div);
  }
}

function handleTap(it) {
  if (!it.have) { it.have = true; it.rep = 0; save(); renderDetail(); updateStats(); return; }
  it.rep = (it.rep || 0) + 1;
  save(); renderDetail(); updateStats();
}

function handleLongPress(it) {
  if (!it.have) return;
  if (it.rep > 0) { it.rep--; save(); renderDetail(); updateStats(); return; }
  document.getElementById('confirm-msg').textContent = `¿Quitar "${it.label}" de tu colección? (no es repetida)`;
  document.getElementById('confirm-modal').style.display = 'flex';
  confirmCallback = () => {
    it.have = false;
    it.rep = 0;
    save(); renderDetail(); updateStats();
    document.getElementById('confirm-modal').style.display = 'none';
  };
}

// --- Gestión ---
function createCollection(name, cover) {
  const col = {
    id: uid(),
    name: name,
    cover: cover || null,
    items: []
  };
  // Ejemplo: 100 figuritas numeradas
  for (let i = 1; i <= 100; i++) {
    col.items.push({ label: String(i), have: false, rep: 0 });
  }
  data.collections.unshift(col);
  save();
  updateStats();
  showView('collections');
}

// --- Backup ---
function exportBackup() {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'backup-coleccion-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById('last-export').textContent = new Date().toLocaleString();
  document.getElementById('export-size').textContent = (blob.size / 1024).toFixed(1) + ' KB';
}
function importBackup(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!imported.collections) return alert('Archivo inválido.');
      if (!confirm('Reemplazar todos los datos actuales?')) return;
      data = imported;
      save();
      updateStats();
      document.getElementById('last-import').textContent = new Date().toLocaleString();
      alert('Backup importado correctamente ✅');
    } catch {
      alert('Error al leer el archivo.');
    }
  };
  reader.readAsText(file);
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  load();
  updateStats();

  // Navegación
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-view');
      if (v === 'main') showView('main');
      else if (v === 'collections') showView('collections');
      else if (v === 'manage') showView('manage');
      else if (v === 'backup') showView('backup');
      else if (v === 'create') {
        const name = prompt('Nombre de la nueva colección:');
        if (name && name.trim()) createCollection(name.trim(), null);
      } else if (v === 'edit') {
        const id = prompt('ID de la colección a editar (no implementado aún)');
      } else if (v === 'delete') {
        const id = prompt('ID de la colección a eliminar (no implementado aún)');
      }
    });
  });

  // Filtros en detalle
  document.querySelectorAll('.filter').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      filter = el.getAttribute('data-filter');
      renderDetail();
    });
  });

  // Modal
  document.getElementById('confirm-no').addEventListener('click', () => {
    document.getElementById('confirm-modal').style.display = 'none';
    confirmCallback = null;
  });
  document.getElementById('confirm-yes').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
  });

  // Backup
  document.getElementById('export-btn').addEventListener('click', exportBackup);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-input').click();
  });
  document.getElementById('import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });

  // Búsqueda en estantería
  document.getElementById('search').addEventListener('input', renderShelf);

  // Botón "atrás" en detalle
  document.querySelector('#view-detail .back').addEventListener('click', () => {
    currentId = null;
    showView('collections');
  });

  showView('main');
});
