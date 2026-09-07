// 应用入口：页签切换 + 共享 UI 帮助函数

const UI = {
  root() { return document.getElementById('modal-root'); },
  open(html) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    mask.innerHTML = `<div class="modal">${html}</div>`;
    mask.addEventListener('mousedown', (e) => { if (e.target === mask) UI.close(mask); });
    UI.root().appendChild(mask);
    return mask;
  },
  close(mask) { if (mask) mask.remove(); },
  toast(msg, type = 'ok') {
    const el = document.createElement('div');
    el.textContent = msg;
    el.style.cssText = `position:fixed;bottom:26px;left:50%;transform:translateX(-50%);background:#23272f;color:#fff;padding:10px 18px;border-radius:10px;z-index:999;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:opacity .3s;`;
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, 2100);
  },
  confirm(message, onYes) {
    const mask = UI.open(`
      <div class="modal-title">确认</div>
      <p style="color:var(--text);margin:6px 0 4px;line-height:1.7">${UI.esc(message)}</p>
      <div class="modal-actions">
        <button class="btn" data-no>取消</button>
        <button class="btn btn-danger" data-yes>确定</button>
      </div>
    `);
    mask.querySelector('[data-no]').addEventListener('click', () => UI.close(mask));
    mask.querySelector('[data-yes]').addEventListener('click', () => { UI.close(mask); onYes && onYes(); });
  },
  esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  prioLabel(p) { return p === 'hi' ? '高' : p === 'mid' ? '中' : '低'; },
  // 关于对话框（头像 / GitHub / 开发者 / 版本）
  async showAbout() {
    let ver = '1.0.2';
    try { ver = await window.futureMemo.getVersion(); } catch (e) {}
    const gh = 'fuuzccc';
    const avatar = 'https://avatars.githubusercontent.com/' + gh;
    const mask = UI.open(`
      <div class="about-wrap">
        <img class="about-avatar" src="${avatar}" alt="${UI.esc(gh)}" referrerpolicy="no-referrer"/>
        <div class="about-name">未来备忘录</div>
        <div class="about-slogan">清单 · 日历 · 目标 一体化规划工具</div>
        <div class="about-meta">
          <div class="about-row"><span>版本</span><b>v${UI.esc(ver)}</b></div>
          <div class="about-row"><span>开发者</span><b>${UI.esc(gh)}</b></div>
          <div class="about-row"><span>GitHub</span><a href="https://github.com/${UI.esc(gh)}" target="_blank" rel="noopener">github.com/${UI.esc(gh)}</a></div>
        </div>
        <p class="about-foot">将未来的规划，一步步变成现实。</p>
        <button class="btn btn-primary" data-close-about>好的</button>
      </div>
    `);
    const closeB = mask.querySelector('[data-close-about]');
    if (closeB) closeB.addEventListener('click', () => UI.close(mask));
    return mask;
  },
};

// 视图渲染函数收集（由各 view.*.js 挂载）
const Views = {};

function switchView(name) {
  document.querySelectorAll('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = document.getElementById('view-' + name);
  if (target) target.classList.add('active');
  if (Views[name]) Views[name].render();
}

document.addEventListener('DOMContentLoaded', async () => {
  await Store.load();
  const savedTheme = Store.getSettings().theme;
  if (savedTheme) Theme.applyTheme(savedTheme);
  else Theme.applyTheme();
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.addEventListener('click', () => switchView(b.dataset.view));
  });
  document.getElementById('dash-quick-add').addEventListener('click', () => Views.todo.openAdd(null, true));
  document.getElementById('todo-add-btn').addEventListener('click', () => Views.todo.openAdd());
  // 主进程「帮助 → 关于」菜单触发自定义关于对话框
  if (window.futureMemo && window.futureMemo.onShowAbout) {
    window.futureMemo.onShowAbout(() => UI.showAbout());
  }
  switchView('dashboard');
});

window.Views = Views; // 便于各 view 文件挂载
window.SwitchView = switchView;
window.UI = UI;
window.Store = Store;
