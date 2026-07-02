// ── Tailwind 自訂設定 / Tailwind custom config ────────────────────────────────
// 把品牌色與字型集中定義，之後在 HTML 用 bg-navy、text-brand-red 等等就行。
// 注意：這個檔案要在 Tailwind CDN <script> 之後、頁面內容之前載入（放在 <head>）。
// Centralize brand colors + font. Load this AFTER the Tailwind CDN script,
// still inside <head>, so the custom classes are generated correctly.
tailwind.config = {
  theme: {
    extend: {
      colors: {
        navy:   '#1a2340',  // 主色 / primary（深藍）
        'navy-light': '#2d3a5c',
        'brand-red': '#e6304a',
        'brand-blue':'#4dabf7',
        'brand-purple':'#845ef7',
        'brand-gold':'#f59f00',
        'brand-green':'#22c55e',
        ink:    '#1a2340',  // 文字 / body text
        muted:  '#6b7280',  // 次要文字 / secondary text
        line:   '#e5e7eb',  // 邊框線 / borders
        canvas: '#f4f6fb',  // 頁面底色 / page background
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 2px 16px rgba(26,35,64,.10)',
        tiny: '0 1px 4px rgba(26,35,64,.06)',
      },
    },
  },
};
