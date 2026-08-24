let data = { collections: [] };
let currentId = null;
let filter = 'all';
let confirmCallback = null;

// --- Desactiva el pull-to-refresh en toda la app ---
document.addEventListener('touchmove', function(e) {
  if (e.target.closest('.view')) {
    e.preventDefault();
  }
}, { passive: false });

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
function uid() { return Date.now() + '-' + Math.random().toString(36).slice(2,6); }

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

function showView(name) {
  if (name === 'main') {
    document.body.classList.add('scroll-lock');
  } else {
    document.body.classList.remove('scroll-lock');
  }

  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');
  if (name === 'main') updateStats();
  if (name === 'collections') renderShelf();
}

function renderShelf() {
  const shelf = document.getElementById('shelf');
  const search = document.getElementById('search').value.trim().toLowerCase();
  const filtered = data.collections.filter(c =>
    search.length < 3 || c.name.toLowerCase().includes(search)
  );
  shelf.innerHTML = '';
  if (filtered.length === 0) {
    shelf.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#6b7a8a;padding:20px 0;">No hay colecciones</p>';
    return;
  }
  for (const c of filtered) {
    const have = c.items.filter(it => it.have).length;
    const pct = c.items.length ? Math.round(have / c.items.length * 100) : 0;
    const div = document.createElement('div');
    div.className = 'card';

    let coverContent = '';
    if (c.cover) {
      coverContent = `<img src="${c.cover}" alt="Tapa" />`;
    } else {
      coverContent = `<span class="emoji">📘</span>`;
    }

    div.innerHTML = `
      <div class="cover">${coverContent}</div>
      <div class="info">
        <div class="name">${c.name}</div>
        <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
      </div>
    `;
    div.addEventListener('click', () => openDetail(c.id));
    shelf.appendChild(div);
  }
}

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

  const coverEmoji = document.getElementById('detail-cover-emoji');
  const coverImg = document.getElementById('detail-cover-img');
  if (col.cover) {
    coverEmoji.style.display = 'none';
    coverImg.style.display = 'block';
    coverImg.src = col.cover;
  } else {
    coverEmoji.style.display = 'flex';
    coverImg.style.display = 'none';
  }

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
    if (it.shiny) div.classList.add('shiny');
    div.textContent = it.label;
    let timer = null, long = false;
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
  document.getElementById('confirm-msg').textContent = `¿Quitar "${it.label}"? (no es repetida)`;
  document.getElementById('confirm-modal').style.display = 'flex';
  confirmCallback = () => {
    it.have = false;
    it.rep = 0;
    save(); renderDetail(); updateStats();
    document.getElementById('confirm-modal').style.display = 'none';
  };
}

// --- Variables de la pantalla de creación ---
let specialSections = [];
let coverDataUrl = null;

function renderSpecialSections() {
  const container = document.getElementById('create-special-sections');
  container.innerHTML = '';
  for (const sec of specialSections) {
    const div = document.createElement('div');
    div.className = 'special-item';
    div.innerHTML = `
      <span class="info">
        <strong>${sec.name}</strong> (${sec.prefix}) → ${sec.from} a ${sec.to}
        ${sec.shinyNumbers && sec.shinyNumbers.length > 0 ? ` ⭐ ${sec.shinyNumbers.join(', ')}` : ''}
      </span>
      <button class="remove-special" data-index="${specialSections.indexOf(sec)}">✕</button>
    `;
    container.appendChild(div);
  }
  container.querySelectorAll('.remove-special').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      specialSections.splice(idx, 1);
      renderSpecialSections();
    });
  });
}

function openSpecialModal() {
  document.getElementById('special-modal').style.display = 'flex';
  document.getElementById('special-name').value = '';
  document.getElementById('special-prefix').value = '';
  document.getElementById('special-from').value = 1;
  document.getElementById('special-to').value = 20;
  document.getElementById('special-shiny').value = '';
  document.getElementById('special-name').focus();
}

function closeSpecialModal() {
  document.getElementById('special-modal').style.display = 'none';
}

function addSpecialSection() {
  const name = document.getElementById('special-name').value.trim();
  const prefix = document.getElementById('special-prefix').value.trim().toUpperCase();
  const from = parseInt(document.getElementById('special-from').value);
  const to = parseInt(document.getElementById('special-to').value);
  const shinyRaw = document.getElementById('special-shiny').value.trim();
  const shinyNumbers = shinyRaw ? shinyRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];

  if (!name) { alert('El nombre es obligatorio.'); return; }
  if (!prefix) { alert('El prefijo es obligatorio.'); return; }
  if (isNaN(from) || isNaN(to) || from > to) {
    alert('Rango inválido. Asegúrate de que "Desde" sea menor o igual que "Hasta".');
    return;
  }

  specialSections.push({ name, prefix, from, to, shinyNumbers });
  renderSpecialSections();
  closeSpecialModal();
}

function createCollectionFromForm() {
  const name = document.getElementById('create-name').value.trim();
  const from = parseInt(document.getElementById('create-from').value);
  const to = parseInt(document.getElementById('create-to').value);
  const shinyRaw = document.getElementById('create-shiny').value.trim();
  const shinyNumbers = shinyRaw ? shinyRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];

  if (!name) { alert('El nombre de la colección es obligatorio.'); return; }
  if (isNaN(from) || isNaN(to) || from > to) {
    alert('Rango general inválido. Asegúrate de que "Desde" sea menor o igual que "Hasta".');
    return;
  }

  const col = {
    id: uid(),
    name: name,
    cover: coverDataUrl || null,
    items: []
  };

  const shinySet = new Set(shinyNumbers);
  for (let i = from; i <= to; i++) {
    col.items.push({
      label: String(i),
      have: false,
      rep: 0,
      special: false,
      shiny: shinySet.has(i)
    });
  }

  for (const sec of specialSections) {
    const shinySetSpecial = new Set(sec.shinyNumbers || []);
    for (let i = sec.from; i <= sec.to; i++) {
      col.items.push({
        label: `${sec.prefix}${i}`,
        have: false,
        rep: 0,
        special: true,
        section: sec.name,
        shiny: shinySetSpecial.has(i)
      });
    }
  }

  data.collections.unshift(col);
  save();
  updateStats();
  showView('collections');

  document.getElementById('create-name').value = '';
  document.getElementById('create-shiny').value = '';
  specialSections = [];
  coverDataUrl = null;
  renderSpecialSections();
  document.getElementById('create-cover-preview').innerHTML = '';
  document.getElementById('create-cover-clear').style.display = 'none';
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
  load();
  updateStats();

  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', () => {
      const v = el.getAttribute('data-view');
      if (v === 'main') showView('main');
      else if (v === 'collections') showView('collections');
      else if (v === 'manage') showView('manage');
      else if (v === 'backup') showView('backup');
      else if (v === 'create') {
        showView('create');
      } else if (v === 'edit') {
        alert('Función en desarrollo.');
      } else if (v === 'delete') {
        alert('Función en desarrollo.');
      }
    });
  });

  document.querySelectorAll('.filter').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.filter').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      filter = el.getAttribute('data-filter');
      renderDetail();
    });
  });

  document.getElementById('confirm-no').addEventListener('click', () => {
    document.getElementById('confirm-modal').style.display = 'none';
    confirmCallback = null;
  });
  document.getElementById('confirm-yes').addEventListener('click', () => {
    if (confirmCallback) confirmCallback();
  });

  document.getElementById('export-btn').addEventListener('click', exportBackup);
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-input').click();
  });
  document.getElementById('import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importBackup(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('search').addEventListener('input', renderShelf);

  document.getElementById('create-add-special').addEventListener('click', openSpecialModal);
  document.getElementById('special-cancel').addEventListener('click', closeSpecialModal);
  document.getElementById('special-add').addEventListener('click', addSpecialSection);
  document.getElementById('special-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSpecialModal();
  });

  document.getElementById('create-cover-btn').addEventListener('click', () => {
    document.getElementById('create-cover-input').click();
  });
  document.getElementById('create-cover-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      coverDataUrl = ev.target.result;
      const preview = document.getElementById('create-cover-preview');
      preview.innerHTML = `<img src="${coverDataUrl}" alt="Tapa" />`;
      document.getElementById('create-cover-clear').style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  });
  document.getElementById('create-cover-clear').addEventListener('click', () => {
    coverDataUrl = null;
    document.getElementById('create-cover-preview').innerHTML = '';
    document.getElementById('create-cover-clear').style.display = 'none';
  });
  document.getElementById('create-save').addEventListener('click', createCollectionFromForm);
  document.querySelector('#view-create .back-btn').addEventListener('click', () => {
    showView('manage');
  });

  showView('main');
});

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
    } catch { alert('Error al leer el archivo.'); }
  };
  reader.readAsText(file);
}
