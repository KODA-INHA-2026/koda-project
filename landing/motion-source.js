// Motion belongs to a deliberate change of task or result, never to a timer.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const groups = new Map();
const ease = 'cubic-bezier(.22,1,.36,1)';
const scriptURL = document.currentScript?.src || document.baseURI;
let motionStyle = document.querySelector('link[data-koda-motion]');
if (!motionStyle) {
  motionStyle = document.createElement('link');
  motionStyle.rel = 'stylesheet';
  motionStyle.href = new URL('product-motion.css', scriptURL).href;
  motionStyle.dataset.kodaMotion = '';
  document.head.append(motionStyle);
}

function visible(element) {
  return element?.isConnected && !document.hidden && !reduce.matches &&
    !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 &&
    getComputedStyle(element).visibility !== 'hidden';
}

function finish(record) {
  if (record.done) return;
  record.done = true;
  const records = groups.get(record.group);
  records?.delete(record);
  if (!records?.size) groups.delete(record.group);
  record.cleanup();
}

function stop(group) {
  for (const record of [...(groups.get(group) || [])]) {
    record.animation.cancel();
    finish(record);
  }
}

function stopAll() {
  for (const group of [...groups.keys()]) stop(group);
}

function play(group, element, keyframes, duration = 220, cleanup = () => {}, owner = element) {
  if (!visible(owner) || typeof element?.animate !== 'function') { cleanup(); return; }
  try {
    const animation = element.animate(keyframes, {duration, easing: ease});
    const record = {group, animation, element, owner, cleanup, done: false};
    if (!groups.has(group)) groups.set(group, new Set());
    groups.get(group).add(record);
    animation.addEventListener('finish', () => finish(record), {once: true});
    animation.addEventListener('cancel', () => finish(record), {once: true});
  } catch { cleanup(); }
}

function titleChange(group, title, axis = 'Y', distance = 4) {
  if (!title) return;
  play(group, title, {opacity: [.86, 1], transform: [`translate${axis}(${distance}px)`, 'translate(0,0)']});
}

function surfaceChange(group, surface, axis = 'Y', distance = 4) {
  // Only this empty border layer moves. Addresses, fields and table rows stay still.
  if (!visible(surface) || !motionStyle.sheet) return;
  surface.classList.add('koda-motion-surface');
  const frame = document.createElement('span');
  frame.className = 'koda-motion-frame';
  frame.setAttribute('aria-hidden', 'true');
  surface.append(frame);
  play(group, frame, {opacity: [.32, 0], transform: [`translate${axis}(${distance}px)`, 'translate(0,0)']}, 220, () => frame.remove(), surface);
}

const preview = document.querySelector('.task-preview');
if (preview) {
  const tabs = [...preview.querySelectorAll('[role="tab"]')];
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  let activeIndex = Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true'));
  function activate(index, focus = false, direction = Math.sign(index - activeIndex)) {
    if (!tabs[index] || !panels[index] || tabs[index].disabled) return;
    if (index === activeIndex) { if (focus) tabs[index].focus(); return; }
    stop('preview');
    activeIndex = index;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; });
    panels.forEach((panel, i) => { if (panel) panel.hidden = i !== index; });
    if (focus) tabs[index].focus();
    const panel = panels[index];
    titleChange('preview', panel.querySelector('.preview-heading h3'), 'X', direction * 6);
    surfaceChange('preview', panel, 'X', direction * 6);
  }
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => activate(i));
    tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const destination = {ArrowRight: (i + 1) % tabs.length, ArrowLeft: (i + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1}[event.key];
      if (destination === undefined) return;
      event.preventDefault();
      const direction = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : Math.sign(destination - activeIndex);
      activate(destination, true, direction);
    });
  });
}

const consoleRoot = document.querySelector('.console-content');
if (consoleRoot) {
  const byId = id => document.getElementById(id);
  const viewOrder = ['list', 'detail', 'activity', 'archive'];
  const snapshot = () => {
    const panel = [...consoleRoot.querySelectorAll('[data-view-panel]')].find(element => !element.hidden);
    const client = byId('client-select')?.value || '';
    const view = panel?.dataset.viewPanel || '';
    return {panel, view, client, step: byId('stage-title')?.textContent || '', state: byId('task-status')?.textContent || ''};
  };
  let previous = snapshot();
  let lastAction = -Infinity;
  const noteAction = () => { lastAction = performance.now(); };
  document.addEventListener('click', event => {
    if (event.target.closest?.('.console-page button, .console-page a[data-view], .console-page [data-open-current]')) noteAction();
  }, true);
  document.addEventListener('change', event => {
    if (event.target.matches?.('#client-select, #assurance-scenario')) noteAction();
  }, true);
  window.addEventListener('popstate', noteAction, true);
  document.addEventListener('koda:work-rendered', () => {
    const current = snapshot();
    const from = previous;
    previous = current;
    stop('work');
    if (!visible(current.panel) || performance.now() - lastAction > 1600) return;
    const navigation = current.view !== from.view || current.client !== from.client;
    const stepChanged = current.step !== from.step;
    const stateChanged = current.state !== from.state;
    if (!navigation && !stepChanged && !stateChanged) return;
    if (navigation) {
      const heading = current.panel.querySelector('.console-page-heading h1');
      const direction = Math.sign(viewOrder.indexOf(current.view) - viewOrder.indexOf(from.view)) || 1;
      titleChange('work', heading, 'X', direction * 4);
      surfaceChange('work', current.panel.querySelector('.console-task-surface, .console-table-wrap, .console-empty'), 'X', direction * 4);
    } else if (current.view === 'detail') {
      if (stepChanged) titleChange('work', byId('stage-title'));
      surfaceChange('work', current.panel.querySelector('.console-task-surface'));
    }
  });
}

// Cancelling never leaves inline opacity/transforms, and nothing resumes on return.
reduce.addEventListener('change', () => { if (reduce.matches) stopAll(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) stopAll(); });
window.addEventListener('pagehide', stopAll);
const hiddenObserver = new MutationObserver(() => {
  for (const records of groups.values()) for (const record of [...records]) {
    if (!visible(record.owner)) { record.animation.cancel(); finish(record); }
  }
});
for (const root of [preview, consoleRoot].filter(Boolean)) hiddenObserver.observe(root, {subtree: true, attributes: true, attributeFilter: ['hidden', 'inert']});
