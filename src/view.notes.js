// 备忘录视图：标题+tag 卡片列表、标题/tag 搜索、全部标签聚合浏览
Views.notes = (() => {
  const state = { mode: 'list', tag: '_all', q: '' };
  let debounceT = null;
  function debounce(fn) { clearTimeout(debounceT); debounceT = setTimeout(fn, 220); }
  function esc(s) { return UI.esc(s); }
  function nl2br(s) { return esc(s).replace(/\n/g, '<br/>'); }
  function tagChips(tag, label, count) {
    return `<button class="chip ${state.tag === tag ? 'active' : ''}" data-tag="${esc(tag)}">${label}${count != null ? ` <span class="tcount">${count}</span>` : ''}</button>`;
  }

  function noteCard(n) {
    const tags = Store.parseTags(n.tags).map((t) => `<span class="ntag" data-tag="${esc(t)}">${esc(t)}</span>`).join('');
    return `
      <div class="note-card" data-id="${n.id}">
        <div class="note-title">${esc(n.title) || '(无标题备忘录)'}</div>
        <div class="note-tags">${tags || '<span class="muted">（无标签）</span>'}</div>
      </div>`;
  }

  function tagCard(t) {
    return `
      <div class="tag-card" data-tag="${esc(t.tag)}">
        <span class="tag-name">${esc(t.tag)}</span>
        <span class="tag-count">${t.count}</span>
      </div>`;
  }

  function renderTabs() {
    const tabs = document.getElementById('notes-tabs');
    tabs.innerHTML = `
      <button class="chip ${state.mode === 'list' ? 'active' : ''}" data-ntab="list">📄 全部备忘录</button>
      <button class="chip ${state.mode === 'tags' ? 'active' : ''}" data-ntab="tags">🏷 全部标签</button>`;
    tabs.querySelectorAll('[data-ntab]').forEach((b) => b.addEventListener('click', () => {
      state.mode = b.dataset.ntab;
      if (state.mode === 'list') { state.tag = '_all'; state.q = ''; }
      const si = document.getElementById('notes-search');
      if (si) si.value = '';
      render();
    }));
  }

  function renderTags() {
    const grid = document.getElementById('notes-grid');
    const all = Store.allNoteTags();
    if (!all.length) {
      grid.innerHTML = `<div class="empty-line" style="padding:50px;text-align:center;color:var(--text-mut)">还没有任何标签，先新建带标签的备忘录吧</div>`;
      return;
    }
    grid.innerHTML = `<div class="tags-wrap">${all.map(tagCard).join('')}</div>`;
    grid.querySelectorAll('.tag-card').forEach((c) => c.addEventListener('click', () => {
      state.tag = c.dataset.tag;
      state.mode = 'list';
      render();
    }));
  }

  function updateSub() {
    const total = Store.getNotes().length;
    let t = `共 ${total} 篇备忘录`;
    if (state.mode === 'tags') t += ' · 按标签浏览';
    else if (state.tag !== '_all') t += ` · 标签：「${state.tag}」`;
    const el = document.getElementById('notes-sub');
    if (el) el.textContent = t;
  }

  function renderList() {
    const grid = document.getElementById('notes-grid');
    const all = Store.allNoteTags();
    const q = state.q.trim().toLowerCase();
    const list = Store.getNotes().filter((n) => {
      if (state.tag !== '_all' && !Store.parseTags(n.tags).includes(state.tag)) return false;
      if (q) {
        const hay = ((n.title || '') + ' ' + (n.tags || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
    let html = '';
    // 标签筛选条
    if (state.tag === '_all') {
      let chips = tagChips('_all', '全部');
      all.slice(0, 12).forEach((t) => chips += tagChips(t.tag, t.tag, t.count));
      html += `<div class="note-filters">${chips}</div>`;
    } else {
      html += `<div class="note-filters"><button class="btn btn-sm" data-clearn="1">✕ 清除标签「${esc(state.tag)}」</button></div>`;
    }
    if (!list.length) {
      html += `<div class="empty-line" style="padding:50px;text-align:center;color:var(--text-mut)">没有匹配的备忘录${state.tag !== '_all' ? '（可点右上清除标签筛选）' : ''}</div>`;
    } else {
      html += `<div class="notes-grid">${list.map(noteCard).join('')}</div>`;
    }
    grid.innerHTML = html;
    updateSub();

    // 标签 chips 过滤
    grid.querySelectorAll('.note-filters [data-tag]').forEach((b) => b.addEventListener('click', () => {
      state.tag = b.dataset.tag === '_all' ? '_all' : b.dataset.tag;
      render();
    }));
    const cl = grid.querySelector('.note-filters [data-clearn]');
    if (cl) cl.addEventListener('click', () => { state.tag = '_all'; render(); });

    // 卡片：点击打开详情；点击 tag 只过滤
    grid.querySelectorAll('.note-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const tg = e.target.closest('.ntag');
        if (tg) { state.tag = tg.dataset.tag; render(); return; }
        openView(card.dataset.id);
      });
    });
  }

  function render() {
    renderTabs();
    if (state.mode === 'tags') renderTags();
    else renderList();
    updateSub();
  }

  function openView(id) {
    const n = Store.getNotes().find((x) => x.id === id);
    if (!n) return;
    const tags = Store.parseTags(n.tags).map((t) => `<span class="ntag">${esc(t)}</span>`).join('');
    const mask = UI.open(`
      <div class="note-view">
        <div class="note-view-date">📅 ${esc(n.date) || '未注日期'}</div>
        <div class="note-view-title">${esc(n.title) || '(无标题备忘录)'}</div>
        ${tags ? `<div class="note-tags">${tags}</div>` : ''}
        <div class="note-view-body">${nl2br(n.body) || '<span class="muted">（无正文内容）</span>'}</div>
      </div>
      <div class="modal-actions">
        <button class="btn" data-act="edit">编辑</button>
        <button class="btn btn-danger" data-act="del">删除</button>
        <button class="btn btn-primary" data-close>关闭</button>
      </div>
    `);
    mask.querySelector('[data-close]').addEventListener('click', () => UI.close(mask));
    mask.querySelector('[data-act=edit]').addEventListener('click', () => { UI.close(mask); openAdd(id); });
    mask.querySelector('[data-act=del]').addEventListener('click', () => {
      UI.confirm('确定删除这篇备忘录？', () => {
        Store.deleteNote(id); UI.close(mask); UI.toast('已删除'); render();
      });
    });
  }

  function openAdd(id) {
    const n = id ? Store.getNotes().find((x) => x.id === id) : null;
    const tags = n ? Store.parseTags(n.tags).slice() : [];
    const mask = UI.open(`
      <div class="modal-title">${n ? '编辑备忘录' : '新建备忘录'}</div>
      <div class="field"><label>标题 *</label><input class="input" id="nt-title" value="${esc(n ? n.title : '')}"/></div>
      <div class="field">
        <label>标签（可添加多个，输入后回车或按逗号/顿号加入）</label>
        <div class="nt-tagbox" id="nt-tagbox">
          <div class="nt-chips"></div>
          <input class="input nt-tag-input" id="nt-tags-input" placeholder="输入标签后回车">
          <button class="btn btn-sm" id="nt-tag-add" type="button">＋ 添加</button>
        </div>
      </div>
      <div class="field"><label>正文</label><textarea class="input" id="nt-body" style="min-height:150px">${esc(n ? n.body : '')}</textarea></div>
      <div class="field" style="max-width:220px"><label>写下日期</label><input class="input" type="date" id="nt-date" value="${n && n.date ? n.date : Store.todayStr()}"/></div>
      <div class="modal-actions">
        <button class="btn" data-close>取消</button>
        <button class="btn btn-primary" data-save>保存</button>
      </div>
    `);
    const chipsEl = mask.querySelector('.nt-chips');
    const tagInput = mask.querySelector('#nt-tags-input');
    function renderChips() {
      chipsEl.innerHTML = tags.map((t) =>
        `<span class="nt-chip">${esc(t)}<button type="button" data-rm="${esc(t)}" title="移除">×</button></span>`).join('')
        || '<span class="muted nt-tag-empty">（暂无标签，可添加多个）</span>';
      chipsEl.querySelectorAll('[data-rm]').forEach((b) => b.addEventListener('click', () => {
        const i = tags.indexOf(b.dataset.rm);
        if (i >= 0) { tags.splice(i, 1); renderChips(); }
      }));
    }
    function commitTag() {
      const v = tagInput.value.trim();
      // 去掉末尾的逗号/顿号/空格分隔符
      const clean = v.replace(/[,，、\s]+$/, '').trim();
      if (!clean) { tagInput.value = ''; return; }
      if (!tags.includes(clean)) tags.push(clean);
      tagInput.value = '';
      renderChips();
      tagInput.focus();
    }
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === '，' || e.key === '、') {
        e.preventDefault();
        commitTag();
      }
    });
    const addBtn = mask.querySelector('#nt-tag-add');
    if (addBtn) addBtn.addEventListener('click', commitTag);
    mask.querySelector('[data-close]').addEventListener('click', () => UI.close(mask));
    mask.querySelector('[data-save]').addEventListener('click', () => {
      const title = mask.querySelector('#nt-title').value.trim();
      if (!title) { UI.toast('请输入标题', 'err'); return; }
      // 若输入框中还残留未加入的标签，先补加入
      commitTag();
      const data = {
        title,
        tags: tags.join(', '),
        body: mask.querySelector('#nt-body').value.trim(),
        date: mask.querySelector('#nt-date').value || Store.todayStr(),
      };
      if (n) Store.updateNote(n.id, data); else Store.addNote(data);
      UI.close(mask);
      UI.toast('已保存');
      render();
    });
    renderChips();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('notes-add-btn');
    if (btn) btn.addEventListener('click', () => openAdd());
    const si = document.getElementById('notes-search');
    if (si) si.addEventListener('input', () => { state.q = si.value; debounce(renderList); });
  });

  return { render, openAdd };
})();
