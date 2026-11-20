import { state, triggerRender } from '../state/store.js';
import { INITIAL_TEAM_MEMBERS, BANK_LIST } from '../config/constants.js';

export function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function formatDayMonth(dateStr = '') {
  const p = String(dateStr).split('-');
  return p.length === 3 ? `${parseInt(p[2], 10)}/${parseInt(p[1], 10)}` : dateStr;
}

export function formatDdMmYyyy(dateStr = '') {
  const p = String(dateStr).split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : (dateStr || 'Chọn ngày');
}

export function getShowDays(sh) {
  if (!sh || !sh.startDate || !sh.endDate) return 1;
  const s = new Date(sh.startDate + 'T00:00:00');
  const e = new Date(sh.endDate + 'T00:00:00');
  const diff = Math.round((e - s) / 86400000) + 1;
  return diff > 0 ? diff : 1;
}

export function formatCompactMoneyPlain(val) {
  const n = Number(val) || 0;
  if (n <= 0) return '-';
  if (n >= 1000000) {
    const tr = n / 1000000;
    return `${Number.isInteger(tr) ? tr : tr.toFixed(2).replace(/\.?0+$/, '')}tr`;
  }
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n.toLocaleString('vi-VN')}đ`;
}

export function getMember(id) {
  return (state.members || []).find(m => m.id === id) || state.members[0] || INITIAL_TEAM_MEMBERS[0];
}

export function getSortedMembers() {
  return [...(state.members || [])].sort((a, b) => (a.order || 99) - (b.order || 99));
}

export function normalizeRoleName(r = '') {
  return String(r).replace(/^[🎥📸✂️🚁🎬💡]\s*/u, '').trim();
}

export function formatMemberRolesClean(roleVal) {
  if (!roleVal) return '';
  const arr = Array.isArray(roleVal) ? roleVal : [roleVal];
  return arr.map(normalizeRoleName).filter(Boolean).join(', ');
}

export function renderPillHtml(memberId, size = 'xs', extraClasses = '', onClickAttr = '', roleTag = '') {
  const m = state.members.find(x => x.id === memberId);
  if (!m) return '';
  const sizeCls = size === 'xs' ? 'px-1.5 py-0.5 text-[9px]' : size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  const roleStr = formatMemberRolesClean(roleTag);
  const roleSpan = roleStr ? `<span class="ml-1 opacity-95 font-bold">• ${escapeHtml(roleStr)}</span>` : '';
  return `<span ${onClickAttr} style="background-color:${m.bg};color:${m.text}" class="inline-flex items-center font-extrabold rounded-full tracking-wide uppercase select-none shadow-2xs ${sizeCls} ${extraClasses}">${escapeHtml(m.shortLabel)}${roleSpan}</span>`;
}

export function resolveDynamicLocationColor(location = '', partner = '') {
  const loc = String(location || '').trim().toLowerCase();
  const part = String(partner || '').trim().toLowerCase();
  const combined = `${loc} ${part}`.trim();

  // 1. Ưu tiên màu tùy chỉnh riêng do Admin cài đặt (nếu có)
  const rules = state.customColorRules || [];
  for (const r of rules) {
    const kw = String(r?.keyword || '').trim().toLowerCase();
    if (kw && combined.includes(kw)) return r.color;
  }

  // 2. Nếu không có cài đặt riêng -> Tự động gán 1 trong 30 màu Pastel theo tên địa điểm
  const PASTEL_30 = [
    '#dbeafe', '#bfdbfe', '#bae6fd', '#a5f3fc', '#99f6e4',
    '#a7f3d0', '#bbf7d0', '#d9f99d', '#fef08a', '#fde68a',
    '#fed7aa', '#fecdd3', '#fbcfe8', '#f5d0fe', '#e9d5ff',
    '#ddd6fe', '#c7d2fe', '#e2e8f0', '#fef3c7', '#dcfce7',
    '#e0f2fe', '#ede9fe', '#fce7f3', '#ffedd5', '#ccfbf1',
    '#ecfccb', '#fae8ff', '#ffe4e6', '#f3e8ff', '#e0e7ff'
  ];

  const key = loc || 'default';
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return PASTEL_30[Math.abs(hash) % PASTEL_30.length];
}

export function getBankName(bin) {
  return BANK_LIST.find(b => b.bin === String(bin))?.name || 'Ngân hàng';
}

export function buildVietQrUrl(bankBin, bankAcc) {
  const cleanAcc = String(bankAcc || '').replace(/\s+/g, '').trim();
  if (!cleanAcc) return '';
  return `https://img.vietqr.io/image/${String(bankBin || '970436').trim()}-${cleanAcc}-qr_only.png`;
}

export function playStudioSound(type = 'noshow') {
  if (!state.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    if (type === 'noshow') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      osc.frequency.setValueAtTime(1046.5, now + 0.24);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.start(now); osc.stop(now + 0.45);
    } else if (type === 'lum') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now);
      osc.frequency.setValueAtTime(1318.5, now + 0.09);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc.start(now); osc.stop(now + 0.4);
    }
  } catch {}
}

let toastTimer = null;
export function showToast(message, type = 'success') {
  state.toast = { message, type };
  triggerRender();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    state.toast = null;
    triggerRender();
  }, 2400);
}
