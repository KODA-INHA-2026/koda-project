/* Read-only companion to home-folio's authoritative comparison result. */
(function () {
  'use strict';
  const reader = document.querySelector('[data-evidence-reader]');
  if (!reader) return;
  const tablist = reader.querySelector('[role="tablist"]');
  const tabs = Array.from(reader.querySelectorAll('[role="tab"]'));
  const panels = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));
  if (!tablist || tabs.length !== 3 || panels.some(panel => !panel)) return;

  const live = reader.querySelector('[data-evidence-live]');
  const set = (name, value) => {
    const node = reader.querySelector(`[data-evidence="${name}"]`);
    if (node) node.textContent = String(value);
  };
  const announce = message => { if (live && live.textContent !== message) live.textContent = message; };
  const stateOf = check => check?.passed === true ? 'passed' : check?.passed === false ? 'failed' : 'not_checked';
  const labels = {passed: '확인됨', failed: '확인 불가', not_checked: '미확인'};

  function select(index, focus) {
    tablist.style.setProperty('--evidence-tab-index', index);
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index, false));
    tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next, true);
    });
  });

  panels.forEach(panel => { panel.setAttribute('role', 'tabpanel'); panel.tabIndex = 0; });
  reader.dataset.enhanced = 'true';
  const rail = document.createElement('span');
  rail.className = 'evidence-tab-rail';
  rail.setAttribute('aria-hidden', 'true');
  rail.append(document.createElement('span'));
  tablist.append(rail);
  tablist.hidden = false;
  select(0, false);

  function renderChecks(checks) {
    reader.querySelectorAll('[data-evidence-check]').forEach(node => {
      const check = checks.find(item => item.id === node.dataset.evidenceCheck);
      const status = stateOf(check);
      node.dataset.status = status;
      node.textContent = labels[status];
    });
  }

  function setTime(name, value) {
    const node = reader.querySelector(`[data-evidence="${name}"]`);
    if (!node) return;
    const date = typeof value === 'string' ? new Date(value) : null;
    if (!date || !Number.isFinite(date.getTime())) {
      node.textContent = '미확인';
      node.removeAttribute('datetime');
      return;
    }
    node.setAttribute('datetime', value);
    node.textContent = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(date) + ' KST';
  }

  function clear(status) {
    reader.dataset.state = status;
    reader.setAttribute('aria-busy', String(status === 'loading'));
    renderChecks([]);
    set('record-id', status === 'loading' ? '원자료를 불러오는 중' : '확인하지 못함');
    set('issuer-label', '산학프로젝트 샘플 발급키');
    set('issuer-id', '미확인');
    set('fingerprint', '미확인');
    set('source-address', status === 'loading' ? '원자료를 불러오는 중' : '확인하지 못함');
    set('request-address', status === 'loading' ? '요청을 불러오는 중' : '확인하지 못함');
    ['reference-time', 'checked-time', 'expiry-time'].forEach(name => setTime(name, null));
    const targetResult = reader.querySelector('[data-evidence-target-result]');
    if (targetResult) targetResult.dataset.status = 'not_checked';
    set('target-verdict', '미확인');
    set('target-explanation', '원자료의 신뢰·유효성을 확인하기 전에는 주소 일치를 판정하지 않습니다.');
    const message = status === 'loading' ?
      '선택한 자료를 검사하고 있습니다. 이전 결과는 이번 요청의 근거로 사용하지 않습니다.' :
      '자료를 확인하지 못했습니다. 아래 주소 대조에서 상황을 다시 선택하거나 업무 화면에서 확인해 주세요.';
    set('state-message', message);
    announce(status === 'loading' ? '선택한 자료 검사 중입니다. 이전 확인 결과를 지웠습니다.' : '자료를 확인하지 못했습니다. 주소 대조에서 상황을 다시 선택해 주세요.');
  }

  function render(detail) {
    if (!detail || detail.status !== 'ready') {
      clear(detail?.status === 'loading' ? 'loading' : 'error');
      return;
    }
    const {data, result} = detail;
    const fields = Array.isArray(data?.addressFields) ? data.addressFields : [];
    const address = fields.find(field => field.path === 'counterparty');
    if (!data || !result || !Array.isArray(result.checks) || !address ||
      typeof address.expected !== 'string' || typeof address.value !== 'string') {
      clear('error');
      return;
    }
    reader.dataset.state = 'ready';
    reader.setAttribute('aria-busy', 'false');
    set('record-id', result.recordId || '미확인');
    set('issuer-label', result.issuer?.label || '산학프로젝트 샘플 발급키');
    set('issuer-id', result.issuer?.id || '미확인');
    set('fingerprint', result.issuer?.fingerprint || '미확인');
    setTime('reference-time', result.referenceTime);
    setTime('checked-time', result.checkedAt);
    setTime('expiry-time', result.validUntil);
    set('source-address', address.expected);
    set('request-address', address.value);
    renderChecks(result.checks);

    const target = result.checks.find(check => check.id === 'counterparty');
    const signature = result.checks.find(check => check.id === 'source_signature');
    const status = stateOf(target);
    const targetResult = reader.querySelector('[data-evidence-target-result]');
    if (targetResult) targetResult.dataset.status = status;
    const verdict = status === 'passed' ? '일치' : status === 'failed' ? '불일치' : '미확인';
    const explanation = status === 'passed' ?
      '42자리 전체 거래 상대 주소가 원자료와 일치합니다. 지갑 소유권을 판정한 결과는 아닙니다.' : status === 'failed' ?
      (signature?.passed === true ? '원자료 서명은 유효하지만 요청의 거래 상대 주소가 다릅니다. 이 요청에는 사용할 수 없습니다.' : '요청의 거래 상대 주소가 원자료와 다릅니다. 요청과 근거를 다시 확인해 주세요.') :
      '원자료의 신뢰·유효성을 확인할 수 없어 주소 일치를 판정하지 않았습니다.';
    set('target-verdict', verdict);
    set('target-explanation', explanation);
    const message = result.passed === true ?
      '이 요청은 원자료 대조 항목을 통과했습니다. 승인·실행·수령·대사는 별도 증거가 필요한 미확인 사실입니다.' :
      '이 요청은 원자료 대조를 통과하지 못했습니다. 확인됨·불일치·미확인을 각각 나누어 살펴보세요.';
    set('state-message', message);
    announce(`원자료 서명 ${labels[stateOf(signature)]}, 거래 상대 주소 ${verdict}. 거래 완료에 관한 여섯 사실은 미확인입니다.`);
  }

  window.addEventListener('koda:comparison-state', event => render(event.detail));
})();
