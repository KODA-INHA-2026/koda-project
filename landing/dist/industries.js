(function () {
  'use strict';
  const explorer = document.querySelector('[data-industry-explorer]');
  if (!explorer) return;
  const tabs = Array.from(explorer.querySelectorAll('[data-sector]'));
  const panel = document.getElementById('industry-sector-panel');
  const viewport = explorer.querySelector('[data-industry-carousel]');
  const track = explorer.querySelector('[data-company-track]');
  const previous = explorer.querySelector('[data-industry-prev]');
  const next = explorer.querySelector('[data-industry-next]');
  const position = explorer.querySelector('[data-industry-position]');
  const filters = explorer.querySelector('[data-subindustry-filters]');
  const filterGroup = explorer.querySelector('.industry-filter-group');
  const search = document.getElementById('industry-query');
  const clearSearch = explorer.querySelector('.industry-search-clear');
  const message = explorer.querySelector('[data-industry-message]');
  const retry = explorer.querySelector('[data-industry-retry]');
  const progress = explorer.querySelector('[data-scroll-progress]');
  const progressTrack = explorer.querySelector('.industry-scroll-progress');
  const live = explorer.querySelector('[data-industry-live]');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const order = ['manufacturing', 'content', 'finance'];
  const copy = {
    manufacturing: {label: '수출·제조', workflow: 'export', title: ['입금과 청구서를,', '같은 근거로.'], description: '거래 상대 주소·입금 기록·청구 정보를 대조하는 샘플 업무를 살펴보세요.', action: '받은 대금 확인 시연', artifact: '주소와 입금', facts: ['거래 상대 주소', '입금 거래 정보', '원자료의 확인 범위']},
    content: {label: '게임·콘텐츠', workflow: 'game', title: ['등록한 주소에서,', '두 역할의 승인까지.'], description: '파트너별 등록 주소와 정산 요청을 대조한 뒤 A/B 역할 시연으로 이어집니다. 인증된 조직 승인을 의미하지 않습니다.', action: '정산할 주소 확인 시연', artifact: '등록과 요청', facts: ['파트너별 등록 주소', '정산 요청 내용', 'A/B 역할 시연']},
    finance: {label: '금융·자산운용', workflow: 'audit', title: ['보낼 거래를 고르고,', '받는 곳에서도 다시.'], description: '합성 수탁 기록과 요청을 대조하고 보낼 자료를 골라 받는 사람이 다시 검사하는 업무입니다. 감사 의견을 제공하지 않습니다.', action: '감사에 보낼 거래 시연', artifact: '거래와 자료', facts: ['수탁 거래 합성기록', '선택한 표시 항목', '받는 사람의 재검증']}
  };
  let sectors = new Map();
  let activeId = 'manufacturing';
  let renderedSector = null;
  let sectorMotion = null;
  let selectedSubindustry = '';
  let visibleCompanies = [];
  let scrollFrame = 0;
  let requestRevision = 0;
  let drag = null;
  let suppressClick = false;
  const setText = (selector, value) => { const node = explorer.querySelector(selector); if (node) node.textContent = value; };
  const announce = value => { if (live && live.textContent !== value) live.textContent = value; };
  const safeUrl = value => {
    try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
  };
  const normalise = value => String(value).trim().toLocaleLowerCase('ko-KR');
  const groupOf = company => (typeof company.industryGroup === 'string' && company.industryGroup.trim()) || company.subIndustry.trim();
  const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

  function lines(node, values) {
    node.replaceChildren();
    values.forEach((value, i) => { if (i) node.append(document.createElement('br')); node.append(document.createTextNode(value)); });
  }

  function setShowcase(id) {
    const sectorCopy = copy[id];
    explorer.querySelector('[data-sector-showcase]').dataset.sectorShowcase = id;
    setText('[data-sector-kicker]', sectorCopy.label + ' · 공개 합성자료 업무');
    lines(explorer.querySelector('[data-sector-headline]'), sectorCopy.title);
    setText('[data-sector-description]', sectorCopy.description);
    const action = explorer.querySelector('[data-sector-workspace]');
    action.href = `workspace.html?client=${sectorCopy.workflow}&view=detail&scenario=normal`;
    action.replaceChildren(document.createTextNode(sectorCopy.action + ' '));
    const arrow = element('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); action.append(arrow);
    setText('[data-sector-art-title]', sectorCopy.artifact);
    lines(explorer.querySelector('[data-sector-art-facts]'), sectorCopy.facts);
  }

  function updatePosition() {
    scrollFrame = 0;
    const cards = Array.from(track.children);
    if (!cards.length || viewport.hidden) { position.textContent = '—'; previous.disabled = true; next.disabled = true; return; }
    const left = viewport.scrollLeft;
    const width = viewport.clientWidth;
    const base = cards[0].offsetLeft;
    const shown = cards.map((card, index) => ({card, index, left: card.offsetLeft - base}))
      .filter(item => item.left + item.card.offsetWidth > left + 4 && item.left < left + width - 4);
    const first = shown[0]?.index ?? 0;
    const last = shown[shown.length - 1]?.index ?? first;
    position.textContent = `${String(first + 1).padStart(2, '0')}–${String(last + 1).padStart(2, '0')} / ${cards.length}`;
    previous.disabled = left <= 2;
    const finalCardVisible = cards[cards.length - 1].getBoundingClientRect().right <= viewport.getBoundingClientRect().right + 2;
    next.disabled = finalCardVisible || left >= viewport.scrollWidth - width - 2;
    const ratio = Math.min(1, Math.max(0, (left + width) / viewport.scrollWidth));
    progress.style.transform = `scaleX(${ratio})`;
  }

  function schedulePosition() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updatePosition);
  }

  function scrollToCard(index, smooth = true) {
    const cards = track.children;
    const card = cards[Math.min(Math.max(0, index), cards.length - 1)];
    if (!card) return;
    const left = card.offsetLeft - cards[0].offsetLeft;
    viewport.scrollTo({left, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'instant'});
    if (!smooth || reduceMotion.matches) updatePosition();
  }

  function firstCardIndex() {
    const cards = Array.from(track.children);
    const base = cards[0]?.offsetLeft || 0;
    const index = cards.findIndex(card => card.offsetLeft - base + card.offsetWidth > viewport.scrollLeft + 4);
    return Math.max(0, index);
  }

  function movePage(direction) {
    const first = track.children[0];
    if (!first) return;
    const gap = Number.parseFloat(window.getComputedStyle(track).columnGap) || 0;
    const perPage = Math.max(1, Math.floor((viewport.clientWidth + gap) / (first.offsetWidth + gap)));
    scrollToCard(firstCardIndex() + perPage * direction);
  }

  function makeCard(company, index) {
    const li = element('li'); li.dataset.companyId = company.id;
    const article = element('article', 'industry-company-card');
    const top = element('div', 'industry-card-top');
    top.append(element('span', '', String(index + 1).padStart(2, '0')), element('span', '', company.subIndustry));
    const name = element('h4', '', company.name);
    const useCase = element('p', 'industry-card-usecase', company.useCase);
    const source = element('div', 'industry-card-source');
    const link = element('a', '', '기업정보 출처 ');
    link.href = safeUrl(company.sourceUrl) || safeUrl(company.website);
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    link.setAttribute('aria-label', company.name + ' 기업정보 출처, 새 창');
    const arrow = element('span', '', '↗'); arrow.setAttribute('aria-hidden', 'true'); link.append(arrow);
    source.append(link, element('p', '', company.sourceNote));
    article.append(top, name, useCase, source); li.append(article); return li;
  }

  function showMessage(title, description, canRetry) {
    message.hidden = false;
    setText('[data-message-title]', title); setText('[data-message-copy]', description); retry.hidden = !canRetry;
  }

  function renderCompanies() {
    const sector = sectors.get(activeId);
    if (!sector) return;
    const query = normalise(search.value);
    visibleCompanies = sector.companies.filter(company => (!selectedSubindustry || groupOf(company) === selectedSubindustry) &&
      (!query || normalise(company.name + ' ' + company.subIndustry + ' ' + groupOf(company)).includes(query)));
    const fragment = document.createDocumentFragment();
    visibleCompanies.forEach((company, index) => fragment.append(makeCard(company, index)));
    track.replaceChildren(fragment);
    viewport.scrollTo({left: 0, behavior: 'instant'});
    viewport.hidden = visibleCompanies.length === 0;
    progressTrack.hidden = visibleCompanies.length === 0;
    clearSearch.hidden = search.value.length === 0;
    setText('[data-directory-title]', copy[activeId].label + '의 잠재 활용 기업');
    const filtered = query || selectedSubindustry;
    setText('[data-directory-summary]', `${sector.companies.length}개 기업${filtered ? ` 중 ${visibleCompanies.length}개 표시` : ' · 세부 업종과 활용 장면을 살펴보세요.'}`);
    if (!visibleCompanies.length) showMessage('조건에 맞는 기업이 없습니다.', '검색어를 줄이거나 다른 세부 업종을 선택해 주세요.', false);
    else message.hidden = true;
    schedulePosition();
    announce(`${copy[activeId].label}, ${visibleCompanies.length}개 기업 표시. 실제 고객·제휴 관계를 의미하지 않습니다.`);
  }

  function renderFilters() {
    const sector = sectors.get(activeId);
    const counts = new Map();
    sector.companies.forEach(company => { const group = groupOf(company); counts.set(group, (counts.get(group) || 0) + 1); });
    const make = (label, value, count) => {
      const button = element('button'); button.type = 'button'; button.dataset.subindustry = value;
      button.setAttribute('aria-pressed', String(value === selectedSubindustry));
      button.append(document.createTextNode(label), element('span', '', String(count)));
      button.addEventListener('click', () => {
        selectedSubindustry = value;
        filters.querySelectorAll('button').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.subindustry === value)));
        renderCompanies();
      });
      return button;
    };
    const fragment = document.createDocumentFragment();
    fragment.append(make('전체 업종', '', sector.companies.length));
    Array.from(counts).sort((a, b) => a[0].localeCompare(b[0], 'ko-KR')).forEach(([label, count]) => fragment.append(make(label, label, count)));
    filters.replaceChildren(fragment); filterGroup.hidden = false;
  }

  function activateSector(id, focus = false, persist = true) {
    if (!sectors.has(id)) return;
    if (renderedSector === id) { if (focus) tabs.find(tab => tab.dataset.sector === id)?.focus(); return; }
    const direction = Math.sign(order.indexOf(id) - order.indexOf(activeId)) || 1;
    const animateChange = renderedSector !== null && !reduceMotion.matches && !document.hidden;
    sectorMotion?.cancel();
    activeId = id; selectedSubindustry = ''; search.value = '';
    tabs.forEach(tab => { const selected = tab.dataset.sector === id; tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1; });
    panel.setAttribute('aria-labelledby', 'sector-tab-' + id);
    viewport.setAttribute('aria-label', copy[id].label + ' 잠재 활용 기업 목록');
    setShowcase(id); renderFilters(); renderCompanies();
    renderedSector = id;
    if (animateChange && typeof viewport.animate === 'function') sectorMotion = viewport.animate(
      [{transform: `translateX(${direction * 18}px)`, opacity: .8}, {transform: 'translateX(0)', opacity: 1}],
      {duration: 260, easing: 'cubic-bezier(.22,1,.36,1)'}
    );
    if (persist) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('sector') !== id) {
        url.searchParams.set('sector', id);
        window.history.pushState(window.history.state, '', url);
      }
    }
    if (focus) tabs.find(tab => tab.dataset.sector === id)?.focus();
  }

  function validate(data) {
    if (!data || data.classification !== 'prospective' || typeof data.notice !== 'string' || !data.notice.trim() || !Array.isArray(data.sectors)) throw new Error('Invalid sector data');
    const result = new Map();
    order.forEach(id => {
      const sector = data.sectors.find(item => item.id === id);
      if (!sector || sector.workflow !== copy[id].workflow || !Array.isArray(sector.companies) || sector.companies.length !== 100) throw new Error('Incomplete sector');
      const seen = new Set();
      for (const company of sector.companies) {
        if (!company || ['id', 'name', 'subIndustry', 'useCase', 'sourceNote'].some(key => typeof company[key] !== 'string' || !company[key].trim()) ||
          (company.industryGroup !== undefined && typeof company.industryGroup !== 'string') ||
          !safeUrl(company.sourceUrl) || !safeUrl(company.website) || seen.has(company.id)) throw new Error('Invalid company');
        seen.add(company.id);
      }
      result.set(id, sector);
    });
    return result;
  }

  async function load() {
    const revision = ++requestRevision;
    renderedSector = null;
    explorer.setAttribute('aria-busy', 'true'); retry.disabled = true; search.disabled = true;
    tabs.forEach(tab => { tab.disabled = true; }); previous.disabled = true; next.disabled = true;
    viewport.hidden = true; progressTrack.hidden = true; filterGroup.hidden = true;
    showMessage('기업 자료를 불러오고 있습니다.', '공식 자료에 근거한 기업 정보를 준비하고 있습니다.', false);
    try {
      const response = await fetch('assets/prospect-companies-v13.json');
      if (!response.ok) throw new Error('Company data unavailable');
      const data = validate(await response.json());
      if (revision !== requestRevision) return;
      sectors = data;
      tabs.forEach(tab => { tab.disabled = false; const count = tab.querySelector('[data-sector-count]'); count.textContent = data.get(tab.dataset.sector).companies.length + '개'; });
      search.disabled = false;
      const requested = new URL(window.location.href).searchParams.get('sector');
      activateSector(order.includes(requested) ? requested : activeId, false, false);
    } catch {
      if (revision !== requestRevision) return;
      track.replaceChildren(); position.textContent = '—';
      setText('[data-directory-summary]', '기업 목록을 아직 확인하지 못했습니다.');
      showMessage('기업 자료를 불러오지 못했습니다.', '연결을 확인한 뒤 다시 불러와 주세요. 아래의 샘플 업무 시연은 계속 열 수 있습니다.', true);
      announce('기업 자료를 불러오지 못했습니다. 다시 불러오기 버튼으로 재시도할 수 있습니다.');
    } finally {
      if (revision === requestRevision) { explorer.setAttribute('aria-busy', 'false'); retry.disabled = false; }
    }
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => activateSector(tab.dataset.sector));
    tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let nextIndex;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault(); activateSector(tabs[nextIndex].dataset.sector, true);
    });
  });
  previous.addEventListener('click', () => movePage(-1)); next.addEventListener('click', () => movePage(1));
  viewport.addEventListener('scroll', schedulePosition, {passive: true});
  viewport.addEventListener('keydown', event => {
    if (event.target !== viewport || event.altKey || event.ctrlKey || event.metaKey || !visibleCompanies.length) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); scrollToCard(firstCardIndex() + 1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); scrollToCard(firstCardIndex() - 1); }
    else if (event.key === 'Home') { event.preventDefault(); scrollToCard(0, false); }
    else if (event.key === 'End') { event.preventDefault(); scrollToCard(visibleCompanies.length - 1, false); }
  });
  viewport.addEventListener('focusin', event => {
    const card = event.target.closest('li[data-company-id]');
    if (!card || event.target === viewport) return;
    const left = card.offsetLeft - track.children[0].offsetLeft;
    if (left < viewport.scrollLeft || left + card.offsetWidth > viewport.scrollLeft + viewport.clientWidth) viewport.scrollTo({left, behavior: 'instant'});
  });
  viewport.addEventListener('pointerdown', event => {
    sectorMotion?.cancel();
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target.closest('a,button,input')) return;
    drag = {id: event.pointerId, x: event.clientX, scroll: viewport.scrollLeft, moved: false}; suppressClick = false;
    viewport.focus({preventScroll: true});
  });
  viewport.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; viewport.dataset.dragging = 'true'; viewport.setPointerCapture(event.pointerId); }
    if (drag.moved) { event.preventDefault(); viewport.scrollLeft = drag.scroll - dx; }
  });
  function stopDrag() {
    if (!drag) return;
    const finished = drag;
    suppressClick = finished.moved;
    drag = null;
    if (viewport.hasPointerCapture(finished.id)) viewport.releasePointerCapture(finished.id);
    delete viewport.dataset.dragging; schedulePosition();
  }
  viewport.addEventListener('pointerup', stopDrag); viewport.addEventListener('pointercancel', stopDrag); viewport.addEventListener('lostpointercapture', stopDrag);
  window.addEventListener('pointerup', stopDrag); window.addEventListener('pointercancel', stopDrag);
  viewport.addEventListener('click', event => { if (suppressClick) { event.preventDefault(); event.stopPropagation(); suppressClick = false; } }, true);
  search.addEventListener('input', event => { clearSearch.hidden = !search.value; if (!event.isComposing) renderCompanies(); });
  search.addEventListener('compositionend', renderCompanies);
  explorer.querySelector('.industry-search').addEventListener('submit', event => { event.preventDefault(); renderCompanies(); });
  clearSearch.addEventListener('click', () => { search.value = ''; renderCompanies(); search.focus(); });
  retry.addEventListener('click', load);
  const resize = new ResizeObserver(schedulePosition); resize.observe(viewport);
  reduceMotion.addEventListener('change', () => { if (reduceMotion.matches) { sectorMotion?.cancel(); viewport.scrollTo({left: viewport.scrollLeft, behavior: 'instant'}); stopDrag(); } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { sectorMotion?.cancel(); stopDrag(); viewport.scrollTo({left: viewport.scrollLeft, behavior: 'instant'}); } });
  window.addEventListener('pagehide', () => { stopDrag(); if (scrollFrame) window.cancelAnimationFrame(scrollFrame); });
  window.addEventListener('popstate', () => {
    const requested = new URL(window.location.href).searchParams.get('sector');
    if (sectors.size) activateSector(order.includes(requested) ? requested : 'manufacturing', false, false);
  });
  load();
})();
