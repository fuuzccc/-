// 日历视图：月视图 + 点击日期 + 拖拽改期
Views.calendar = (() => {
  let viewDate = new Date(Store.todayStr() + 'T00:00:00');
  let selDate = Store.todayStr();

  function fmt(d) {
    const p = Store.pad;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function weekdayLabel(d) {
    const k = Math.round((d - new Date(Store.todayStr() + 'T00:00:00')) / 86400000) % 7;
    return ['今天', '明天', '后天'][k] || '';
  }

  function renderCal() {
    const p = Store.pad;
    const labelEl = document.getElementById('cal-label');
    labelEl.textContent = `${viewDate.getFullYear()} 年 ${viewDate.getMonth() + 1} 月`;
    document.getElementById('cal-sub').textContent = `点击日期查看，可拖动事项调整日期`;

    const year = viewDate.getFullYear(), month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startDow = first.getDay(); // 0=周日
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const grid = [];
    const today = Store.todayStr();
    for (let i = 0; i < startDow; i++) grid.push({ other: -1 });
    for (let d = 1; d <= daysInMonth; d++) grid.push({ other: 0, day: d });
    while (grid.length % 7 !== 0) grid.push({ other: -2 });

    let html = `<div class="cal-dow">日</div><div class="cal-dow">一</div><div class="cal-dow">二</div><div class="cal-dow">三</div><div class="cal-dow">四</div><div class="cal-dow">五</div><div class="cal-dow">六</div>`;

    let cellHtml = '';
    for (const c of grid) {
      if (c.other !== 0) { cellHtml += `<div class="cal-cell other"></div>`; continue; }
      const dateStr = `${year}-${p(month + 1)}-${p(c.day)}`;
      const dayTasks = Store.getTasks().filter((t) => t.date === dateStr);
      const overdueCount = dayTasks.filter((t) => !t.completed && dateStr < today).length;
      const count = dayTasks.filter((t) => !t.completed).length;
      const cls = ['cal-cell'];
      if (dateStr === today) cls.push('today');
      if (dateStr === selDate) cls.push('sel');
      // 农历 / 节日 / 节假日
      let info = null;
      try { info = window.CalExtra && window.CalExtra.cellLabel(year, month + 1, c.day); } catch (e) {}
      const isWork = !!(window.CalExtra && window.CalExtra.isWorkDay(year, month + 1, c.day));
      if (info && info.rest) cls.push('rest');
      const labelCls = info && info.cls ? ` cal-lunar ${info.cls}` : ' cal-lunar';
      const lunarHtml = info ? `<span class="${labelCls}">${UI.esc(info.text)}</span>` : '';
      const workHtml = isWork ? '<span class="work-badge">班</span>' : '';
      cellHtml += `<div class="${cls.join(' ')}" data-date="${dateStr}">
        <div class="cal-head">
          <span class="cal-num">${c.day}</span>
          <span class="cal-head-r">${lunarHtml}${workHtml}</span>
        </div>
        <div class="cal-dots">${count ? `<span class="cal-dot">${count} 件</span>` : ''}${overdueCount ? `<span class="cal-dot" style="background:var(--danger);color:#fff">逾期</span>` : ''}</div>
      </div>`;
    }
    html += cellHtml;
    const gridEl = document.getElementById('cal-grid');
    gridEl.innerHTML = html;
    gridEl.querySelectorAll('.cal-cell[data-date]').forEach((cell) => {
      cell.addEventListener('click', () => { selDate = cell.dataset.date; renderCal(); renderDay(); });
      cell.addEventListener('dragover', (e) => { e.preventDefault(); });
      cell.addEventListener('drop', (e) => {
        e.preventDefault();
        const tid = e.dataTransfer.getData('text/plain');
        if (tid) { Store.updateTask(tid, { date: cell.dataset.date }); renderCal(); renderDay(); }
      });
    });
  }

  function renderDay() {
    const title = document.getElementById('cal-day-title');
    const d = new Date(selDate + 'T00:00:00');
    const p = Store.pad;
    const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    title.textContent = `${p(d.getMonth() + 1)}月${p(d.getDate())}日 周${wd}`;
    // 农历 / 节日 / 节假日详情
    const detailEl = document.getElementById('cal-day-extra');
    if (detailEl) {
      let detail = null;
      try { detail = window.CalExtra && window.CalExtra.dayDetail(d.getFullYear(), d.getMonth() + 1, d.getDate()); } catch (e) {}
      if (detail) {
        const parts = [];
        if (detail.holiday) {
          const tag = detail.holiday.isWork() ? '调休上班' : '法定休息日';
          parts.push(`<span class="dx ${detail.holiday.isWork() ? 'work' : 'rest'}">${UI.esc(detail.holiday.getName())} · ${tag}</span>`);
        }
        if (detail.jieQi) parts.push(`<span class="dx jieqi">${UI.esc(detail.jieQi)}</span>`);
        detail.fests.forEach((f) => parts.push(`<span class="dx fest">${UI.esc(f)}</span>`));
        detailEl.innerHTML = `<div class="dx-lunar">${UI.esc(detail.lunarDate)}</div><div class="dx-tags">${parts.join('')}</div>`;
      } else {
        detailEl.innerHTML = '';
      }
    }
    const dayTasks = Store.getTasks().filter((t) => t.date === selDate);
    const list = document.getElementById('cal-day-list');
    if (!dayTasks.length) { list.innerHTML = `<div class="empty-line">该日没有事项，点击下方添加</div>`; }
    else {
      list.innerHTML = dayTasks.map((t) => {
        const cls = `cal-item draggable ${t.completed ? 'done' : ''}`;
        return `<div class="${cls}" draggable="true" data-id="${t.id}" style="${t.completed ? 'text-decoration:line-through;color:var(--text-mut)' : ''}">
          <span class="cal-time">${t.time || ''}</span>
          <span style="flex:1">${UI.esc(t.title)}</span>
          <span class="pill ${t.priority === 'hi' ? 'hi' : t.priority === 'mid' ? 'mid' : 'lo'}" style="padding:0 6px">${UI.prioLabel(t.priority)}</span>
          ${t.completed ? '<span>✓</span>' : ''}
        </div>`;
      }).join('');
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-sm';
    addBtn.textContent = '＋ 添加事项到该日';
    addBtn.style.marginTop = '10px';
    addBtn.addEventListener('click', () => Views.todo.openAdd());
    list.appendChild(addBtn);

    list.querySelectorAll('.cal-item').forEach((item) => {
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.id);
        e.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
        setTimeout(() => item.classList.remove('dragging'), 0);
      });
      item.addEventListener('click', (e) => {
        if (e.target === item) Views.todo.openAdd(item.dataset.id);
      });
    });

    window.preFillDate = selDate;
  }

  function render() {
    renderCal();
    renderDay();
  }

  // nav 事件
  setTimeout(() => {
    document.getElementById('cal-prev').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1); render(); });
    document.getElementById('cal-next').addEventListener('click', () => { viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1); render(); });
    document.getElementById('cal-today').addEventListener('click', () => { viewDate = new Date(Store.todayStr() + 'T00:00:00'); selDate = Store.todayStr(); render(); });
  }, 0);

  return { render };
})();
