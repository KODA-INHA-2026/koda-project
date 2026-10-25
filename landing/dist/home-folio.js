'use strict';
(() => {
  const instrument = document.querySelector('[data-signal-instrument]');
  if (!instrument) return;
  const buttons = [...instrument.querySelectorAll('[data-signal-case]')];
  const scenarios = new Set(['lookalike', 'normal']);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let revision = 0;
  let motionEpoch = 0;
  let requestedScenario = null;
  let settledScenario = null;

  const text = (selector, value) => {
    instrument.querySelectorAll(selector).forEach(element => { element.textContent = value; });
  };
  const stopMotion = () => {
    animations.forEach(animation => animation.cancel());
    animations.clear();
  };
  const suppressMotion = () => { motionEpoch++; stopMotion(); };
  const visible = () => instrument.isConnected && !document.hidden &&
    !instrument.closest('[hidden], [inert]') && instrument.getClientRects().length > 0 &&
    getComputedStyle(instrument).visibility !== 'hidden';
  const busy = value => {
    instrument.setAttribute('aria-busy', String(value));
    buttons.forEach(button => {
      if (value && button.dataset.signalCase === requestedScenario) button.setAttribute('aria-busy', 'true');
      else button.removeAttribute('aria-busy');
    });
  };
  const selectLinks = scenario => {
    document.querySelectorAll('[data-signal-open]').forEach(link => {
      link.href = `workspace.html?client=export&view=detail&scenario=${encodeURIComponent(scenario)}`;
    });
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.signalCase === scenario)));
  };

  function digits(selector, value, center) {
    instrument.querySelectorAll(selector).forEach(row => {
      const fragment = document.createDocumentFragment();
      for (let offset = -4; offset <= 4; offset++) {
        const span = document.createElement('span');
        span.textContent = value[center + offset] || '·';
        if (offset === 0) span.className = 'signal-focus-char';
        fragment.append(span);
      }
      row.setAttribute('aria-hidden', 'true');
      row.replaceChildren(fragment);
    });
  }

  function layers() {
    return [...instrument.querySelectorAll('[data-folio-silhouette]')].filter(element =>
      element.childElementCount === 0 && !element.textContent.trim() && element.closest('[aria-hidden="true"]'));
  }

  function capture() {
    if (reduce.matches || !visible()) return [];
    return layers().map(element => ({
      element,
      rect: element.getBoundingClientRect(),
      transform: getComputedStyle(element).transform,
      width: element.offsetWidth,
      height: element.offsetHeight
    }));
  }

  function alignPapers(first, own, epoch) {
    if (own !== revision || epoch !== motionEpoch || reduce.matches || !visible()) return;
    for (const before of first) {
      const element = before.element;
      if (!element.isConnected || typeof element.animate !== 'function') continue;
      const after = element.getBoundingClientRect();
      const finalTransform = getComputedStyle(element).transform;
      let from = before.transform;
      // CSS transform is the preferred final-state contract. Also handle a skin
      // whose fixed-layout position changed, without moving its readable content.
      if (from === finalTransform) {
        const x = before.rect.left - after.left;
        const y = before.rect.top - after.top;
        const sx = before.width && element.offsetWidth ? before.width / element.offsetWidth : 1;
        const sy = before.height && element.offsetHeight ? before.height / element.offsetHeight : 1;
        if (Math.abs(x) < .5 && Math.abs(y) < .5 && Math.abs(sx - 1) < .002 && Math.abs(sy - 1) < .002) continue;
        from = `translate(${x}px,${y}px) scale(${sx},${sy}) ${finalTransform === 'none' ? '' : finalTransform}`;
      }
      try {
        const animation = element.animate([{transform: from}, {transform: finalTransform}], {
          duration: 400, easing: 'cubic-bezier(.22,1,.36,1)'
        });
        animations.add(animation);
        const release = () => animations.delete(animation);
        animation.addEventListener('finish', release, {once: true});
        animation.addEventListener('cancel', release, {once: true});
      } catch { /* The final CSS state remains usable without motion. */ }
    }
  }

  function expiry(value) {
    if (value === null || value === undefined || value === '') return '—';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '—';
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date) + ' KST';
  }

  function prepare(data, result) {
    const fields = Array.isArray(data?.addressFields) ? data.addressFields : [];
    const field = fields.find(item => item.path === 'counterparty') || fields.find(item =>
      typeof item.value === 'string' && typeof item.expected === 'string' && item.value.toLowerCase() !== item.expected.toLowerCase());
    if (!field || typeof field.expected !== 'string' || typeof field.value !== 'string' || !Array.isArray(result?.checks)) {
      throw new Error('Address result unavailable');
    }
    const signature = result.checks.find(check => check.id === 'source_signature');
    const target = result.checks.find(check => check.id === 'counterparty');
    const maxLength = Math.max(field.value.length, field.expected.length);
    let center = 20;
    for (let i = 0; i < maxLength; i++) {
      if (field.value[i]?.toLowerCase() !== field.expected[i]?.toLowerCase()) { center = i; break; }
    }
    const label = (check, pass, fail) => check?.passed === true ? pass : check?.passed === false ? fail : '미확인';
    const passed = result.passed === true;
    const mismatch = target?.passed === false;
    const sourceFailed = signature?.passed === false;
    const decision = passed ? '확인한 근거를, 다음 업무로.' : mismatch ? '주소가 달라, 여기서 멈춥니다.' : sourceFailed ? '원자료 서명을 확인할 수 없습니다.' : '주소 대조를 완료하지 못했습니다.';
    const next = passed ? '같은 근거로 청구서와 입금을 맞춰볼 수 있습니다.' : mismatch ?
      (signature?.passed === true ? '서명은 유효해도 이 요청에 사용할 수 없습니다.' : '요청 주소와 원자료를 다시 확인해 주세요.') : '업무 화면에서 자료와 검사 항목을 다시 확인해 주세요.';
    const comparison = mismatch ? `${center - 1}번째 글자: 원자료 ${field.expected[center] || '없음'}, 요청 ${field.value[center] || '없음'}. ${signature?.passed === true ? '서명이 유효해도 주소는 다릅니다.' : '주소가 일치하지 않습니다.'}` : target?.passed === true ?
      '주소 전체가 일치합니다. 원자료 서명과 주소는 별도로 확인합니다.' : '원자료를 확인할 수 없어 주소 일치를 판정하지 않았습니다.';
    return {field, center, decision, next, comparison, signature: label(signature, '유효', '확인 불가'),
      target: label(target, '일치', '불일치'), state: target?.passed === true ? 'match' : mismatch ? 'mismatch' : 'unchecked',
      record: result.recordId || '—', expires: expiry(result.validUntil)};
  }

  function commit(view, scenario) {
    digits('[data-signal-source]', view.field.expected, view.center);
    digits('[data-signal-request]', view.field.value, view.center);
    text('[data-signal-full-source]', view.field.expected);
    text('[data-signal-full-request]', view.field.value);
    text('[data-signal-position]', `0x 뒤 ${view.center - 1}번째 글자`);
    text('[data-signal-signature]', view.signature);
    text('[data-signal-target]', view.target);
    text('[data-signal-decision]', view.decision);
    text('[data-signal-next]', view.next);
    text('[data-signal-record]', view.record);
    text('[data-signal-expiry]', view.expires);
    text('[data-signal-comparison]', view.comparison);
    selectLinks(scenario);
    instrument.dataset.state = view.state;
  }

  async function select(scenario, animate = true) {
    if (!scenarios.has(scenario) || requestedScenario === scenario) return;
    const own = ++revision;
    const epoch = motionEpoch;
    const mayMove = animate && !reduce.matches && visible();
    requestedScenario = scenario;
    stopMotion();
    // Returning to the still-visible settled case cancels a pending request.
    if (settledScenario === scenario) { busy(false); return; }
    busy(true);
    try {
      const core = window.KODA_ASSURANCE;
      if (!core) throw new Error('Verifier unavailable');
      await core.ready;
      if (own !== revision) return;
      const data = core.getCase('export', scenario);
      const result = await core.verify('export', scenario);
      if (own !== revision) return;
      const view = prepare(data, result);
      const first = mayMove && epoch === motionEpoch ? capture() : [];
      commit(view, scenario);
      settledScenario = scenario;
      busy(false);
      if (mayMove) alignPapers(first, own, epoch);
    } catch {
      if (own !== revision) return;
      settledScenario = null;
      requestedScenario = null;
      selectLinks(scenario);
      instrument.dataset.state = 'error';
      text('[data-signal-signature]', '미확인');
      text('[data-signal-target]', '미확인');
      text('[data-signal-decision]', '자료를 다시 확인해 주세요.');
      text('[data-signal-next]', '상황을 다시 누르거나 업무 화면에서 자료를 불러올 수 있습니다.');
      text('[data-signal-comparison]', '자료를 불러오지 못했습니다. 상황을 다시 눌러 확인해 주세요.');
      text('[data-signal-full-source]', '확인하지 못함');
      text('[data-signal-full-request]', '확인하지 못함');
      text('[data-signal-record]', '—');
      text('[data-signal-expiry]', '—');
      text('[data-signal-position]', '주소 미확인');
      digits('[data-signal-source]', '', 20);
      digits('[data-signal-request]', '', 20);
    } finally {
      if (own === revision) busy(false);
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => select(button.dataset.signalCase)));
  reduce.addEventListener('change', () => { if (reduce.matches) suppressMotion(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) suppressMotion(); });
  window.addEventListener('pagehide', suppressMotion);
  const observer = new MutationObserver(() => { if (!visible()) suppressMotion(); });
  for (let parent = instrument; parent; parent = parent.parentElement) {
    observer.observe(parent, {attributes: true, attributeFilter: ['hidden', 'inert']});
  }
  const initial = buttons.find(button => button.getAttribute('aria-pressed') === 'true')?.dataset.signalCase;
  select(scenarios.has(initial) ? initial : 'lookalike', false);
})();
