/* Lens Ray Diagram Tutor - vanilla JS only */
const canvas = document.getElementById('diagram-canvas');
const ctx = canvas.getContext('2d');
const levelSelect = document.getElementById('level-select');
const modeSelect = document.getElementById('mode-select');
const focalLengthInput = document.getElementById('focal-length-input');
const guidedStepsEl = document.getElementById('guided-steps');
const scenarioSummary = document.getElementById('scenario-summary');
const resetBtn = document.getElementById('reset-btn');
const submitBtn = document.getElementById('submit-btn');
const feedbackEl = document.getElementById('feedback');
const dropzoneWrap = document.getElementById('dropzone-wrap');
const vocabBank = document.getElementById('vocab-bank');
const classification = document.getElementById('classification');
const explanation = document.getElementById('explanation');
const progressNote = document.getElementById('progress-note');

const STORAGE_KEY = 'lens-tutor-progress-v1';
const SCALE = 1;
const hObject = 120;

const levels = [
  { id: 1, name: 'Level 1: Convex beyond 2F', lens: 'convex', uFactor: 2.8, guided: ['Draw a ray parallel to the principal axis.', 'Draw the central ray through optical centre.', 'Locate the real image where refracted rays intersect.', 'Classify image and complete vocabulary.'], expectedClass: 'Real, inverted, diminished' },
  { id: 2, name: 'Level 2: Convex between F and 2F', lens: 'convex', uFactor: 1.5, guided: ['Draw a parallel ray that refracts through focal point.', 'Draw a central ray undeviated.', 'Find image intersection beyond 2F.', 'Classify image and justify with focal terms.'], expectedClass: 'Real, inverted, magnified' },
  { id: 3, name: 'Level 3: Convex inside F', lens: 'convex', uFactor: 0.7, guided: ['Draw one parallel ray and refract it through focal point.', 'Draw central ray undeviated.', 'Extend refracted rays backward to locate virtual image.', 'Classify as virtual image and explain why it cannot be projected.'], expectedClass: 'Virtual, upright, magnified' },
  { id: 4, name: 'Level 4: Concave', lens: 'concave', uFactor: 2.0, guided: ['Draw a ray parallel to axis, refracted to diverge as if from focal point.', 'Draw undeviated central ray.', 'Extend rays backward to find virtual image.', 'Classify image and explain diminished upright virtual image.'], expectedClass: 'Virtual, upright, diminished' },
];

const state = {
  unlockedLevel: 1,
  currentLevel: 1,
  guidedStep: 0,
  rays: [],
  snapPoints: [],
  clickStage: 0,
  selectedStart: null,
  showSolution: false,
  placements: {},
};

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.unlockedLevel) state.unlockedLevel = Math.min(4, parsed.unlockedLevel);
  } catch {
    // ignore malformed localStorage
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ unlockedLevel: state.unlockedLevel }));
}

function worldToScreen(x, y) {
  return {
    x: canvas.width / 2 + x * SCALE,
    y: canvas.height / 2 - y * SCALE,
  };
}

function screenToWorld(x, y) {
  return {
    x: x - canvas.width / 2,
    y: canvas.height / 2 - y,
  };
}

function levelCfg() {
  return levels.find((l) => l.id === Number(state.currentLevel));
}

function currentF() {
  return Number(focalLengthInput.value);
}

function objectX() {
  return -levelCfg().uFactor * currentF();
}

function objectTip() {
  return { x: objectX(), y: hObject };
}

function opticalCenter() {
  return { x: 0, y: 0 };
}

function solveImage() {
  const f = currentF();
  const cfg = levelCfg();
  const u = Math.abs(objectX());
  const fSigned = cfg.lens === 'concave' ? -f : f;
  const v = 1 / ((1 / fSigned) - (1 / u));
  const m = v / u;
  const y = -m * hObject;
  return { x: v, y, v, m, u };
}

function computeSnapPoints() {
  const f = currentF();
  const s = [
    { name: '+F', x: f, y: 0, type: 'true' },
    { name: '-F', x: -f, y: 0, type: 'true' },
    { name: '+0.7F', x: 0.7 * f, y: 0, type: 'distractor' },
    { name: '-0.7F', x: -0.7 * f, y: 0, type: 'distractor' },
    { name: '+1.3F', x: 1.3 * f, y: 0, type: 'distractor' },
    { name: '-1.3F', x: -1.3 * f, y: 0, type: 'distractor' },
    { name: '+F,+0.3h', x: f, y: 0.3 * hObject, type: 'distractor' },
    { name: '+F,-0.3h', x: f, y: -0.3 * hObject, type: 'distractor' },
    { name: '-F,+0.3h', x: -f, y: 0.3 * hObject, type: 'distractor' },
    { name: '-F,-0.3h', x: -f, y: -0.3 * hObject, type: 'distractor' },
    { name: 'Optical centre', x: 0, y: 0, type: 'center' },
  ];
  state.snapPoints = s;
}

function populateLevels() {
  levelSelect.innerHTML = '';
  levels.forEach((l) => {
    const option = document.createElement('option');
    option.value = String(l.id);
    option.textContent = l.name + (l.id > state.unlockedLevel ? ' 🔒' : '');
    option.disabled = l.id > state.unlockedLevel;
    levelSelect.appendChild(option);
  });
  levelSelect.value = String(state.currentLevel);
}

function resetLevel() {
  state.rays = [];
  state.guidedStep = 0;
  state.clickStage = 0;
  state.selectedStart = null;
  state.showSolution = false;
  state.placements = {};
  classification.value = '';
  explanation.value = '';
  feedbackEl.textContent = '';
  feedbackEl.className = '';
  renderDropzones();
  render();
}

function setScenarioText() {
  const cfg = levelCfg();
  const u = Math.abs(objectX()).toFixed(1);
  scenarioSummary.textContent = `Lens type: ${cfg.lens}. Object distance u = ${u}. Use principal axis, focal point and focal length correctly.`;
  guidedStepsEl.innerHTML = '';
  cfg.guided.forEach((step, idx) => {
    const li = document.createElement('li');
    li.textContent = step;
    li.className = modeSelect.value === 'guided' && idx === state.guidedStep ? 'current-step' : '';
    guidedStepsEl.appendChild(li);
  });
}

function drawBase() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // grid
  ctx.strokeStyle = '#f0f2f5';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 40) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 40) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  // axis
  const a1 = worldToScreen(-canvas.width / 2, 0);
  const a2 = worldToScreen(canvas.width / 2, 0);
  ctx.strokeStyle = '#424955';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(a1.x, a1.y); ctx.lineTo(a2.x, a2.y); ctx.stroke();
  ctx.fillStyle = '#424955';
  ctx.fillText('Principal axis', a1.x + 10, a1.y - 8);

  // lens
  const lTop = worldToScreen(0, 170);
  const lBot = worldToScreen(0, -170);
  ctx.strokeStyle = '#38598b';
  ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(lTop.x, lTop.y); ctx.lineTo(lBot.x, lBot.y); ctx.stroke();
  const cfg = levelCfg();
  ctx.fillStyle = '#38598b';
  ctx.fillText(cfg.lens === 'convex' ? 'Convex lens' : 'Concave lens', lTop.x + 8, lTop.y + 14);

  // focal points
  const f = currentF();
  [f, -f].forEach((fx) => {
    const p = worldToScreen(fx, 0);
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillText('F', p.x + 7, p.y - 6);
  });

  const tip = worldToScreen(objectTip().x, objectTip().y);
  const base = worldToScreen(objectTip().x, 0);
  ctx.strokeStyle = '#101820';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.lineTo(tip.x - 7, tip.y + 12); ctx.lineTo(tip.x + 7, tip.y + 12); ctx.closePath(); ctx.fill();
  ctx.fillText('Object', tip.x - 18, tip.y - 14);
}

function drawSnapPoints() {
  state.snapPoints.forEach((s) => {
    const p = worldToScreen(s.x, s.y);
    ctx.fillStyle = s.type === 'true' || s.type === 'center' ? '#2f6f3e' : '#9ca3af';
    ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
  });
}

function drawRaySegment(p1, p2, color, dashed = false) {
  const a = worldToScreen(p1.x, p1.y);
  const b = worldToScreen(p2.x, p2.y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash(dashed ? [5, 4] : []);
  ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  ctx.setLineDash([]);
}

function calculateRay(rayType, chosenTarget) {
  const cfg = levelCfg();
  const tip = objectTip();
  const center = opticalCenter();
  const L = { x: 0, y: tip.y };
  const farX = 430;
  const nearX = -430;

  if (rayType === 'parallel') {
    if (cfg.lens === 'convex') {
      const trueF = { x: currentF(), y: 0 };
      const m = (trueF.y - L.y) / (trueF.x - L.x);
      const yFar = L.y + m * (farX - L.x);
      return {
        type: 'parallel',
        chosenSnap: chosenTarget,
        correctSnap: '+F',
        segments: [{ a: tip, b: L }, { a: L, b: { x: farX, y: yFar } }],
        backExtensions: [],
      };
    }
    // concave divergence as from -F
    const virtualOrigin = { x: -currentF(), y: 0 };
    const mBack = (virtualOrigin.y - L.y) / (virtualOrigin.x - L.x);
    const yFar = L.y + (-mBack) * (farX - L.x);
    const yBack = L.y + mBack * (nearX - L.x);
    return {
      type: 'parallel',
      chosenSnap: chosenTarget,
      correctSnap: '-F',
      segments: [{ a: tip, b: L }, { a: L, b: { x: farX, y: yFar } }],
      backExtensions: [{ a: L, b: { x: nearX, y: yBack } }],
    };
  }

  // central ray undeviated
  const m = (center.y - tip.y) / (center.x - tip.x);
  const yFar = tip.y + m * (farX - tip.x);
  const yBack = tip.y + m * (nearX - tip.x);
  return {
    type: 'central',
    chosenSnap: chosenTarget,
    correctSnap: 'Optical centre',
    segments: [{ a: tip, b: { x: farX, y: yFar } }],
    backExtensions: cfg.lens === 'concave' || levelCfg().id === 3 ? [{ a: tip, b: { x: nearX, y: yBack } }] : [],
  };
}

function renderStudentRays() {
  state.rays.forEach((ray) => {
    ray.segments.forEach((s) => drawRaySegment(s.a, s.b, '#b22222'));
    ray.backExtensions.forEach((s) => drawRaySegment(s.a, s.b, '#b22222', true));
  });
}

function renderIdealSolution() {
  if (!state.showSolution) return;
  const idealParallel = calculateRay('parallel', { name: 'ideal' });
  const idealCentral = calculateRay('central', { name: 'ideal' });
  [idealParallel, idealCentral].forEach((ray) => {
    ray.segments.forEach((s) => drawRaySegment(s.a, s.b, '#1f8b4c'));
    ray.backExtensions.forEach((s) => drawRaySegment(s.a, s.b, '#1f8b4c', true));
  });
  const img = solveImage();
  const base = worldToScreen(img.x, 0);
  const tip = worldToScreen(img.x, img.y);
  ctx.strokeStyle = '#1f8b4c';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke();
  ctx.fillText('Ideal image', tip.x + 5, tip.y - 5);
}

function render() {
  setScenarioText();
  drawBase();
  drawSnapPoints();
  renderStudentRays();
  renderIdealSolution();
}

function closestSnap(world) {
  let best = null;
  let minDist = Infinity;
  state.snapPoints.forEach((s) => {
    const d = Math.hypot(world.x - s.x, world.y - s.y);
    if (d < minDist) { minDist = d; best = s; }
  });
  return minDist < 28 ? best : null;
}

function handleCanvasClick(ev) {
  const rect = canvas.getBoundingClientRect();
  const world = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top);
  const tip = objectTip();

  if (state.clickStage === 0) {
    if (Math.hypot(world.x - tip.x, world.y - tip.y) < 25) {
      state.selectedStart = tip;
      state.clickStage = 1;
      feedbackEl.textContent = 'Start accepted. Now click a snap point target.';
      feedbackEl.className = '';
    } else {
      feedbackEl.textContent = 'First click must be on object tip.';
      feedbackEl.className = 'error';
    }
    return;
  }

  const snapped = closestSnap(world);
  if (!snapped) {
    feedbackEl.textContent = 'Second click must be on a snap point.';
    feedbackEl.className = 'error';
    return;
  }

  const nextRayType = state.rays.length === 0 ? 'parallel' : 'central';
  state.rays.push(calculateRay(nextRayType, snapped));
  state.clickStage = 0;
  state.selectedStart = null;
  if (modeSelect.value === 'guided') state.guidedStep = Math.min(levelCfg().guided.length - 1, state.guidedStep + 1);
  render();
}

function renderDropzones() {
  const targets = [
    { key: 'Principal axis', text: 'Drop label near principal axis marker', pos: { x: -220, y: 20 } },
    { key: 'Focal point', text: 'Drop label near right focal point marker', pos: { x: currentF(), y: 20 } },
    { key: 'Focal length', text: 'Drop label on distance between lens and F', pos: { x: currentF() / 2, y: -30 } },
  ];
  dropzoneWrap.innerHTML = '';
  targets.forEach((t) => {
    const zone = document.createElement('div');
    zone.className = 'dropzone';
    zone.dataset.target = t.key;
    zone.innerHTML = `<span>${t.text}</span><span class="placed">${state.placements[t.key] || ''}</span>`;
    zone.addEventListener('dragover', (e) => e.preventDefault());
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      const term = e.dataTransfer.getData('text/plain');
      state.placements[t.key] = term;
      renderDropzones();
    });
    dropzoneWrap.appendChild(zone);
  });
}

function validateVocabulary() {
  return ['Principal axis', 'Focal point', 'Focal length'].every((t) => state.placements[t] === t);
}

function keywordCheck() {
  const txt = explanation.value.toLowerCase();
  if (txt.length < 80) return false;
  const cfg = levelCfg();
  if (cfg.lens === 'concave' || cfg.id === 3) {
    const terms = ['diverge', 'appear to meet', 'backward extension', 'cannot be projected'];
    return terms.filter((t) => txt.includes(t)).length >= 2;
  }
  return ['principal axis', 'focal point', 'real image'].some((t) => txt.includes(t));
}

function detectMisconceptions() {
  const cfg = levelCfg();
  const errs = [];
  if (state.rays.length < 2) errs.push('You must construct both the parallel ray and central ray.');

  const parallel = state.rays.find((r) => r.type === 'parallel');
  const central = state.rays.find((r) => r.type === 'central');

  if (parallel && parallel.chosenSnap.name !== parallel.correctSnap) {
    errs.push('Parallel ray misconception: you did not choose the correct focal point snap target.');
  }
  if (central && central.chosenSnap.name !== 'Optical centre') {
    errs.push('Central ray misconception: central ray should pass through optical centre undeviated.');
  }

  const img = solveImage();
  if (cfg.lens === 'concave' && img.x > 0) errs.push('Concave lens cannot produce a real image on the opposite side.');
  if (cfg.lens === 'concave' && Math.abs(img.y) >= hObject) errs.push('Concave lens image should be diminished.');
  if ((cfg.id === 3 || cfg.lens === 'concave') && !parallel?.backExtensions?.length) {
    errs.push('Virtual image construction needs backward ray extensions.');
  }

  const classVal = classification.value;
  if (classVal && classVal !== cfg.expectedClass) {
    errs.push('Image classification is incorrect for this object position.');
  }

  const orientExpected = cfg.expectedClass.includes('upright') ? 'upright' : 'inverted';
  const orientActual = img.y > 0 ? 'upright' : 'inverted';
  if (orientExpected !== orientActual) errs.push('Incorrect image orientation detected.');

  if ((cfg.lens === 'concave') && classVal.includes('Real')) errs.push('Concave lens producing real image is a misconception.');
  if ((cfg.lens === 'concave') && classVal.includes('magnified')) errs.push('Concave lens image larger than object is incorrect.');

  // thin-lens consistency check (student uses solved v implicitly from rays; check expected finite results)
  const f = cfg.lens === 'concave' ? -currentF() : currentF();
  const u = Math.abs(objectX());
  const vTheo = 1 / ((1 / f) - (1 / u));
  const tolerance = 0.12 * Math.abs(vTheo);
  if (Math.abs(solveImage().v - vTheo) > tolerance) {
    errs.push('Image position does not satisfy thin lens equation within tolerance.');
  }

  return errs;
}

function submitAttempt() {
  state.showSolution = true;
  render();

  const errs = detectMisconceptions();
  if (!validateVocabulary()) errs.push('Vocabulary placement incorrect: principal axis/focal point/focal length labels mismatch.');
  if (!keywordCheck()) errs.push('Explanation is insufficient. Include required terminology and minimum detail.');
  if (!classification.value) errs.push('Select an image classification.');

  if (errs.length) {
    feedbackEl.textContent = errs.join('\n');
    feedbackEl.className = 'error';
    return;
  }

  if (state.currentLevel < 4 && state.unlockedLevel === state.currentLevel) {
    state.unlockedLevel += 1;
    saveProgress();
    populateLevels();
  }

  feedbackEl.textContent = 'Excellent. Diagram geometry, terminology, and explanation are correct. Next level unlocked (if available).';
  feedbackEl.className = 'success';
  progressNote.textContent = `Unlocked up to Level ${state.unlockedLevel}.`;
}

vocabBank.querySelectorAll('.chip').forEach((chip) => {
  chip.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', chip.dataset.term);
  });
});

levelSelect.addEventListener('change', () => {
  state.currentLevel = Number(levelSelect.value);
  computeSnapPoints();
  resetLevel();
});
modeSelect.addEventListener('change', () => render());
focalLengthInput.addEventListener('change', () => {
  computeSnapPoints();
  resetLevel();
});
resetBtn.addEventListener('click', resetLevel);
submitBtn.addEventListener('click', submitAttempt);
canvas.addEventListener('click', handleCanvasClick);

function init() {
  loadProgress();
  state.currentLevel = state.unlockedLevel;
  populateLevels();
  computeSnapPoints();
  renderDropzones();
  progressNote.textContent = `Unlocked up to Level ${state.unlockedLevel}.`;
  render();
}

init();
