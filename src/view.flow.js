// 目标流程图：纵向事务列表 + 主链/额外箭头 + 背景分区 + 十字网格明细
Views.flow = (() => {
  let gid = null;
  let opts = {};
  let maskEl = null;
  let linkFrom = null;   // 正在“链接”的源方块 id
  let linkWhich = null;  // 'next' | 'prev'
  let menuId = null;     // 当前展开菜单的方块 id
  let showZones = false;

  const MAX_ZONES = 6;
  const ZONE_DEFAULT = [{ label: '流程', color: '#eef3fd' }];

  function goal() { return Store.getGoals().find((g) => g.id === gid); }
  function esc(s) { return UI.esc(s); }
  function durText(n) {
    if (n.duration == null || n.duration === '') return '<span class="muted">未填时间</span>';
    return (Math.round(n.duration * 10) / 10) + 'h';
  }
  function fmt(h) { return (Math.round(h * 10) / 10).toString(); }

  // 把 #rrggbb / #rgb 转成带透明度的 rgba
  function hexToRgba(hex, a) {
    let h = (hex || '#e3e9f7').replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    if (isNaN(n)) return `rgba(227,233,247,${a})`;
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return `rgba(${r},${g},${b},${a})`;
  }
  // 一个事务默认指向 flow 数组中的下一个事务（线性链）；显式 next 优先
  function defaultNext(flow, n) {
    const i = flow.findIndex((x) => x.id === n.id);
    if (i < 0 || i + 1 >= flow.length) return null;
    return flow[i + 1].id;
  }

  function open(id, o) {
    gid = id; opts = o || {};
    linkFrom = linkWhich = menuId = null;
    showZones = false;
    maskEl = UI.open('');
    const modal = maskEl.querySelector('.modal');
    modal.classList.add('flow-modal');
    renderBody();
    return maskEl;
  }

  function renderBody() {
    const g = goal(); if (!g || !maskEl) return;
    const stat = Store.getFlowProgress(g);
    const nodes = (g.flow || []).slice();
    const zones = (g.bgZones && g.bgZones.length) ? g.bgZones : ZONE_DEFAULT.slice();

    const topBar = `
      <div class="flow-top">
        <button class="btn btn-sm" data-fback>← 返回目标</button>
        <div class="flow-title">
          <div class="ft-name">${esc(g.title) || '未命名目标'}</div>
          <div class="ft-prog"><span class="prog-pct">${g.progress || 0}%</span>
            <span class="ft-detail">${stat.totalMin > 0 ? '已完成 ' + fmt(stat.doneMin) + 'h / 预计 ' + fmt(stat.totalMin) + 'h' : (stat.total ? stat.done + '/' + stat.total + ' 步完成' : '尚未建事务')}</span>
          </div>
        </div>
        <button class="btn btn-sm btn-primary" data-fadd>＋ 添加事务</button>
        <button class="btn btn-sm" data-fzones>背景分区 ${showZones ? '▴' : '▾'}</button>
      </div>
    `;

    const linkBar = linkFrom
      ? `<div class="flow-link-hint">🔗 正在“${
          linkWhich === 'next' ? '链接下一步' : '链接上一步'
        }”——请点击要${linkWhich === 'next' ? '指向' : '作为上一步'}的方块（点同一方块或这里取消）<button class="btn btn-sm" data-clink>取消</button></div>`
      : '';

    const zonesPanel = showZones ? `
      <div class="flow-zones">
        ${zones.map((z, i) => `
          <div class="zone-row">
            <span class="zone-idx">${i + 1}</span>
            <input class="input zone-name" value="${esc(z.label)}" data-zname="${i}" placeholder="分区名"/>
            <input type="color" value="${z.color}" data-zcolor="${i}" class="zone-color"/>
            <button class="btn btn-sm btn-danger" data-zdel="${i}" ${zones.length <= 1 ? 'disabled' : ''}>删</button>
          </div>`).join('')}
        <div class="zone-acts">
          <button class="btn btn-sm" data-zadd ${zones.length >= MAX_ZONES ? 'disabled' : ''}>＋ 添加分区</button>
          <button class="btn btn-sm" data-zreset>重置</button>
          <span class="zones-tip">每个分区是一列，可放多个事务；底色按列分色，最多 ${MAX_ZONES} 列</span>
        </div>
      </div>` : '';

    const empty = nodes.length === 0
      ? `<div class="flow-empty">还没有事务，点右上角「＋ 添加事务」开始建立流程图</div>` : '';

    // —— 按分区（列）分组 ——
    const groups = [];
    nodes.forEach((n) => {
      let z = Number(n.zone); if (!isFinite(z) || z < 0) z = 0;
      if (z >= zones.length) z = Math.max(0, zones.length - 1);
      (groups[z] = groups[z] || []).push(n);
    });
    const zoneCount = Math.max(1, groups.length);

    // 单个事务方块的 HTML
    const taskHtml = (n, i, z) => {
      const target = n.next ? nodes.find((x) => x.id === n.next) : null;
      const isSrc = linkFrom === n.id;
      const zonePick = zones.map((zd, zi) => `
        <button data-zset="${zi}" ${zi === z ? 'class="cur"' : ''}>◎ 分区 ${zi + 1}（${esc(zd.label || ('分区' + (zi + 1)))}）</button>`).join('');
      const menu = menuId === n.id ? `
        <div class="fmenu">
          <button data-mact="edit">${n.done ? '查看 / 编辑' : '更改'}</button>
          <button data-mact="done">${n.done ? '标记为未完成' : '确认完成'}</button>
          <div class="fmenu-sep"></div>
          <button data-mact="link-next">链接下一步</button>
          <button data-mact="link-prev">链接上一步</button>
          <div class="fmenu-sep"></div>
          <div class="fmenu-label">移到分区</div>
          ${zonePick}
          <div class="fmenu-sep"></div>
          <button data-mact="del" class="danger">删除</button>
        </div>` : '';
      return `
        <div class="frow ${n.done ? 'done' : ''} ${isSrc ? 'linking' : ''}" data-id="${n.id}" data-zone="${z}">
          <div class="fmeta">
            <span class="fseq"><span>${i + 1}</span></span>
            <div class="fmove">
              <button data-move="-1" title="上移（前）">‹</button>
              <button data-move="1" title="下移（后）">›</button>
            </div>
          </div>
          <div class="fcard">
            <div class="fcard-top">
              <span class="fdot ${n.done ? 'on' : ''}"></span>
              <span class="ftitle">${esc(n.title) || '(未命名事务)'}</span>
              <span class="fdur ${n.done ? 'on' : ''}">${durText(n)}</span>
            </div>
            ${target ? `<div class="fjump">↳ ${esc(target.title) || '(未命名)'}</div>` : ''}
            <div class="fmenu-wrap">
              <button class="fmenu-btn" data-mbtn title="操作">⋯</button>
              ${menu}
            </div>
          </div>
        </div>`;
    };

    // —— 分区列 ——
    const cols = [];
    for (let z = 0; z < zoneCount; z++) {
      const zd = zones[z] || { label: '分区' + (z + 1), color: '#e3e9f7' };
      const zt = groups[z] || [];
      cols.push(`
        <div class="flow-zone" data-zone="${z}" style="background:${hexToRgba(zd.color, 0.16)};border-color:${hexToRgba(zd.color, 0.5)}">
          <div class="zone-cap"><span class="zone-dot" style="background:${esc(zd.color)}"></span><span class="zone-title">${esc(zd.label) || ('分区' + (z + 1))}</span><span class="zone-count">${zt.length}</span></div>
          <div class="zone-tasks">
            ${zt.length ? zt.map((n, j) => taskHtml(n, nodes.indexOf(n), z)).join('') : '<div class="zone-empty">（空 · 可在事务菜单移到此处）</div>'}
          </div>
        </div>`);
    }

    maskEl.querySelector('.modal').innerHTML = `
      <div class="flow-shell">
        ${topBar}
        ${linkBar}
        ${zonesPanel}
        <div class="flow-canvas">
          <div class="flow-inner">
            <div class="flow-zones-row">
              ${cols.join('')}
            </div>
            ${empty}
          </div>
        </div>
      </div>`;
    bindFlow();
    drawArrows();
  }

  function refreshTopBar() {
    const g = goal(); if (!g) return;
    const stat = Store.getFlowProgress(g);
    const el = maskEl.querySelector('.flow-title');
    if (el) el.querySelector('.prog-pct').textContent = (g.progress || 0) + '%';
    const d = el.querySelector('.ft-detail');
    if (d) d.textContent = stat.totalMin > 0
      ? '已完成 ' + fmt(stat.doneMin) + 'h / 预计 ' + fmt(stat.totalMin) + 'h'
      : (stat.total ? stat.done + '/' + stat.total + ' 步完成' : '尚未建事务');
  }

  // 在流程画布上绘制箭头：显式 next 优先，否则沿数组线性链；天然支持多对一汇聚
  function drawArrows() {
    const inner = maskEl.querySelector('.flow-inner'); if (!inner) return;
    const g = goal(); if (!g || !(g.flow || []).length) return;
    const flow = g.flow.slice();
    const byId = {}; flow.forEach((n) => { byId[n.id] = n; });
    const rows = {}; inner.querySelectorAll('.frow').forEach((r) => { rows[r.dataset.id] = r; });
    const iRect = inner.getBoundingClientRect();
    const rc = (el) => {
      const a = el.getBoundingClientRect();
      return {
        l: a.left - iRect.left, t: a.top - iRect.top,
        r: a.right - iRect.left, b: a.bottom - iRect.top,
        cx: (a.left + a.right) / 2 - iRect.left, cy: (a.top + a.bottom) / 2 - iRect.top,
      };
    };
    const defs = `<defs><marker id="farr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7.5" markerHeight="7.5" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="#8f99a8"/></marker></defs>`;
    let paths = '';
    flow.forEach((n) => {
      const src = rows[n.id]; if (!src) return;
      const sid = (n.next && byId[n.next]) ? n.next : defaultNext(flow, n);
      if (!sid || sid === n.id) return;
      const tgt = rows[sid]; if (!tgt) return;
      const sRow = rc(src), tRow = rc(tgt);
      const sc = rc(src.querySelector('.fcard')), tc = rc(tgt.querySelector('.fcard'));
      const sz = Number(src.dataset.zone), tz = Number(tgt.dataset.zone);
      let path;
      if (tz > sz) {
        const mid = (sc.r + tc.l) / 2 - 6;
        path = `M ${sc.r} ${sc.cy} H ${mid} V ${tc.cy} H ${tc.l}`;
      } else if (tz < sz) {
        const mid = (sc.l + tc.r) / 2 + 6;
        path = `M ${sc.l} ${sc.cy} H ${mid} V ${tc.cy} H ${tc.r}`;
      } else if (tRow.cy >= sRow.cy) {
        const mid = (sRow.b + tRow.t) / 2;
        path = `M ${sc.cx} ${sRow.b} V ${mid} H ${tc.cx} V ${tRow.t}`;
      } else {
        const mid = (sRow.t + tRow.b) / 2;
        path = `M ${sc.cx} ${sRow.t} V ${mid} H ${tc.cx} V ${tRow.b}`;
      }
      paths += `<path d="${path}" marker-end="url(#farr)"></path>`;
    });
    let svg = inner.querySelector('svg.flow-arrows');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'flow-arrows');
      inner.appendChild(svg);
    }
    svg.setAttribute('width', Math.max(inner.scrollWidth, iRect.width));
    svg.setAttribute('height', Math.max(inner.scrollHeight, iRect.height));
    svg.innerHTML = defs + paths;
  }

  function bindFlow() {
    // 返回
    const back = maskEl.querySelector('[data-fback]');
    if (back) back.addEventListener('click', () => { UI.close(maskEl); maskEl = null; if (opts.onBack) opts.onBack(); });

    // 添加事务
    const add = maskEl.querySelector('[data-fadd]');
    if (add) add.addEventListener('click', () => {
      const ng = Store.addFlow(gid, {});
      const nid = ng.flow[ng.flow.length - 1].id;
      renderBody();
      openDetail(nid, 'edit');
    });

    // 背景分区折叠
    const zt = maskEl.querySelector('[data-fzones]');
    if (zt) zt.addEventListener('click', () => { showZones = !showZones; renderBody(); });

    // 链接模式取消
    const cl = maskEl.querySelector('[data-clink]');
    if (cl) cl.addEventListener('click', () => { linkFrom = linkWhich = null; renderBody(); });

    // 分区操作
    maskEl.querySelectorAll('[data-zname]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const g = goal(); if (!g) return;
        g.bgZones[Number(inp.dataset.zname)].label = inp.value;
        Store.updateGoal(gid, { bgZones: g.bgZones });
      }));
    maskEl.querySelectorAll('[data-zcolor]').forEach((inp) =>
      inp.addEventListener('input', () => {
        const g = goal(); if (!g) return;
        if (!g.bgZones) g.bgZones = ZONE_DEFAULT.slice();
        g.bgZones[Number(inp.dataset.zcolor)].color = inp.value;
        Store.updateGoal(gid, { bgZones: g.bgZones });
        renderBody();
      }));
    const zAdd = maskEl.querySelector('[data-zadd]');
    if (zAdd) zAdd.addEventListener('click', () => {
      const g = goal(); if (!g) return;
      if (!g.bgZones) g.bgZones = ZONE_DEFAULT.slice();
      if (g.bgZones.length >= MAX_ZONES) return;
      g.bgZones.push({ label: '分区' + (g.bgZones.length + 1), color: '#e3e9f7' });
      Store.updateGoal(gid, { bgZones: g.bgZones });
      renderBody();
    });
    const zReset = maskEl.querySelector('[data-zreset]');
    if (zReset) zReset.addEventListener('click', () => {
      Store.updateGoal(gid, { bgZones: null });
      renderBody();
    });
    maskEl.querySelectorAll('[data-zdel]').forEach((b) =>
      b.addEventListener('click', () => {
        const g = goal(); if (!g || g.bgZones.length <= 1) return;
        g.bgZones.splice(Number(b.dataset.zdel), 1);
        Store.updateGoal(gid, { bgZones: g.bgZones });
        renderBody();
      }));

    // 上移 / 下移
    maskEl.querySelectorAll('[data-move]').forEach((b) =>
      b.addEventListener('click', () => {
        const row = b.closest('.frow');
        Store.moveFlow(gid, row.dataset.id, Number(b.dataset.move));
        linkFrom = linkWhich = null; renderBody();
      }));

    // 行点击（链接模式下选择目标）
    maskEl.querySelectorAll('.frow').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.fmenu, [data-mbtn], [data-move]')) return;
        const id = row.dataset.id;
        if (linkFrom) {
          if (linkFrom === id) { linkFrom = linkWhich = null; renderBody(); return; }
          if (linkWhich === 'next') Store.linkFlow(gid, linkFrom, id);
          else Store.linkFlow(gid, id, linkFrom);
          linkFrom = linkWhich = null; renderBody();
        }
      });
    });

    // 菜单开关
    maskEl.querySelectorAll('[data-mbtn]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.closest('.frow').dataset.id;
        menuId = (menuId === id) ? null : id;
        renderBody();
      }));

    // 菜单操作
    maskEl.querySelectorAll('[data-mact]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = b.closest('.frow').dataset.id;
        const act = b.dataset.mact;
        menuId = null;
        if (act === 'edit') { renderBody(); openDetail(id, 'edit'); }
        else if (act === 'done') {
          const nd = goal().flow.find((x) => x.id === id);
          if (nd && nd.done) { Store.updateFlow(gid, id, { done: false }); renderBody(); }
          else { renderBody(); openDetail(id, 'done'); }
        }
        else if (act === 'link-next') { linkFrom = id; linkWhich = 'next'; renderBody(); }
        else if (act === 'link-prev') { linkFrom = id; linkWhich = 'prev'; renderBody(); }
        else if (act === 'del') {
          UI.confirm('删除该事务？', () => {
            Store.deleteFlow(gid, id); renderBody();
          });
        }
      });
    });

    // 移到目标分区
    maskEl.querySelectorAll('[data-zset]').forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const row = b.closest('.frow'); if (!row) return;
        Store.updateFlow(gid, row.dataset.id, { zone: Number(b.dataset.zset) });
        menuId = null; renderBody();
      });
    });
  }

  // 事务十字网格明细
  function openDetail(id, mode) {
    const g = goal(); if (!g) return;
    const node = g.flow.find((x) => x.id === id); if (!node) return;
    const lock = mode === 'done';
    if (lock) Store.updateFlow(gid, id, { done: true });

    const dm = UI.open(`
      <div class="modal-title">事务明细（${lock ? '已确认完成' : '编辑'}）</div>
      <div class="d-state">
        <span class="d-tab ${node.done ? '' : 'on-undo'}" data-state="0">◯ 未完成</span>
        <span class="d-tab ${node.done ? 'on-done' : ''}" data-state="1">✔ 完成</span>
      </div>
      ${lock ? '<div class="d-lock">🔒 已确认完成：内容与时间已锁定，只能在上方切换 完成 / 未完成</div>' : ''}
      <div class="d-body">
        <div class="field"><label>事务内容</label><textarea class="input" data-dtitle ${lock ? 'readonly' : ''}>${esc(node.title || '')}</textarea></div>
        <div class="field"><label>预计需要时间（小时，可留空）</label>
          <input class="input" data-ddur type="number" min="0" step="0.5" style="width:150px" value="${node.duration == null ? '' : node.duration}" ${lock ? 'readonly' : ''}/></div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-close>${lock ? '关闭' : '取消'}</button>
        ${lock ? '' : '<button class="btn btn-primary" data-save>保存</button>'}
      </div>
    `);

    dm.querySelectorAll('[data-state]').forEach((t) =>
      t.addEventListener('click', () => {
        const v = t.dataset.state === '1';
        Store.updateFlow(gid, id, { done: v });
        dm.querySelectorAll('[data-state]').forEach((x) => {
          x.classList.toggle('on-undo', x.dataset.state === '0' && !v);
          x.classList.toggle('on-done', x.dataset.state === '1' && v);
        });
        refreshTopBar();
      }));
    dm.querySelector('[data-close]').addEventListener('click', () => { UI.close(dm); });
    const save = dm.querySelector('[data-save]');
    if (save) save.addEventListener('click', () => {
      const title = dm.querySelector('[data-dtitle]').value.trim();
      const raw = dm.querySelector('[data-ddur]').value;
      let duration = null;
      if (raw !== '') { const n = Number(raw); if (isFinite(n) && n >= 0) duration = n; }
      Store.updateFlow(gid, id, { title, duration });
      UI.close(dm);
      renderBody();
    });
  }

  return { open, renderBody };
})();
