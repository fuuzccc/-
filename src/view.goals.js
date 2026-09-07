// 目标视图：远期 / 中期 / 短期 三层分组 + 可嵌套的文件夹式目标
Views.goals = (() => {
  const DAY = 86400000;
  let expanded = new Set();   // 已展开（含子目标并显示）的目标 id
  let collapsedGroups = new Set(); // 已折叠的分组 key

  function remainBadge(g) {
    const r = Store.goalRemainDays(g);
    if (r === null) return `<span class="goal-count ok">未设截止</span>`;
    const today = Store.todayStr();
    if (g.deadline && g.deadline < today) return `<span class="goal-count due">已超期 ${Math.abs(r)} 天</span>`;
    if (r === 0) return `<span class="goal-count due">今天截止</span>`;
    if (r <= 3) return `<span class="goal-count due">剩 ${r} 天</span>`;
    if (r <= 14) return `<span class="goal-count soon">剩 ${r} 天</span>`;
    return `<span class="goal-count ok">剩 ${r} 天</span>`;
  }

  function childrenOf(id) {
    return Store.getGoals().filter((g) => g.parentId === id);
  }
  function fmtH(h) { return (Math.round(h * 10) / 10).toString(); }

  function goalNode(g, depth) {
    const children = childrenOf(g.id);
    const isFolder = children.length > 0;
    const open = expanded.has(g.id);
    const hot = g.deadline && g.progress < 100;
    const today = Store.todayStr();
    const overdue = g.deadline && g.deadline < today;
    const flowCount = (g.flow || []).length;
    const doneAll = flowCount > 0 && g.flow.every((s) => s.done);
    const stat = Store.getFlowProgress(g);

    let tags = '';
    Store.parseTags(g.tags).forEach((t) => tags += `<span class="tag">${UI.esc(t)}</span>`);

    let flowBrief = flowCount === 0
      ? ' · 尚未建流程'
      : ` · ${flowCount} 步流程${stat.totalMin > 0 ? ' · 预计 ' + fmtH(stat.totalMin) + 'h' : ''}` +
        `${stat.doneMin > 0 ? ' · 已完成 ' + fmtH(stat.doneMin) + 'h' : (flowCount - stat.done) + ' 步待完成'}`;

    return `
      <div class="g-node" data-id="${g.id}">
        <div class="goal-card ${overdue || (hot && g.deadline && Store.goalRemainDays(g) <= 3) ? 'hot' : ''}">
          <div class="goal-head">
            <div>
              <div class="goal-title-row">
                ${isFolder
                  ? `<button class="g-toggle ${open ? 'open' : ''}" data-act="toggle" title="${open ? '折叠' : '展开'}目标">▸</button>`
                  : `<span class="g-toggle-spacer"></span>`}
                <span class="goal-title">${UI.esc(g.title)}</span>
                ${tags}
                ${isFolder ? `<span class="g-folderbadge">${children.length}</span>` : ''}
                ${doneAll ? `<span class="goal-count ok">✔ 完成</span>` : ''}
              </div>
              <div class="goal-desc">
                ${UI.esc(g.desc)}${g.deadline ? ' · 截止 ' + g.deadline + (overdue ? '（已超期）' : '') : ''}${flowBrief}
              </div>
            </div>
            ${remainBadge(g)}
          </div>
        <div class="goal-progress">
          <div class="progress-track"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
          <span class="progress-label">${g.progress || 0}%</span>
        </div>
        <div class="goal-actions">
          <button class="btn btn-sm btn-primary" data-act="flow">⇱ 打开流程图</button>
          <button class="btn btn-sm" data-act="add-child">＋ 子目标</button>
          <button class="btn btn-sm" data-act="edit">编辑目标</button>
          <button class="btn btn-sm btn-danger" data-act="del">删除</button>
        </div>
      </div>
      ${isFolder && open ? `<div class="g-children">${children.map((c) => goalNode(c, depth + 1)).join('')}</div>` : ''}`;
  }

  function renderGroup(grp) {
    const roots = Store.getGoals().filter((g) => g.group === grp.key && !g.parentId);
    const collapsed = collapsedGroups.has(grp.key);
    const icon = grp.icon;
    const total = Store.getGoals().filter((g) => g.group === grp.key).length;
    return `
      <div class="goal-group ${collapsed ? 'collapsed' : ''}">
        <div class="goal-group-head" data-group="${grp.key}">
          <span class="g-group-caret">${collapsed ? '▸' : '▾'}</span>
          <span class="g-group-icon">${icon}</span>
          <span class="g-group-label">${grp.label}</span>
          <span class="g-group-hint">${grp.hint}</span>
          <span class="g-group-count">${total} 个</span>
          <button class="btn btn-sm btn-primary g-group-add" data-group="${grp.key}" title="在该分组新建目标">＋ 新建</button>
        </div>
        ${collapsed
          ? ''
          : `<div class="goal-group-body">${roots.length ? roots.map((g) => goalNode(g, 0)).join('') : '<div class="empty-line" style="padding:24px;text-align:center">该分组还没有目标</div>'}</div>`}
      </div>`;
  }

  function render() {
    const goals = Store.getGoals().slice();
    // 首开：有子目标的顶层目标默认展开成文件夹视图
    goals.forEach((g) => {
      const kids = goals.filter((c) => c.parentId === g.id);
      if (kids.length && !g.parentId && !expanded.has(g.id)) expanded.add(g.id);
    });

    const el = document.getElementById('goal-list');
    if (!goals.length) {
      el.innerHTML = '';
      attachGlobal();
      return;
    }
    el.innerHTML = Store.GROUPS.map((grp) => renderGroup(grp)).join('');
    bindGoals(el);
  }

  function bindGoals(container) {
    // 分组头：折叠 / 展开分组
    container.querySelectorAll('.goal-group-head').forEach((h) => {
      h.addEventListener('click', (e) => {
        if (e.target.closest('.g-group-add')) return; // 交给下面的新建按钮
        const key = h.dataset.group;
        if (collapsedGroups.has(key)) collapsedGroups.delete(key); else collapsedGroups.add(key);
        render();
      });
    });
    // 分组内新建（顶层目标）
    container.querySelectorAll('.g-group-add').forEach((b) => {
      b.addEventListener('click', (e) => { e.stopPropagation(); openAdd(null, null, b.dataset.group); });
    });

    container.querySelectorAll('.g-node').forEach((node) => {
      const id = node.dataset.id;
      // 展开 / 折叠目标
      const tg = node.querySelector('[data-act=toggle]');
      if (tg) tg.addEventListener('click', () => {
        if (expanded.has(id)) expanded.delete(id); else expanded.add(id);
        render();
      });
      // 打开流程图
      const flowBtn = node.querySelector('[data-act=flow]');
      if (flowBtn) flowBtn.addEventListener('click', () => Views.flow.open(id, { onBack: render }));
      // 操作
      node.querySelector('[data-act=add-child]').addEventListener('click', () => openAdd(null, id));
      node.querySelector('[data-act=edit]').addEventListener('click', () => openAdd(id));
      node.querySelector('[data-act=del]').addEventListener('click', () => {
        const hasKids = childrenOf(id).length > 0;
        UI.confirm(hasKids ? '该目标下还有子目标，删除将同时删除其全部子目标，确定？' : '确定删除该目标及其子任务？', () => {
          Store.deleteGoal(id); render();
        });
      });
    });
  }

  function attachGlobal() {
    document.getElementById('goal-add-btn').onclick = () => openAdd();
  }

  function groupSelectOptions(sel, exclude) {
    let rows = '';
    Store.GROUPS.forEach((grp) => {
      rows += `<optgroup label="${grp.icon} ${grp.label}">`;
      const candidates = Store.getGoals().filter((g) => g.group === grp.key && g.id !== exclude && !isDescendantOf(g.id, exclude));
      if (exclude === undefined || exclude === null) rows += `<option value="">（顶层）</option>`;
      candidates.forEach((g) => { rows += `<option value="${g.id}">${UI.esc(g.title) || '未命名'}</option>`; });
      if (!candidates.length) rows += `<option value="" disabled>（无）</option>`;
      rows += `</optgroup>`;
    });
    return rows;
  }
  function isDescendantOf(cid, pid) {
    // 判断 cid 是否位于 pid 的子孙中（防止成环）；pid 为空表示无父约束
    if (pid == null || pid === '') return false;
    let cur = Store.getGoals().find((g) => g.id === cid);
    let guard = 0;
    while (cur && guard++ < 100) {
      if (cur.parentId === pid) return true;
      cur = Store.getGoals().find((g) => g.id === cur.parentId);
    }
    return false;
  }

  function openAdd(id, presetParent, presetGroup) {
    const g = id ? Store.getGoals().find((x) => x.id === id) : null;
    const mask = UI.open(`
      <div class="modal-title">${g ? '编辑目标' : '新建目标'}</div>
      <div class="field"><label>目标标题 *</label><input class="input" id="g-title" value="${UI.esc(g ? g.title : '')}"/></div>
      <div class="field"><label>描述（可写此目标的含义 / 愿景）</label><textarea class="input" id="g-desc">${UI.esc(g ? g.desc : '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>分组</label>
          <select class="input" id="g-group">
            ${Store.GROUPS.map((grp) =>
              `<option value="${grp.key}" ${(g ? g.group : (presetGroup || 'short')) === grp.key ? 'selected' : ''}>${grp.icon} ${grp.label}（${grp.hint}）</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>父文件夹（可选）</label>
          <select class="input" id="g-parent">
            <option value="">（顶层）</option>
            ${Store.getGoals().filter((x) => !x.parentId && x.id !== id).map((x) =>
              `<option value="${x.id}" ${presetParent === x.id ? 'selected' : ''}>${UI.esc(x.title) || '未命名'}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="field"><label>截止日期</label><input class="input" type="date" id="g-deadline" value="${g && (g.deadline || g.date) ? (g.deadline || g.date) : ''}"/></div>
        <div class="field"><label>标签(逗号分隔)</label><input class="input" id="g-tags" value="${UI.esc(g ? g.tags : '')}"/></div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-close>取消</button>
        <button class="btn btn-primary" data-save>保存</button>
      </div>
    `);
    const groupSel = mask.querySelector('#g-group');
    const parentSel = mask.querySelector('#g-parent');
    function refreshParents() {
      const cur = groupSel.value;
      const excl = g ? g.id : null;
      parentSel.innerHTML = `<option value="">（顶层）</option>` +
        Store.getGoals()
          .filter((x) => x.group === cur && x.id !== excl && !isDescendantOf(x.id, excl))
          .map((x) => `<option value="${x.id}">${UI.esc(x.title) || '未命名'}</option>`).join('');
      if (presetParent) parentSel.value = presetParent; else if (g && g.parentId) parentSel.value = g.parentId;
    }
    groupSel.addEventListener('change', refreshParents);
    refreshParents();

    mask.querySelector('[data-close]').addEventListener('click', () => UI.close(mask));
    mask.querySelector('[data-save]').addEventListener('click', () => {
      const title = mask.querySelector('#g-title').value.trim();
      if (!title) { UI.toast('请输入目标标题', 'err'); return; }
      const deadline = mask.querySelector('#g-deadline').value;
      const data = {
        title,
        desc: mask.querySelector('#g-desc').value.trim(),
        deadline,
        date: deadline,
        tags: mask.querySelector('#g-tags').value.trim(),
        group: groupSel.value,
        parentId: parentSel.value || null,
      };
      if (g) Store.updateGoal(g.id, data); else Store.addGoal(data);
      UI.close(mask);
      UI.toast('已保存');
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('goal-add-btn');
    if (btn) btn.addEventListener('click', () => openAdd());
  });

  return { render, openAdd };
})();
