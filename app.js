let data = { collections: [] };
let currentId = null;
let filter = 'all';
let confirmCallback = null;
let specialSections = [];
let coverDataUrl = null;

const LS_KEY = 'coleccion_v2';
const LAST_KEY = 'ultima_coleccion';

function load() {
    try { data = JSON.parse(localStorage.getItem(LS_KEY)) || { collections: [] }; }
    catch { data = { collections: [] }; }
}
function save() {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
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
    document.getElementById('statTotal').textContent = total;
    document.getElementById('statComplete').textContent = complete;
    document.getElementById('statIncomplete').textContent = incomplete;
}

function showView(name) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById('view-' + name);
    if (target) target.classList.add('active');

    if (name !== 'detail') {
        const titles = {
            main: 'Principal',
            collections: 'Mis colecciones',
            manage: 'Gestión',
            delete: 'Eliminar colección',
            create: 'Crear colección',
            backup: 'Backup',
        };
        document.getElementById('headerTitle').textContent = titles[name] || 'Colección';
    }

    const backBtn = document.getElementById('backBtn');
    if (name === 'main') {
        backBtn.classList.add('hidden');
    } else {
        backBtn.classList.remove('hidden');
    }

    if (name === 'main') updateStats();
    if (name === 'collections') renderShelf();
    if (name === 'delete') renderDeleteShelf();
}

function goMain() {
    currentId = null;
    localStorage.removeItem(LAST_KEY);
    showView('main');
}

function goDetail(id) {
    currentId = id;
    const col = getCurrent();
    if (!col) return;
    document.getElementById('headerTitle').textContent = col.name;
    renderDetail();
    showView('detail');
    localStorage.setItem(LAST_KEY, id);
}

function renderShelf() {
    const shelf = document.getElementById('shelf');
    const search = document.getElementById('searchInput').value.trim().toLowerCase();
    const filtered = data.collections.filter(c =>
        search.length < 3 || c.name.toLowerCase().includes(search)
    );
    shelf.innerHTML = '';
    if (filtered.length === 0) {
        shelf.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#6b7280;padding:20px 0;">No hay colecciones</p>';
        return;
    }
    for (const c of filtered) {
        const have = c.items.filter(it => it.have).length;
        const pct = c.items.length ? Math.round(have / c.items.length * 100) : 0;
        const div = document.createElement('div');
        div.className = 'shelf-card';
        let coverHtml = '📘';
        if (c.cover) coverHtml = `<img src="${c.cover}" alt="Tapa" />`;
        div.innerHTML = `
            <div class="cover">${coverHtml}</div>
            <div class="info">
                <div class="name">${c.name}</div>
                <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
            </div>
        `;
        div.addEventListener('click', () => goDetail(c.id));
        shelf.appendChild(div);
    }
}

function renderDeleteShelf() {
    const shelf = document.getElementById('deleteShelf');
    shelf.innerHTML = '';
    if (data.collections.length === 0) {
        shelf.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#6b7280;padding:20px 0;">No hay colecciones para eliminar</p>';
        return;
    }
    for (const c of data.collections) {
        const have = c.items.filter(it => it.have).length;
        const pct = c.items.length ? Math.round(have / c.items.length * 100) : 0;
        const div = document.createElement('div');
        div.className = 'shelf-card delete-card';
        let coverHtml = '📘';
        if (c.cover) coverHtml = `<img src="${c.cover}" alt="Tapa" />`;
        div.innerHTML = `
            <div class="cover">${coverHtml}</div>
            <div class="info">
                <div class="name">${c.name}</div>
                <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
            </div>
        `;
        div.addEventListener('click', () => confirmDeleteCollection(c.id));
        shelf.appendChild(div);
    }
}

function confirmDeleteCollection(id) {
    const col = data.collections.find(c => c.id === id);
    if (!col) return;
    document.getElementById('confirmMsg').textContent = `¿Eliminar "${col.name}"? Esta acción no se puede deshacer.`;
    document.getElementById('confirmModal').classList.remove('hidden');
    confirmCallback = () => {
        data.collections = data.collections.filter(c => c.id !== id);
        if (currentId === id) {
            currentId = null;
            localStorage.removeItem(LAST_KEY);
        }
        save();
        updateStats();
        renderShelf();
        renderDeleteShelf();
        document.getElementById('confirmModal').classList.add('hidden');
        // Si la vista de eliminar está activa, recargar
        if (document.getElementById('view-delete').classList.contains('active')) {
            renderDeleteShelf();
        }
    };
}

function renderDetail() {
    const col = getCurrent();
    if (!col) return;
    const items = col.items;
    const have = items.filter(it => it.have).length;
    const total = items.length;
    const pct = total ? Math.round(have / total * 100) : 0;

    document.getElementById('dTotal').textContent = total;
    document.getElementById('dHave').textContent = have;
    document.getElementById('dMissing').textContent = total - have;
    document.getElementById('dPct').textContent = pct + '%';
    document.getElementById('progressFill').style.width = pct + '%';

    const coverEl = document.getElementById('detailCover');
    if (col.cover) {
        coverEl.innerHTML = `<img src="${col.cover}" alt="Tapa" />`;
    } else {
        coverEl.textContent = '📘';
    }

    const grid = document.getElementById('detailGrid');
    grid.innerHTML = '';

    const sectionsMap = new Map();
    for (const it of items) {
        const sectionId = it.sectionId || 'default';
        if (!sectionsMap.has(sectionId)) {
            const section = col.sections.find(s => s.id === sectionId);
            sectionsMap.set(sectionId, {
                name: section ? section.name : 'General',
                items: []
            });
        }
        sectionsMap.get(sectionId).items.push(it);
    }

    for (const [sectionId, sectionData] of sectionsMap) {
        let filteredItems = sectionData.items;
        if (filter === 'miss') filteredItems = filteredItems.filter(it => !it.have);
        if (filter === 'rep') filteredItems = filteredItems.filter(it => it.rep > 0);

        if (filteredItems.length === 0) continue;

        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'section-title';
        sectionTitle.textContent = sectionData.name;
        grid.appendChild(sectionTitle);

        const sectionGrid = document.createElement('div');
        sectionGrid.className = 'grid-4';

        for (const it of filteredItems) {
            const div = document.createElement('div');
            div.className = 'sticker';
            if (it.have) div.classList.add('have');
            if (it.rep > 0) {
                div.classList.add('rep');
                div.setAttribute('data-rep', it.rep > 99 ? '99+' : it.rep);
            }
            if (it.shiny) div.classList.add('shiny');
            div.textContent = it.label;

            let startX = 0, startY = 0, isSwiping = false;
            let longPressTimer = null;
            let longPressFired = false;

            const onTouchStart = (e) => {
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                isSwiping = false;
                longPressFired = false;
                longPressTimer = setTimeout(() => {
                    longPressFired = true;
                    handleLongPress(it);
                }, 500);
            };

            const onTouchMove = (e) => {
                if (!startX || !startY) return;
                const touch = e.touches[0];
                const deltaX = Math.abs(touch.clientX - startX);
                const deltaY = Math.abs(touch.clientY - startY);
                if (deltaX > 10 || deltaY > 10) {
                    isSwiping = true;
                    clearTimeout(longPressTimer);
                }
            };

            const onTouchEnd = () => {
                clearTimeout(longPressTimer);
                if (!isSwiping && !longPressFired) {
                    handleTap(it);
                }
            };

            div.addEventListener('touchstart', onTouchStart, { passive: true });
            div.addEventListener('touchmove', onTouchMove, { passive: true });
            div.addEventListener('touchend', onTouchEnd, { passive: true });

            let mouseDown = false;
            div.addEventListener('mousedown', () => { mouseDown = true; });
            div.addEventListener('mouseup', () => {
                if (mouseDown) {
                    mouseDown = false;
                    handleTap(it);
                }
            });
            div.addEventListener('mouseleave', () => { mouseDown = false; });

            sectionGrid.appendChild(div);
        }

        grid.appendChild(sectionGrid);
    }
}

function handleTap(it) {
    if (!it.have) {
        it.have = true;
        it.rep = 0;
        save();
        renderDetail();
        updateStats();
        return;
    }
    it.rep = (it.rep || 0) + 1;
    save();
    renderDetail();
    updateStats();
}

function handleLongPress(it) {
    if (!it.have) return;
    if (it.rep > 0) {
        it.rep--;
        save();
        renderDetail();
        updateStats();
        return;
    }
    document.getElementById('confirmMsg').textContent = `¿Quitar "${it.label}"? (no es repetida)`;
    document.getElementById('confirmModal').classList.remove('hidden');
    confirmCallback = () => {
        it.have = false;
        it.rep = 0;
        save();
        renderDetail();
        updateStats();
        document.getElementById('confirmModal').classList.add('hidden');
    };
}

document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        filter = el.getAttribute('data-filter');
        renderDetail();
    });
});

function renderSpecialSections() {
    const container = document.getElementById('specialList');
    container.innerHTML = '';
    for (const sec of specialSections) {
        const div = document.createElement('div');
        div.className = 'special-item';
        div.innerHTML = `
            <span><strong>${sec.name}</strong> (${sec.prefix}) → ${sec.from} a ${sec.to}</span>
            <button class="remove" data-idx="${specialSections.indexOf(sec)}">✕</button>
        `;
        container.appendChild(div);
    }
    container.querySelectorAll('.remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            specialSections.splice(idx, 1);
            renderSpecialSections();
        });
    });
}

function createCollection() {
    const name = document.getElementById('createName').value.trim();
    const from = parseInt(document.getElementById('numFrom').value);
    const to = parseInt(document.getElementById('numTo').value);
    const shinyRaw = document.getElementById('shinyInput').value.trim();
    const shinyNumbers = shinyRaw ? shinyRaw.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n)) : [];

    if (!name) { alert('El nombre es obligatorio.'); return; }
    if (isNaN(from) || isNaN(to) || from > to) {
        alert('Rango inválido. Asegúrate de que "Desde" sea menor o igual que "Hasta".');
        return;
    }

    const col = {
        id: uid(),
        name: name,
        cover: coverDataUrl || null,
        items: [],
        sections: []
    };

    const generalSection = {
        id: uid('sec'),
        name: 'General',
        format: 'num',
        prefix: '',
        ownNumbering: false,
        specials: []
    };
    col.sections.push(generalSection);

    const shinySet = new Set(shinyNumbers);
    for (let i = from; i <= to; i++) {
        col.items.push({
            id: uid('it'),
            sectionId: generalSection.id,
            label: String(i),
            have: false,
            rep: 0,
            special: false,
            shiny: shinySet.has(i),
            key: `num:${i}`
        });
    }

    for (const sec of specialSections) {
        const section = {
            id: uid('sec'),
            name: sec.name,
            format: 'alfa',
            prefix: sec.prefix,
            ownNumbering: true,
            specials: []
        };
        col.sections.push(section);

        const shinySetSpecial = new Set(sec.shinyNumbers || []);
        for (let i = sec.from; i <= sec.to; i++) {
            col.items.push({
                id: uid('it'),
                sectionId: section.id,
                label: `${sec.prefix}${i}`,
                have: false,
                rep: 0,
                special: true,
                section: sec.name,
                shiny: shinySetSpecial.has(i),
                key: `alfa:${sec.prefix}:${i}`
            });
        }
    }

    data.collections.unshift(col);
    save();
    updateStats();
    goMain();
    renderShelf();

    document.getElementById('createName').value = '';
    document.getElementById('shinyInput').value = '';
    specialSections = [];
    coverDataUrl = null;
    renderSpecialSections();
    document.getElementById('coverPreview').innerHTML = '📘';
    document.getElementById('coverClearBtn').style.display = 'none';
}

function openSpecialModal() {
    document.getElementById('specialModal').classList.remove('hidden');
    document.getElementById('specialName').value = '';
    document.getElementById('specialPrefix').value = '';
    document.getElementById('specialFrom').value = 1;
    document.getElementById('specialTo').value = 20;
    document.getElementById('specialShiny').value = '';
}

function closeSpecialModal() {
    document.getElementById('specialModal').classList.add('hidden');
}

function addSpecialSection() {
    const name = document.getElementById('specialName').value.trim();
    const prefix = document.getElementById('specialPrefix').value.trim().toUpperCase();
    const from = parseInt(document.getElementById('specialFrom').value);
    const to = parseInt(document.getElementById('specialTo').value);
    const shinyRaw = document.getElementById('specialShiny').value.trim();
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

function exportBackup() {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-coleccion-' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    document.getElementById('lastExport').textContent = new Date().toLocaleString();
    document.getElementById('exportSize').textContent = (blob.size / 1024).toFixed(1) + ' KB';
    goMain();
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
            document.getElementById('lastImport').textContent = new Date().toLocaleString();
            alert('Backup importado correctamente ✅');
            goMain();
        } catch { alert('Error al leer el archivo.'); }
    };
    reader.readAsText(file);
}

function buildExportText(mode) {
    const col = getCurrent();
    if (!col) return '';

    const items = col.items;
    const sectionsMap = new Map();

    for (const it of items) {
        const sectionId = it.sectionId || 'default';
        if (!sectionsMap.has(sectionId)) {
            const section = col.sections.find(s => s.id === sectionId);
            sectionsMap.set(sectionId, {
                name: section ? section.name : 'General',
                items: []
            });
        }
        sectionsMap.get(sectionId).items.push(it);
    }

    let lines = [];
    let totalCount = 0;

    for (const [sectionId, sectionData] of sectionsMap) {
        let filteredItems = [];
        if (mode === 'missing') {
            filteredItems = sectionData.items.filter(it => !it.have);
        } else {
            filteredItems = sectionData.items.filter(it => it.rep > 0);
        }

        if (filteredItems.length === 0) continue;

        totalCount += filteredItems.length;
        const labels = filteredItems.map(it => it.label).join(', ');
        lines.push(`*${sectionData.name}*\n${labels}`);
    }

    if (lines.length === 0) {
        return mode === 'missing' ? '✅ No hay faltantes' : '✅ No hay repetidas';
    }

    const title = mode === 'missing' ? 'Faltantes' : 'Repetidas';
    return `📋 ${col.name} - ${title} (${totalCount})\n\n${lines.join('\n\n')}`;
}

document.addEventListener('DOMContentLoaded', () => {
    load();
    updateStats();

    document.querySelectorAll('[data-view]').forEach(el => {
        el.addEventListener('click', () => {
            const v = el.getAttribute('data-view');
            if (v === 'main') goMain();
            else if (v === 'collections') showView('collections');
            else if (v === 'manage') showView('manage');
            else if (v === 'delete') {
                showView('delete');
                renderDeleteShelf();
            } else if (v === 'backup') showView('backup');
            else if (v === 'create') showView('create');
            else if (v === 'edit') alert('Función en desarrollo.');
        });
    });

    document.getElementById('backBtn').addEventListener('click', () => {
        const current = document.querySelector('.view.active');
        if (current) {
            const id = current.id;
            if (id === 'view-detail') {
                showView('collections');
            } else if (id === 'view-delete') {
                showView('manage');
            } else {
                goMain();
            }
        }
    });

    document.getElementById('confirmNo').addEventListener('click', () => {
        document.getElementById('confirmModal').classList.add('hidden');
        confirmCallback = null;
    });
    document.getElementById('confirmYes').addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
    });

    document.getElementById('searchInput').addEventListener('input', renderShelf);

    document.getElementById('coverPickBtn').addEventListener('click', () => {
        document.getElementById('coverInput').click();
    });
    document.getElementById('coverInput').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            coverDataUrl = ev.target.result;
            document.getElementById('coverPreview').innerHTML = `<img src="${coverDataUrl}" alt="Tapa" />`;
            document.getElementById('coverClearBtn').style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
        e.target.value = '';
    });
    document.getElementById('coverClearBtn').addEventListener('click', () => {
        coverDataUrl = null;
        document.getElementById('coverPreview').innerHTML = '📘';
        document.getElementById('coverClearBtn').style.display = 'none';
    });

    document.getElementById('addSpecialBtn').addEventListener('click', openSpecialModal);
    document.getElementById('specialCancelBtn').addEventListener('click', closeSpecialModal);
    document.getElementById('specialAddBtn').addEventListener('click', addSpecialSection);
    document.getElementById('specialModal').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeSpecialModal();
    });

    document.getElementById('createSaveBtn').addEventListener('click', createCollection);

    document.getElementById('exportBtn').addEventListener('click', exportBackup);
    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('importInput').click();
    });
    document.getElementById('importInput').addEventListener('change', (e) => {
        if (e.target.files[0]) importBackup(e.target.files[0]);
        e.target.value = '';
    });

    document.getElementById('exportListBtn').addEventListener('click', () => {
        document.getElementById('exportModal').classList.remove('hidden');
    });
    document.getElementById('exportCancelBtn').addEventListener('click', () => {
        document.getElementById('exportModal').classList.add('hidden');
    });
    document.getElementById('exportMissingBtn').addEventListener('click', () => {
        document.getElementById('exportModal').classList.add('hidden');
        const text = buildExportText('missing');
        shareText(text);
    });
    document.getElementById('exportRepsBtn').addEventListener('click', () => {
        document.getElementById('exportModal').classList.add('hidden');
        const text = buildExportText('reps');
        shareText(text);
    });

    function shareText(text) {
        if (navigator.share) {
            navigator.share({ text: text }).catch(() => {});
        } else {
            navigator.clipboard.writeText(text).then(() => {
                alert('Texto copiado al portapapeles ✅');
            }).catch(() => {
                alert('No se pudo copiar. El texto es:\n\n' + text);
            });
        }
    }

    document.getElementById('completeBtn').addEventListener('click', () => {
        const col = getCurrent();
        if (!col) return;
        document.getElementById('confirmMsg').textContent = `¿Marcar todas las figuritas de "${col.name}" como "Tengo"?`;
        document.getElementById('confirmModal').classList.remove('hidden');
        confirmCallback = () => {
            for (const it of col.items) {
                it.have = true;
                it.rep = 0;
            }
            save();
            renderDetail();
            updateStats();
            document.getElementById('confirmModal').classList.add('hidden');
        };
    });
    document.getElementById('resetBtn').addEventListener('click', () => {
        const col = getCurrent();
        if (!col) return;
        document.getElementById('confirmMsg').textContent = `¿Desmarcar TODAS las figuritas de "${col.name}"?`;
        document.getElementById('confirmModal').classList.remove('hidden');
        confirmCallback = () => {
            for (const it of col.items) {
                it.have = false;
                it.rep = 0;
            }
            save();
            renderDetail();
            updateStats();
            document.getElementById('confirmModal').classList.add('hidden');
        };
    });

    const lastId = localStorage.getItem(LAST_KEY);
    if (lastId) {
        const col = data.collections.find(c => c.id === lastId);
        if (col) {
            goDetail(lastId);
            return;
        }
    }

    goMain();
});
