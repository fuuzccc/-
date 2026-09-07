// 主题系统：9 个可编辑色槽 + 自动推导派生色，通过 CSS 变量应用到全局
const Theme = (() => {
  const DEFAULT = {
    bg: '#f5f6fa',
    card: '#ffffff',
    border: '#e3e6ee',
    text: '#23272f',
    textMut: '#8a91a1',
    primary: '#1677ff',
    warn: '#e8a13a',
    ok: '#2fae6b',
    danger: '#e5484d',
  };

  const PRESETS = {
    light: DEFAULT,
    block: { bg: '#f4f1ea', card: '#fffdf6', border: '#d9cfc0', text: '#3a3444', textMut: '#9a90a6', primary: '#ff8b3d', warn: '#f5b944', ok: '#3ecf7e', danger: '#ff5d5d' },
    dark: { bg: '#14161c', card: '#1c1f28', border: '#2c3140', text: '#eef0f7', textMut: '#8b92a5', primary: '#4d9dff', warn: '#ffb454', ok: '#4cd08a', danger: '#ff6b6b' },
    paper: { bg: '#f7f3e8', card: '#fffdf5', border: '#e0d4b4', text: '#4a4230', textMut: '#9a8f6e', primary: '#c99a2e', warn: '#d98e2b', ok: '#7ab64e', danger: '#c95050' },
  };

  function hexToRgb(h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function rgbToHex(o) {
    return '#' + ['r', 'g', 'b'].map((k) => Math.round(Math.max(0, Math.min(255, o[k]))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t }); }
  function lighten(c, t) { return mix(c, '#ffffff', t); }
  function darken(c, t) { return mix(c, '#000000', t); }
  function lum(c) { const o = hexToRgb(c); return (0.299 * o.r + 0.587 * o.g + 0.114 * o.b) / 255; }
  function onColor(c) { return lum(c) > 0.62 ? '#1a1d23' : '#ffffff'; }
  function alphaHex(hex, a) { const o = hexToRgb(hex); return `rgba(${o.r},${o.g},${o.b},${a})`; }

  function compute(s) {
    s = Object.assign({}, DEFAULT, s);
    return {
      '--bg': s.bg,
      '--card': s.card,
      '--border': s.border,
      '--text': s.text,
      '--text-mut': s.textMut,
      '--primary': s.primary,
      '--primary-dark': darken(s.primary, 0.24),
      '--primary-soft': mix(s.primary, s.bg, 0.9),
      '--on-primary': onColor(s.primary),
      '--danger': s.danger,
      '--danger-soft': mix(s.danger, s.bg, 0.9),
      '--warn': s.warn,
      '--warn-soft': mix(s.warn, s.bg, 0.9),
      '--ok': s.ok,
      '--ok-soft': mix(s.ok, s.bg, 0.9),
      '--bg-mut': mix(s.card, s.border, 0.55),
      '--bg-soft': mix(s.bg, s.card, 0.7),
      '--check-border': mix(s.textMut, s.card, 0.5),
      '--border-strong': mix(s.border, s.textMut, 0.35),
      '--switch-bg': mix(s.textMut, s.card, 0.55),
      '--shadow': `0 2px 10px ${alphaHex(s.textMut, 0.20)}`,
      '--modal-mask': 'rgba(15,23,42,0.42)',
      '--radius': '14px',
    };
  }

  function applyTheme(s) {
    const vars = compute(s || DEFAULT);
    const root = document.documentElement;
    for (const k in vars) root.style.setProperty(k, vars[k]);
  }

  return { DEFAULT, PRESETS, compute, applyTheme, mix, lighten, darken, onColor, lum };
})();
