// 设置视图：自启、提醒、数据导出导入、关于
Views.settings = (() => {
  let autostartOn = false;

  async function render() {
    try { autostartOn = !!(await Store.api.getAutostart()); } catch (e) {}
    let ver = '1.0.2';
    try { ver = (await Store.api.getVersion()) || '1.0.2'; } catch (e) {}
    const gh = 'fuuzccc';
    const avatar = 'https://avatars.githubusercontent.com/' + gh;
    const s = Store.getSettings();
    const theme = Object.assign({}, Theme.DEFAULT, s.theme || {});
    const slotDefs = [
      ['primary', '主色 / 强调色'], ['bg', '页面背景'], ['card', '卡片背景'], ['border', '边框'],
      ['text', '主要文字'], ['textMut', '次要文字'], ['warn', '警示（橙）'], ['ok', '成功（绿）'], ['danger', '危险（红）'],
    ];
    const presetBtn = (key, name) => {
      const p = Theme.PRESETS[key];
      const sw = [p.primary, p.bg, p.card, p.text].map((c) => `<span class="swatch" style="background:${c}"></span>`).join('');
      return `<button class="theme-preset" data-preset="${key}"><span class="swatches">${sw}</span><span class="p-name">${name}</span></button>`;
    };
    const themeCard = `
      <div class="card set-card" style="grid-column:1/-1">
        <div class="section-title">🎨 主题风格</div>
        <p class="theme-hint">整套界面配色随你自定义：改任一颜色即时应用到全部页面；也可先一键套用预设主题再微调。选择会自动保存。</p>
        <div class="theme-grid">
          <div>
            <div class="theme-label">预设主题</div>
            <div class="theme-presets">
              ${presetBtn('light', '清爽浅色')}${presetBtn('block', '彩色积木')}${presetBtn('dark', '深色模式')}${presetBtn('paper', '纸张备忘录')}
            </div>
            <button class="btn" id="theme-reset">↺ 恢复默认色板</button>
          </div>
          <div>
            <div class="theme-label">自定义色板（9 个颜色槽）</div>
            <div id="theme-slots">
              ${slotDefs.map(([key, label]) => `<label class="theme-row"><span class="slot">${label}</span><input type="color" data-slot="${key}" value="${theme[key]}"></label>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
    const body = document.getElementById('settings-body');
    body.innerHTML = `${themeCard}
      <div class="card set-card">
        <div class="section-title">⚙ 通用</div>
        <div class="set-row">
          <div class="set-lab"><div class="set-name">开机自动启动</div><div class="set-desc">登录 Windows 后自动在后台运行并提醒</div></div>
          <label class="switch"><input type="checkbox" id="set-autostart" ${autostartOn ? 'checked' : ''} /><span class="slider"></span></label>
        </div>
        <div class="set-row">
          <div class="set-lab"><div class="set-name">系统通知提醒</div><div class="set-desc">到点弹出 Windows 桌面通知</div></div>
          <label class="switch"><input type="checkbox" id="set-notify" ${s.notifications ? 'checked' : ''} /><span class="slider"></span></label>
        </div>
        <div class="set-row">
          <div class="set-lab"><div class="set-name">提前提醒</div><div class="set-desc">在事项时间的多少分钟前提醒</div></div>
          <select id="set-remind" class="select" style="width:120px">
            ${[0, 5, 10, 15, 30, 60, 120].map((m) => `<option value="${m}" ${(s.remindMinutes || 0) == m ? 'selected' : ''}>${m} 分钟</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="card set-card">
        <div class="section-title">💾 数据管理</div>
        <p style="color:var(--text-mut);font-size:12px;line-height:1.7">你的计划数据保存在本机，可随时导出备份文件（包含全部清单、目标和子任务），也可在换机或误删后导入还原。</p>
        <div class="set-actions">
          <button class="btn" id="set-export" >⬇ 导出备份</button>
          <button class="btn" id="set-import">⬆ 导入合并</button>
          <button class="btn" id="set-import-over">⬆ 导入覆盖</button>
        </div>
        <div id="set-backup-status" style="font-size:12px;color:var(--ok);margin-top:10px"></div>
      </div>
      <div class="card set-card about-card">
        <div class="section-title">ℹ 关于</div>
        <div class="about-meta">
          <img class="set-avatar" src="${UI.esc(avatar)}" alt="${UI.esc(gh)}" referrerpolicy="no-referrer"/>
          <div class="about-meta-main">
            <div class="about-appname">${UI.esc(gh)}</div>
            <div class="about-slogan">将未来的规划，一步步变成现实</div>
          </div>
        </div>
        <div class="set-row">
          <div class="set-lab"><div class="set-name">版本</div><div class="set-desc">当前安装版本</div></div>
          <span class="pill lo">v${UI.esc(ver)}</span>
        </div>
        <div class="set-row">
          <div class="set-lab"><div class="set-name">开发者</div><div class="set-desc">fuuzccc · 将未来的规划，一步步变成现实</div></div>
        </div>
        <div class="set-row">
          <div class="set-lab"><div class="set-name">GitHub</div></div>
          <a class="pill gh-link" href="https://github.com/${UI.esc(gh)}" target="_blank" rel="noopener">github.com/${UI.esc(gh)}</a>
        </div>
      </div>`;

    // 主题面板事件
    const slotsWrap = document.getElementById('theme-slots');
    const allInputs = Array.from(slotsWrap.querySelectorAll('input[type=color]'));
    const currentTheme = () => { const o = {}; allInputs.forEach((i) => { o[i.dataset.slot] = i.value; }); return o; };
    // 头像加载失败兜底：替换为主色圆形占位（data:URI，CSP 允许）
    const av = body.querySelector('.set-avatar');
    if (av) {
      av.addEventListener('error', () => {
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="124" height="124"><rect width="124" height="124" rx="62" fill="#1677ff"/><text x="62" y="84" font-size="60" font-family="Microsoft YaHei, sans-serif" fill="#ffffff" text-anchor="middle" font-weight="bold">f</text></svg>';
        av.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
      });
    }
    allInputs.forEach((inp) => {
      inp.addEventListener('input', () => Theme.applyTheme(currentTheme()));
      inp.addEventListener('change', async () => { const o = currentTheme(); Theme.applyTheme(o); await Store.setSetting({ theme: o }); });
    });
    body.querySelectorAll('.theme-preset').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const p = Theme.PRESETS[btn.dataset.preset];
        allInputs.forEach((i) => { i.value = p[i.dataset.slot]; });
        Theme.applyTheme(p);
        await Store.setSetting({ theme: Object.assign({}, p) });
        UI.toast(`已应用主题「${btn.querySelector('.p-name').textContent}」`);
      });
    });
    body.querySelector('#theme-reset').addEventListener('click', async () => {
      const d = Theme.DEFAULT;
      allInputs.forEach((i) => { i.value = d[i.dataset.slot]; });
      Theme.applyTheme(d);
      await Store.setSetting({ theme: null });
      UI.toast('已恢复默认浅色主题');
    });

    body.querySelector('#set-autostart').addEventListener('change', async (e) => {
      const on = e.target.checked;
      const ok = await Store.api.setAutostart(on);
      autostartOn = on;
      UI.toast(ok ? (on ? '已开启开机自启' : '已关闭开机自启') : '设置失败', ok ? 'ok' : 'err');
    });
    body.querySelector('#set-notify').addEventListener('change', async (e) => {
      await Store.setSetting({ notifications: e.target.checked });
      UI.toast('提醒设置已保存');
    });
    body.querySelector('#set-remind').addEventListener('change', async (e) => {
      await Store.setSetting({ remindMinutes: Number(e.target.value) });
      UI.toast('已更新提前提醒时长');
    });
    body.querySelector('#set-export').addEventListener('click', async () => {
      const r = await Store.api.exportData();
      if (r.ok) { document.getElementById('set-backup-status').textContent = `已导出：${r.path}`; UI.toast('导出成功'); }
      else if (!r.canceled) UI.toast('导出失败: ' + (r.error || ''), 'err');
    });
    body.querySelector('#set-import').addEventListener('click', async () => doImport('merge'));
    body.querySelector('#set-import-over').addEventListener('click', () => {
      UI.confirm('覆盖导入将用备份文件替换当前全部清单和目标，继续？', () => doImport('overwrite'));
    });

    async function doImport(mode) {
      const r = await Store.api.importData(mode);
      if (r.ok) {
        await Store.load();
        document.getElementById('set-backup-status').textContent = `导入成功：共 ${r.countTasks} 项清单、${r.countGoals} 个目标`;
        UI.toast('导入成功');
        if (Views.calendar) Views.calendar.render();
      } else if (!r.canceled) {
        UI.toast('导入失败: 文件格式不正确', 'err');
      }
    }
  }

  setTimeout(() => { document.getElementById('view-settings').dispatchEvent; }, 0);
  return { render };
})();
