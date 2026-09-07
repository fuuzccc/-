// 清单视图
Views.todo = (() => {
  const filter = { status: 'all', priority: 'all', tag: '_all', cat: '_all', q: '' };

  function prioDot(t) {
    const c = t.priority === 'hi' ? 'var(--danger)' : t.priority === 'mid' ? 'var(--warn)' : 'var(--text-mut)';
    return `<span class="dot" style="background:${c}"></span>`;
  }

  function taskCard(t) {
    const status = Store.dateStatus(t);
    const meta = [];
    if (t.category) {
      // 自动归类颜色
      const colors = ['#e8f0fe','#e8f7ef','#fdf3e0','#fdecec','#f0edfc','#e6f7f8'];
      let h = 0; for (let i = 0; i < t.category.length; i++) h = (h * 31 + t.category.charCodeAt(i)) >>> 0;
      meta.push(`<span class="tag cat" style="background:${colors[h % colors.length]}">${UI.esc(t.category)}</span>`);
    }
    Store.parseTags(t.tags).forEach((tag) => meta.push(`<span class="tag">${UI.esc(tag)}</span>`));
    if (t.date) {
      const d = new Date(t.date + 'T00:00:00');
      const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
      let dateTxt = `${t.date} 周${wd}`;
      if (t.time) dateTxt += ' ' + t.time;
      meta.push(`<span class="tc-date">${dateTxt}</span>`);
    }

    const overdueCls = status === 'overdue' && !t.completed ? 'overdue' : '';
    return `
      <div class="todo-card ${overdueCls} ${t.completed ? 'done' : ''}" data-id="${t.id}">
        <div class="tc-check ${t.completed ? 'on' : ''}" data-act="toggle">${t.completed ? '✓' : ''}</div>
        <div class="tc-body">
          <div class="tc-title">${UI.esc(t.title)}</div>
          ${t.desc ? `<div class="tc-desc">${UI.esc(t.desc)}</div>` : ''}
          <div class="tc-meta">${prioDot(t)} <span class="pill ${t.priority === 'hi' ? 'hi' : t.priority === 'mid' ? 'mid' : 'lo'}" style="padding:0 7px">${UI.prioLabel(t.priority)}</span>${meta.join('')}</div>
        </div>
        <div class="tc-actions">
          <button class="btn btn-sm btn-ghost" data-act="edit">编辑</button>
          <button class="btn btn-sm btn-ghost" data-act="del">删除</button>
        </div>
      </div>`;
  }

  function renderFilters() {
    const tags = Store.allTags();
    const cats = Store.allCategories();
    const el = document.getElementById('todo-filters');
    const chip = (key, val, label) => `<button class="chip ${filter[key] === val ? 'active' : ''}" data-k="${key}" data-v="${val}">${label}</button>`;
    let html = `<input class="search-input" placeholder="搜索标题 / 描述..." value="${UI.esc(filter.q)}" data-act="search"/>`;
    html += chip('status', 'all', '全部');
    html += chip('status', 'today', '今天');
    html += chip('status', 'overdue', '已逾期');
    html += chip('status', 'future', '未来');
    html += chip('status', 'done', '已完成');
    html += chip('priority', 'all', '优先级:全部');
    html += chip('priority', 'hi', '高');
    html += chip('priority', 'mid', '中');
    html += chip('priority', 'lo', '低');
    if (tags.length) { html += chip('tag', '_all', '标签:全部'); tags.forEach((t) => html += chip('tag', t, t)); }
    else html += chip('tag', '_all', '标签:全部');
    if (cats.length) { html += chip('cat', '_all', '分类:全部'); cats.forEach((c) => html += chip('cat', c, c)); }
    else html += chip('cat', '_all', '分类:全部');
    html += `<button class="btn btn-sm" style="margin-left:auto" data-act="clr">清空筛选</button>`;
    el.innerHTML = html;

    el.querySelectorAll('.chip').forEach((ch) => ch.addEventListener('click', () => {
      const k = ch.dataset.k, v = ch.dataset.v;
      filter[k] = v;
      renderFilters();
      render();
    }));
    const si = el.querySelector('[data-act=search]');
    si.addEventListener('input', () => { filter.q = si.value; debounce(render); });
    el.querySelector('[data-act=clr]').addEventListener('click', () => {
      Object.assign(filter, { status: 'all', priority: 'all', tag: '_all', cat: '_all', q: '' });
      renderFilters();
      render();
    });
  }
  let debounceT = null;
  function debounce(fn) { clearTimeout(debounceT); debounceT = setTimeout(fn, 220); }

  function matching() {
    return Store.getTasks().filter((t) => {
      if (filter.status === 'today' && Store.dateStatus(t) !== 'today') return false;
      if (filter.status === 'overdue' && Store.dateStatus(t) !== 'overdue') return false;
      if (filter.status === 'future' && Store.dateStatus(t) !== 'future') return false;
      if (filter.status === 'done' && !t.completed) return false;
      if (filter.priority !== 'all' && t.priority !== filter.priority) return false;
      if (filter.tag !== '_all' && !Store.parseTags(t.tags).includes(filter.tag)) return false;
      if (filter.cat !== '_all' && t.category !== filter.cat) return false;
      if (filter.q && ((t.title || '') + (t.desc || '') + (t.category || '')).toLowerCase().indexOf(filter.q.toLowerCase()) === -1) return false;
      return true;
    });
  }

  function render() {
    renderFilters();
    const list = matching();
    const today = Store.todayStr();
    const overdue = list.filter((t) => !t.completed && t.date && t.date < today);
    const todayL = list.filter((t) => !t.completed && t.date && t.date === today);
    const nordate = list.filter((t) => !t.completed && !t.date);
    const future = list.filter((t) => !t.completed && t.date && t.date > today);
    const done = list.filter((t) => t.completed);

    function section(label, items, countBadge) {
      if (!items.length) return '';
      const rows = items.map(taskCard).join('');
      return `<div class="todo-section"><div class="sec-label">${label}<span class="count">${items.length}</span></div>${rows}</div>`;
    }
    let html = '';
    if (!list.length) html = `<div class="empty-line" style="padding:40px;text-align:center;color:var(--text-mut)">没有匹配的事项</div>`;
    else {
      html += section('🔴 已逾期', overdue);
      html += section('📌 今天', todayL);
      html += section('📋 待安排日期', nordate);
      html += section('🕒 未来', future);
      html += section('✅ 已完成', done);
    }
    document.getElementById('todo-list').innerHTML = html;
    document.getElementById('todo-list').querySelectorAll('.todo-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const actEl = e.target.closest('[data-act]');
        const id = card.dataset.id;
        if (!actEl) return;
        const act = actEl.dataset.act;
        if (act === 'toggle') { Store.toggleTask(id); render(); }
        else if (act === 'edit') { openAdd(id); }
        else if (act === 'del') {
          UI.confirm('确定删除该事项？', () => { Store.deleteTask(id); render(); });
        }
      });
    });
  }

  function openAdd(id, fromDash) {
    const t = id ? Store.getTasks().find((x) => x.id === id) : null;
    const today = Store.todayStr();
    const mask = UI.open(`
      <div class="modal-title">${t ? '编辑事项' : '新增事项'}</div>
      <div class="field"><label>标题 *</label><input class="input" id="f-title" value="${UI.esc(t ? t.title : '')}"/></div>
      <div class="field"><label>描述</label><textarea class="input" id="f-desc">${UI.esc(t ? t.desc : '')}</textarea></div>
      <div class="form-row">
        <div class="field"><label>日期</label><input class="input" type="date" id="f-date" value="${t && t.date ? t.date : today}"/></div>
        <div class="field"><label>时间(可选)</label><input class="input" type="time" id="f-time" value="${UI.esc(t && t.time ? t.time : '')}"/></div>
      </div>
      <div class="form-row">
        <div class="field"><label>优先级</label>
          <select class="select" id="f-prio">
            <option value="lo" ${t && t.priority === 'lo' ? 'selected' : ''}>低</option>
            <option value="mid" ${t && t.priority === 'mid' ? 'selected' : ''}>中</option>
            <option value="hi" ${!t || t.priority === 'hi' ? 'selected' : ''}>高</option>
          </select>
        </div>
        <div class="field"><label>分类</label><input class="input" id="f-cat" placeholder="如：工作/学习" value="${UI.esc(t ? t.category : '')}"/></div>
      </div>
      <div class="form-row">
        <div class="field"><label>标签(逗号分隔)</label><input class="input" id="f-tags" value="${UI.esc(t ? t.tags : '')}"/></div>
        <div class="field"><label>重复</label>
          <select class="select" id="f-repeat">
            <option value="none" ${t && t.repeat === 'none' ? 'selected' : ''}>不重复</option>
            <option value="daily" ${t && t.repeat === 'daily' ? 'selected' : ''}>每天</option>
            <option value="weekly" ${t && t.repeat === 'weekly' ? 'selected' : ''}>每周</option>
            <option value="monthly" ${t && t.repeat === 'monthly' ? 'selected' : ''}>每月</option>
          </select>
        </div>
      </div>
      <div class="field" style="display:flex;align-items:center;gap:8px">
        <label style="margin:0">在日程时间到时提醒</label>
        <label class="switch"><input type="checkbox" id="f-remind" ${t ? (t.reminder ? 'checked' : '') : 'checked'} /><span class="slider"></span></label>
      </div>
      <div class="modal-actions">
        <button class="btn" data-close>取消</button>
        <button class="btn btn-primary" data-save>保存</button>
      </div>
    `);
    mask.querySelector('[data-close]').addEventListener('click', () => UI.close(mask));
    mask.querySelector('[data-save]').addEventListener('click', () => {
      const title = mask.querySelector('#f-title').value.trim();
      if (!title) { UI.toast('请输入标题', 'err'); return; }
      const data = {
        title,
        desc: mask.querySelector('#f-desc').value.trim(),
        date: mask.querySelector('#f-date').value || today,
        time: mask.querySelector('#f-time').value,
        priority: mask.querySelector('#f-prio').value,
        category: mask.querySelector('#f-cat').value.trim(),
        tags: mask.querySelector('#f-tags').value.trim(),
        repeat: mask.querySelector('#f-repeat').value,
        reminder: mask.querySelector('#f-remind').checked,
      };
      if (t) Store.updateTask(t.id, data); else Store.addTask(data);
      UI.close(mask);
      UI.toast('已保存');
      if (fromDash && Views.dashboard) Views.dashboard.render();
      render();
    });
  }

  return { render, openAdd };
})();
