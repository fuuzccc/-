// 综合看板
Views.dashboard = (() => {
  function kpiHtml() {
    const tasks = Store.getTasks();
    const today = Store.todayStr();
    const overdue = tasks.filter((t) => !t.completed && t.date && t.date < today).length;
    const todayL = tasks.filter((t) => !t.completed && t.date === today).length;
    const open = tasks.filter((t) => !t.completed).length;
    const goals = Store.getGoals();
    const goalsActive = goals.filter((g) => (g.progress || 0) < 100).length;

    const k = (red, num, lab) => `<div class="kpi ${red ? 'red' : ''}"><div class="num">${num}</div><div class="lab">${lab}</div></div>`;
    return `<div class="kpi-row">${k(overdue > 0, overdue, '已逾期')}${k(false, todayL, '今天待办')}${k(false, open, '进行中事项')}${k(false, goalsActive, '进行中目标')}</div>`;
  }

  function tinyItem(t) {
    const c = t.priority === 'hi' ? 'var(--danger)' : t.priority === 'mid' ? 'var(--warn)' : 'var(--text-mut)';
    const dateTxt = t.date + (t.time ? ' ' + t.time : '');
    return `<div class="tiny-item" data-id="${t.id}">${t.completed ? '<span style="color:var(--ok)">☑</span>' : `<span class="dot" style="background:${c}"></span>`}<span class="t-title" style="${t.completed ? 'text-decoration:line-through;color:var(--text-mut)' : ''}">${UI.esc(t.title)}</span><span class="t-date">${dateTxt}</span></div>`;
  }

  function render() {
    const now = new Date();
    const p = Store.pad;
    const wd = ['日', '一', '二', '三', '四', '五', '六'][now.getDay()];
    document.getElementById('dash-date').textContent = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月 ${now.getDate()} 日 · 星期${wd}`;

    const tasks = Store.getTasks();
    const today = Store.todayStr();
    const overdue = tasks.filter((t) => !t.completed && t.date && t.date < today);
    const todayL = tasks.filter((t) => !t.completed && t.date === today);
    const next7 = [];
    for (let i = 1; i <= 7; i++) {
      const d = Store.addDays(today, i);
      tasks.filter((t) => !t.completed && t.date === d).forEach((t) => next7.push(t));
    }
    const upcoming = next7.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8);

    // 目标
    const goals = Store.getGoals().filter((g) => (g.progress || 0) < 100);
    const goalCards = goals.slice(0, 5).map((g) => {
      const r = Store.goalRemainDays(g);
      const todayS = Store.todayStr();
      const hot = g.deadline && r !== null && r <= 3;
      const overdueG = g.deadline && g.deadline < todayS;
      const remain = r === null ? '未设截止' : overdueG ? `超期 ${Math.abs(r)} 天` : r === 0 ? '今天截止' : `剩 ${r} 天`;
      return `
        <div class="tiny-item" style="flex-direction:column;align-items:stretch;padding:10px 12px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span class="t-title" style="flex:1">${UI.esc(g.title)}</span>
            <span class="pill ${hot ? 'hi' : overdueG ? 'hi' : 'lo'}" style="padding:1px 8px">${remain}</span>
          </div>
          <div class="progress-track" style="height:7px;margin-top:8px"><div class="progress-fill" style="width:${g.progress || 0}%"></div></div>
          <div style="font-size:11px;color:var(--text-mut);margin-top:4px">进度 ${g.progress || 0}%</div>
        </div>`;
    }).join('');

    document.getElementById('dash-grid').innerHTML = `
      <div class="dash-col">
        ${kpiHtml()}
        <div class="card">
          <div class="section-title">📌 今日待办 <button class="btn btn-sm goto-view" data-view="todo">去清单 ›</button></div>
          <div class="tiny-list">${todayL.map(tinyItem).join('') || '<div class="empty-line">今天没有待办</div>'}</div>
        </div>
        <div class="card" ${overdue.length ? 'style="border-color:var(--danger)"' : ''}>
          <div class="section-title">⏰ 已逾期 <button class="btn btn-sm goto-view" data-view="todo">去清查 ›</button></div>
          <div class="tiny-list">${overdue.map(tinyItem).join('') || '<div class="empty-line">没有逾期事项</div>'}</div>
        </div>
      </div>
      <div class="dash-col">
        <div class="card">
          <div class="section-title">🕒 未来 7 天</div>
          <div class="tiny-list">${upcoming.map(tinyItem).join('') || '<div class="empty-line">未来 7 天没有安排</div>'}</div>
        </div>
        <div class="card">
          <div class="section-title">🎯 目标进度 <button class="btn btn-sm goto-view" data-view="goals">去目标 ›</button></div>
          <div class="tiny-list">${goalCards || '<div class="empty-line">还没有目标</div>'}</div>
        </div>
      </div>`;

    document.getElementById('dash-grid').querySelectorAll('.goto-view').forEach((btn) => {
      btn.addEventListener('click', () => SwitchView(btn.dataset.view));
    });
    document.getElementById('dash-grid').querySelectorAll('.tiny-item[data-id]').forEach((item) => {
      item.addEventListener('click', () => { Views.todo.openAdd(item.dataset.id); });
    });
  }

  return { render };
})();
