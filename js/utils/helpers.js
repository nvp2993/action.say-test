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

  const rules = Array.isArray(state.customColorRules) ? state.customColorRules : [];

  const matchKeywords = (kwString) => {
    const tokens = String(kwString || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    return tokens.some(t => combined.includes(t));
  };

  // 1. Ưu tiên địa điểm tùy chỉnh riêng (không bắt đầu bằng def_)
  for (const r of rules) {
    if (!String(r?.id || '').startsWith('def_') && matchKeywords(r?.keyword)) {
      return r.color;
    }
  }

  // 2. 9 nhóm mặc định (có thể chỉnh màu & tên trực tiếp trong Admin)
  const defaultGroups = [
    { id: 'def_muine',   keyword: 'mũi né, mui ne, nha trang, tây ninh, tay ninh', color: '#f4c29f' },
    { id: 'def_hotram',  keyword: 'hồ tràm, ho tram, vũng tàu, vung tau',          color: '#c9b8df' },
    { id: 'def_ninhchu', keyword: 'ninh chữ, ninh chu, cam ranh, cưới, cuoi, lk',  color: '#9ec999' },
    { id: 'def_saigon',  keyword: 'sài gòn, sai gon, sg, củ chi, cu chi, tsn',     color: '#9ad0f0' },
    { id: 'def_hcm',     keyword: 'hcm, cần giờ, can gio, nhà bè, nha be',         color: '#bce3cf' },
    { id: 'def_cantho',  keyword: 'cần thơ, can tho, bận, ban',                    color: '#f5dc82' },
    { id: 'def_dalat',   keyword: 'đà lạt, da lat, đl, dl',                        color: '#d2e391' },
    { id: 'def_kega',    keyword: 'kê gà, ke ga, phú quốc, phu quoc',              color: '#faeec7' },
    { id: 'def_longan',  keyword: 'long an, hà nội, ha noi, đồng nai, dong nai',   color: '#cfd6dc' }
  ];

  for (const g of defaultGroups) {
    const edited = rules.find(r => r?.id === g.id);
    const kw = edited ? edited.keyword : g.keyword;
    const col = edited ? edited.color : g.color;
    if (matchKeywords(kw)) return col;
  }

  // 3. Nhóm mặc định cho các lịch khác
  const otherEdited = rules.find(r => r?.id === 'def_other');
  return otherEdited ? otherEdited.color : '#dce9fa';
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
