'use strict';
const $ = id => document.getElementById(id);
const palette = [{
        name: 'Écru',
        hex: '#E9DFC9'
    }, {
        name: 'Rouge brique',
        hex: '#A94B3D'
    }, {
        name: 'Ocre',
        hex: '#C99A36'
    }, {
        name: 'Bleu',
        hex: '#416A8A'
    }, {
        name: 'Vert',
        hex: '#58745A'
    }, {
        name: 'Noir',
        hex: '#303030'
    }
];
const STORAGE_KEY = 'atelier-tissage-draft-v2';
function freshDraft() {
    return {
        version: 2,
        name: 'Mon premier patron',
        shafts: 4,
        pedals: 6,
        mode: 'sinking',
        threading: Array.from({
            length: 16
        }, (_, i) => i % 4),
        tieUp: Array.from({
            length: 4
        }, (_, s) => Array.from({
                length: 6
            }, (_, p) => p === s % 2)),
        treadling: Array.from({
            length: 8
        }, (_, i) => Array.from({
                length: 6
            }, (_, p) => p === i % 2)),
        warpColors: Array.from({
            length: 16
        }, (_, i) => i % 4 + 1),
        weftColors: Array(8).fill(0)
    }
}
let draft = freshDraft();
function notify(message) {
    $('message').textContent = message
}

function normalizeDraft(raw) {
    const shafts = Number(raw.shafts),
    pedals = Number(raw.pedals);
    if (![4, 8].includes(shafts) || ![4, 6, 8, 10, 12].includes(pedals))
        throw Error('Configuration du métier invalide.');
    if (!Array.isArray(raw.threading) || !raw.threading.length || !Array.isArray(raw.tieUp) || !Array.isArray(raw.treadling) || !raw.treadling.length)
        throw Error('Le patron ne contient pas toutes les matrices nécessaires.');
    const threading = raw.threading.map(Number);
    if (!threading.every(x => Number.isInteger(x) && x >= 0 && x < shafts))
        throw Error('Le passage en lisses contient un numéro de cadre invalide.');
    const tieUp = raw.tieUp.map(row => Array.from({
                length: pedals
            }, (_, p) => Boolean(row?.[p])));
    if (tieUp.length !== shafts)
        throw Error('Le nombre de lignes de l’attachage ne correspond pas aux cadres.');
    const treadling = raw.treadling.map(row => {
        if (!Array.isArray(row))
            throw Error('Une ligne de marchure est invalide.');
        return Array.from({
            length: pedals
        }, (_, p) => Boolean(row[p]));
    });
    const warpColors = threading.map((_, i) => validColorIndex(raw.warpColors?.[i]));
    const weftColors = treadling.map((_, i) => validColorIndex(raw.weftColors?.[i]));
    return {
        version: 2,
        name: String(raw.name || 'Patron importé').slice(0, 80),
        shafts,
        pedals,
        mode: raw.mode === 'rising' ? 'rising' : 'sinking',
        threading,
        tieUp,
        treadling,
        warpColors,
        weftColors,
        endCount: threading.length,
        pickCount: treadling.length,
        calculations: normalizeCalculations(raw.calculations)
    };
}
function validColorIndex(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n < palette.length ? n : 0
}
function saveLocal(showMessage = false) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        if (showMessage)
            notify('Patron enregistré sur cet appareil.')
    } catch (e) {
        notify('Impossible de sauvegarder : espace de stockage indisponible.')
    }
}
function changed(message = 'Modifications enregistrées automatiquement.') {
    render();
    saveLocal();
    notify(message)
}
function warpUp(shaft, pick) {
    const connected = draft.treadling[pick].some((pressed, p) => pressed && draft.tieUp[shaft][p]);
    return draft.mode === 'rising' ? connected : !connected
}

/* VERSION 4 — Affichage optimisé du tissu */

function renderDrawdown() {
    const container = $('drawdownGrid');
    if (!container)
        return;

    container.replaceChildren();

    const ends = draft.threading.length;
    const picks = draft.treadling.length;

    const cellSize = 12;
    const width = ends * cellSize;
    const height = picks * cellSize;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d', {
        alpha: false
    });

    if (!ctx) {
        notify('Impossible de dessiner le patron.');
        return;
    }

    // Calcul des cadres actionnés pour chaque duite
    const activeShafts = draft.treadling.map(
            pressedPedals => {
            return Array.from({
                length: draft.shafts
            },
                (_, shaft) => pressedPedals.some(
                    (pressed, pedal) =>
                    pressed && draft.tieUp[shaft]?.[pedal]));
        });

    // Dessin du tissu
    for (let pick = 0; pick < picks; pick++) {
        for (let end = 0; end < ends; end++) {

            const shaft = draft.threading[end];
            const connected = activeShafts[pick][shaft];

            const warpVisible = draft.mode === 'rising'
                 ? connected
                 : !connected;

            const colorIndex = warpVisible
                 ? draft.warpColors[end]
                 : draft.weftColors[pick];

            ctx.fillStyle =
                palette[colorIndex]?.hex || '#E9DFC9';

            const x = end * cellSize;
            const y = pick * cellSize;

            ctx.fillRect(
                x,
                y,
                cellSize,
                cellSize);
        }
    }

    // Quadrillage léger
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();

    for (let x = 0; x <= width; x += cellSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
    }

    for (let y = 0; y <= height; y += cellSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
    }

    ctx.stroke();

    container.appendChild(canvas);
}

function renderThreading() {
    const box = $('threadingEditor');
    box.replaceChildren();
    draft.threading.forEach((shaft, i) => {
        const row = document.createElement('div');
        row.className = 'editor-row';
        const label = document.createElement('span');
        label.className = 'row-label';
        label.textContent = `Fil ${i + 1}`;
        const select = document.createElement('select');
        for (let s = 0; s < draft.shafts; s++) {
            const option = new Option(`Cadre ${s + 1}`, String(s));
            option.selected = s === shaft;
            select.add(option)
        }
        select.addEventListener('change', () => {
            draft.threading[i] = Number(select.value);
            changed()
        });
        row.append(label, select);
        box.append(row)
    })
}
function renderMatrix(targetId, matrix, rowLabel, columnPrefix, onToggle) {
    const box = $(targetId);
    box.replaceChildren();
    const grid = document.createElement('div');
    grid.className = 'matrix';
    grid.style.gridTemplateColumns = `75px repeat(${draft.pedals},38px)`;
    const corner = document.createElement('div');
    grid.append(corner);
    for (let p = 0; p < draft.pedals; p++) {
        const h = document.createElement('div');
        h.className = 'head';
        h.textContent = `${columnPrefix}${p + 1}`;
        grid.append(h)
    }
    matrix.forEach((row, r) => {
        const h = document.createElement('div');
        h.className = 'rowhead';
        h.textContent = `${rowLabel} ${r + 1}`;
        grid.append(h);
        row.forEach((active, c) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = active ? 'selected' : '';
            b.textContent = active ? '●' : '○';
            b.setAttribute('aria-label', `${rowLabel} ${r + 1}, ${columnPrefix}${c + 1}, ${active ? 'actif' : 'inactif'}`);
            b.addEventListener('click', () => onToggle(r, c));
            grid.append(b)
        })
    });
    box.append(grid)
}
function renderColors(targetId, items, prefix, onChange) {
    const box = $(targetId);
    box.replaceChildren();
    items.forEach((color, i) => {
        const row = document.createElement('div');
        row.className = 'color-row';
        const label = document.createElement('label');
        label.textContent = `${prefix} ${i + 1}`;
        const select = document.createElement('select');
        palette.forEach((c, index) => select.add(new Option(c.name, String(index))));
        select.value = String(color);
        select.addEventListener('change', () => onChange(i, Number(select.value)));
        const chip = document.createElement('span');
        chip.className = 'color-chip';
        chip.style.background = palette[color].hex;
        row.append(label, select, chip);
        box.append(row)
    })
}
function render() {
    $('draftName').textContent = draft.name;
    $('nameInput').value = draft.name;
    $('shafts').value = String(draft.shafts);
    $('pedals').value = String(draft.pedals);
    $('mode').value = draft.mode;
    $('dimensions').textContent = `${draft.threading.length} fils × ${draft.treadling.length} duites`;
    
    if ($('endCountInput')) {
      $('endCountInput').value = draft.threading.length;
    }

    if ($('pickCountInput')) {
      $('pickCountInput').value = draft.treadling.length;
    }

    
    renderDrawdown();
    renderThreading();
    renderMatrix('tieupEditor', draft.tieUp, 'Cadre', 'P', (r, c) => {
        draft.tieUp[r][c] = !draft.tieUp[r][c];
        changed()
    });
    renderMatrix('treadlingEditor', draft.treadling, 'Duite', 'P', (r, c) => {
        draft.treadling[r][c] = !draft.treadling[r][c];
        changed()
    });
    renderColors('warpColorsEditor', draft.warpColors, 'Fil', (i, v) => {
        draft.warpColors[i] = v;
        changed()
    });
    renderColors('weftColorsEditor', draft.weftColors, 'Duite', (i, v) => {
        draft.weftColors[i] = v;
        changed()
    });
    $('removeEnd').disabled = draft.threading.length <= 1;
    $('removePick').disabled = draft.treadling.length <= 1;
    updateDimensionFields();
}
$('addEnd').addEventListener('click', () => {
    draft.threading.push(((draft.threading.at(-1) + 1) % draft.shafts));
    draft.warpColors.push(draft.warpColors.at(-1) ?? 0);
    changed('Fil ajouté.')
});
$('removeEnd').addEventListener('click', () => {
    if (draft.threading.length <= 1)
        return;
    draft.threading.pop();
    draft.warpColors.pop();
    changed('Dernier fil supprimé.')
});
$('addPick').addEventListener('click', () => {
    draft.treadling.push([...draft.treadling.at(-1)]);
    draft.weftColors.push(draft.weftColors.at(-1) ?? 0);
    changed('Duite ajoutée.')
});
$('removePick').addEventListener('click', () => {
    if (draft.treadling.length <= 1)
        return;
    draft.treadling.pop();
    draft.weftColors.pop();
    changed('Dernière duite supprimée.')
});
$('shafts').addEventListener('change', e => {
    const n = Number(e.target.value);
    draft.shafts = n;
    draft.threading = draft.threading.map(s => s % n);
    draft.tieUp = Array.from({
        length: n
    }, (_, s) => Array.from({
                length: draft.pedals
            }, (_, p) => Boolean(draft.tieUp[s]?.[p])));
    changed('Nombre de cadres modifié. Vérifie le passage et l’attachage.')
});
$('pedals').addEventListener('change', e => {
    const n = Number(e.target.value);
    draft.pedals = n;
    draft.tieUp = draft.tieUp.map(row => Array.from({
                length: n
            }, (_, p) => Boolean(row[p])));
    draft.treadling = draft.treadling.map(row => Array.from({
                length: n
            }, (_, p) => Boolean(row[p])));
    changed('Nombre de pédales modifié. Vérifie la marchure.')
});
$('mode').addEventListener('change', e => {
    draft.mode = e.target.value;
    changed('Mécanisme modifié; dessin recalculé.')
});
$('nameInput').addEventListener('change', e => {
    draft.name = e.target.value.trim() || 'Nouveau patron';
    changed('Nom du patron mis à jour.')
});
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t === button));
        document.querySelectorAll('.editor').forEach(s => s.classList.toggle('hidden', s.id !== button.dataset.tab))
    }));
$('saveButton').addEventListener('click', () => saveLocal(true));
$('exportJSON').addEventListener('click', () => {
    draft.endCount = draft.threading.length;
    draft.pickCount = draft.treadling.length
    
    draft.calculations = readCalculations();
    saveLocal();
    const blob = new Blob([JSON.stringify(draft, null, 2)], {
        type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'patron') + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify('Fichier JSON exporté.')
});
$('importButton').addEventListener('click', () => $('importFile').click());

$('importFile').addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    const content = await file.text();
    const imported = JSON.parse(content);

    // Vérifier et charger le patron
    const newDraft = normalizeDraft(imported);

    // Restaurer les paramètres de calcul
    newDraft.calculations = normalizeCalculations(
      imported.calculations
    );

    draft = newDraft;

    // Restaurer tous les champs de l'interface
    render();
    updateDimensionFields();
    loadCalculations();

    // Recalculer les résultats
    calculateWeaving();

    // Sauvegarder le patron importé
    saveLocal();

    notify('Patron importé avec tous ses paramètres.');

  } catch (error) {
    notify(
      'Importation impossible : ' + error.message
    );
  } finally {
    e.target.value = '';
  }
});


// Vue quadrillée complète : même modèle de données que les autres onglets.
let overviewCellSize = 24;
function makeOverviewGrid(parent, rows, cols, cellFn, title) {
    const section = document.createElement('div');
    const heading = document.createElement('p');
    heading.className = 'overview-title';
    heading.textContent = title;
    const grid = document.createElement('div');
    grid.className = 'overview-part';
    grid.style.gridTemplateColumns = `repeat(${cols}, var(--cell))`;
    for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
            grid.append(cellFn(r, c));
    section.append(heading, grid);
    parent.append(section);
}
function ovButton(active, label, callback) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = active ? '●' : '';
    b.className = active ? 'selected' : '';
    b.setAttribute('aria-label', label);
    b.addEventListener('click', callback);
    return b;
}
function renderOverview() {
    const board = $('overviewBoard');
    if (!board)
        return;
    board.replaceChildren();
    board.style.setProperty('--cell', overviewCellSize + 'px');
    const ends = draft.threading.length,
    picks = draft.treadling.length;
    // Passage en lisses : rangées de cadres, colonnes de fils.
    makeOverviewGrid(board, draft.shafts, ends, (r, c) => ovButton(
            draft.threading[c] === r, `Fil ${c + 1}, cadre ${r + 1}`,
            () => {
            draft.threading[c] = r;
            changed('Passage modifié.')
        }), 'Passage en lisses (cadres × fils)');
    // Attachage : rangées de cadres, colonnes de pédales.
    makeOverviewGrid(board, draft.shafts, draft.pedals, (r, c) => ovButton(
            draft.tieUp[r][c], `Cadre ${r + 1}, pédale ${c + 1}`,
            () => {
            draft.tieUp[r][c] = !draft.tieUp[r][c];
            changed('Attachage modifié.')
        }), 'Attachage (cadres × pédales)');
    makeOverviewGrid(board, picks, ends, (r, c) => {
        const cell = document.createElement('div');
        cell.className = 'ov-cell';
        const above = warpUp(draft.threading[c], r);
        cell.style.background = palette[above ? draft.warpColors[c] : draft.weftColors[r]].hex;
        cell.title = `Duite ${r + 1}, fil ${c + 1} : ${above ? 'chaîne' : 'trame'} visible`;
        return cell;
    }, 'Dessin du tissu (duites × fils)');
    makeOverviewGrid(board, picks, draft.pedals, (r, c) => ovButton(
            draft.treadling[r][c], `Duite ${r + 1}, pédale ${c + 1}`,
            () => {
            draft.treadling[r][c] = !draft.treadling[r][c];
            changed('Marchure modifiée.')
        }), 'Marchure (duites × pédales)');
}
$('zoomControl').addEventListener('input', e => {
    overviewCellSize = Number(e.target.value);
    renderOverview()
});
const originalRender = render;
render = function () {
    originalRender();
    renderOverview()
};

try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved)
        draft = normalizeDraft(JSON.parse(saved))
} catch (e) {
    notify('Sauvegarde précédente invalide; un nouveau patron est chargé.')
}
render();

/* SESSION 4 — Dimensions personnalisées du patron */

const MAX_ENDS = 580;
const MAX_PICKS = 580;

function repeatToLength(values, count, fallback) {
    const source = values.length ? values : [fallback];

    return Array.from({
        length: count
    },
        (_, i) => {
        const value = source[i % source.length];
        return Array.isArray(value) ? [...value] : value;
    });
}

function applyDimensions() {
    const ends = Number($('endCountInput').value);
    const picks = Number($('pickCountInput').value);

    if (
        !Number.isInteger(ends) ||
        !Number.isInteger(picks) ||
        ends < 1 ||
        picks < 1 ||
        ends > MAX_ENDS ||
        picks > MAX_PICKS) {
        notify(
            'Choisis entre 1 et 580 fils et entre 1 et 580 duites.');
        return;
    }

    draft.threading = repeatToLength(
            draft.threading,
            ends,
            0);

    draft.warpColors = repeatToLength(
            draft.warpColors,
            ends,
            0);

    draft.treadling = repeatToLength(
            draft.treadling,
            picks,
            Array(draft.pedals).fill(false));

    draft.weftColors = repeatToLength(
            draft.weftColors,
            picks,
            0);

    changed(
`Patron redimensionné : ${ends} fils × ${picks} duites.`);

    calculateWeaving();
}

$('applyDimensions').addEventListener(
    'click',
    applyDimensions);

$('endCountInput').value = draft.threading.length;
$('pickCountInput').value = draft.treadling.length;

/* SESSION 6 — Calculs pour plusieurs pièces */

/* SESSION 7 — Ourlets et franges */

function calculateWeaving() {
    const ids = [
        'calcEpi', 'calcPpi', 'calcLength',
        'calcShrink', 'calcTakeup', 'calcWaste',
        'calcPieces', 'calcSeparation',
        'calcHemStart', 'calcHemEnd',
        'calcFringeStart', 'calcFringeEnd'
    ];

    const output = $('calculationResults');

    const raw = ids.map(id => $(id)?.value.trim());

    if (raw.some(v => v === undefined || v === '')) {
        output.textContent = 'Remplis tous les champs.';
        return;
    }

    const [
        epi, ppi, finishedLength,
        shrink, takeup, waste,
        pieces, separation,
        hemStart, hemEnd,
        fringeStart, fringeEnd
    ] = raw.map(Number);

    const numbers = raw.map(Number);

    if (
        !numbers.every(Number.isFinite) ||
        epi <= 0 || ppi <= 0 ||
        finishedLength <= 0 ||
        shrink < 0 || shrink >= 100 ||
        takeup < 0 || waste < 0 ||
        !Number.isInteger(pieces) ||
        pieces < 1 || pieces > 100 ||
        [separation, hemStart, hemEnd,
            fringeStart, fringeEnd].some(v => v < 0)) {
        output.textContent =
            'Vérifie les valeurs saisies.';
        return;
    }

    const ends = draft.threading.length;
    const width = ends / epi;

    // Corps de chaque pièce, avant retrait
    const wovenBody =
        finishedLength / (1 - shrink / 100);

    // Ourlets tissés à chaque extrémité
    const hemsPerPiece = hemStart + hemEnd;

    // Franges non tissées
    const fringesPerPiece =
        fringeStart + fringeEnd;

    // Longueur tissée totale
    const wovenPerPiece = wovenBody + hemsPerPiece;

    const totalWoven = wovenPerPiece * pieces;

    // Longueur de franges réservée
    const totalFringes = fringesPerPiece * pieces;

    // Séparations supplémentaires
    const totalSeparation =
        separation * (pieces - 1);

    // Embuvage appliqué aux sections tissées
    const warpPerEnd =
        (totalWoven + totalSeparation) *
    (1 + takeup / 100) +
    totalFringes +
    waste;

    // Nombre estimé de duites
    const bodyPicks = Math.ceil(wovenBody * ppi);
    const hemPicks = Math.ceil(hemsPerPiece * ppi);
    const separationPicks =
        Math.ceil(separation * ppi);

    const picksPerPiece = bodyPicks + hemPicks;

    const totalPicks =
        picksPerPiece * pieces +
        separationPicks * (pieces - 1);

    // Quantités de fil
    const totalWarpYards =
        ends * warpPerEnd / 36;

    const totalWeftYards =
        totalPicks * width / 36;

    const format = (n, digits = 1) =>
    n.toLocaleString('fr-CA', {
        maximumFractionDigits: digits
    });

    const results = [
        ['Nombre de pièces', format(pieces, 0)],
        ['Fils de chaîne', format(ends, 0)],
        ['Largeur au métier', format(width) + ' po'],
        ['Corps tissé par pièce',
            format(wovenBody) + ' po'],
        ['Ourlets par pièce',
            format(hemsPerPiece) + ' po'],
        ['Franges par pièce',
            format(fringesPerPiece) + ' po'],
        ['Longueur totale des séparations',
            format(totalSeparation) + ' po'],
        ['Longueur à ourdir par fil',
            format(warpPerEnd) + ' po (' +
            format(warpPerEnd / 36, 2) + ' verges)'],

        ['Duites par pièce',
            format(picksPerPiece, 0)],
        ['Duites totales',
            format(totalPicks, 0)],
        ['Chaîne totale',
            format(totalWarpYards) + ' verges'],
        ['Trame minimale estimée',
            format(totalWeftYards) + ' verges']
    ];

    output.replaceChildren();

    for (const [label, value] of results) {
        const p = document.createElement('p');
        const strong = document.createElement('strong');

        strong.textContent = label + ' : ';

        p.append(
            strong,
            document.createTextNode(value));

        output.append(p);
    }
}

$('calculateButton').addEventListener(
    'click',
    calculateWeaving);

/* SESSION 8 — Sauvegarde des calculs */

const CALC_FIELDS = {
    calcEpi: 20,
    calcPpi: 20,
    calcLength: 30,
    calcShrink: 10,
    calcTakeup: 10,
    calcWaste: 24,
    calcPieces: 1,
    calcSeparation: 1,
    calcHemStart: 0.75,
    calcHemEnd: 0.75,
    calcFringeStart: 0,
    calcFringeEnd: 0
};

// Ajoute les valeurs manquantes aux anciens patrons.
function normalizeCalculations(values) {
    const result = {};

    for (const [id, defaultValue] of
        Object.entries(CALC_FIELDS)) {

        const raw = values?.[id];
        const number = Number(raw);

        result[id] =
            raw !== undefined &&
            raw !== null &&
            raw !== '' &&
            Number.isFinite(number)
             ? number
             : defaultValue;
    }

    return result;
}

// Récupère les paramètres de l'interface.
function readCalculations() {
    const values = {};

    for (const id of Object.keys(CALC_FIELDS)) {
        values[id] = $(id).value;
    }

    return normalizeCalculations(values);
}

// Remplit les champs à partir du patron.
function loadCalculations() {
    draft.calculations =
        normalizeCalculations(draft.calculations);

    for (const [id, value] of
        Object.entries(draft.calculations)) {

        $(id).value = String(value);
    }
}

// Sauvegarde les paramètres du patron.
function saveCalculations() {
    draft.calculations = readCalculations();

    saveLocal();
    notify('Paramètres de calcul enregistrés.');
}

// Chargement initial.
loadCalculations();

// Sauvegarde automatique à chaque changement.
for (const id of Object.keys(CALC_FIELDS)) {
    $(id).addEventListener('change', () => {
        saveCalculations();
        calculateWeaving();
    });
}

// Calcul initial.
calculateWeaving();


/* Synchronisation des dimensions du patron */

function updateDimensionFields() {
  const endsInput = $('endCountInput');
  const picksInput = $('pickCountInput');

  if (endsInput) {
    endsInput.value = draft.threading.length;
  }

  if (picksInput) {
    picksInput.value = draft.treadling.length;
  }

  const dimensions = $('dimensions');

  if (dimensions) {
    dimensions.textContent =
      `${draft.threading.length} fils × ` +
      `${draft.treadling.length} duites`;
  }
}

