import { state } from '../state/store.js';
import { escapeHtml, getMember, getTodayISO } from '../utils/helpers.js';

const FALLBACK_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-weight='900' font-size='22' fill='%23fbbf24'%3EA%C3%97S%3C/text%3E%3C/svg%3E";

function getTomorrowISO(todayISO) {
  const [y, m, d] = todayISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d + 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function renderTodayTomorrowTickerHtml() {
  const today = getTodayISO();
  const tomorrow = getTomorrowISO(today);
  const activeShows = (state.shows || []).filter(s => s && !s.isCancelled && !s.isHold && s.startDate);

  const todayShows = activeShows.filter(s => s.startDate <= today && (s.endDate || s.startDate) >= today);
  const tomorrowShows = activeShows.filter(s => s.startDate <= tomorrow && (s.endDate || s.startDate) >= tomorrow);

  if (!todayShows.length && !tomorrowShows.length) return '';

  const parts = [];
  if (todayShows.length) {
    parts.push(`🔥 HÔM NAY: ${todayShows.map(s => s.location).join(' • ')}`);
  }
  if (tomorrowShows.length) {
    parts.push(`📅 NGÀY MAI: ${tomorrowShows.map(s => s.location).join(' • ')}`);
  }

  return `
    <div class="bg-slate-900 text-amber-300 text-[10.5px] font-bold px-3 py-1 overflow-hidden whitespace-nowrap border-t border-slate-800">
      <div class="inline-block animate-marquee">${escapeHtml(parts.join('   |   '))}</div>
    </div>
  `;
}

export function renderHeaderHtml(bellAlertsCount = 0) {
  const years = Array.isArray(state.visibleYears) && state.visibleYears.length ? state.visibleYears : [2026];

  // Chế độ mở rộng: ẩn toàn bộ thông báo, logo, chữ chạy — chỉ giữ thanh năm/tháng + icon thu nhỏ
  if (state.zenFullscreen) {
    return `
      <header class="bg-white border-b border-slate-200 px-2.5 py-1.5 shrink-0 z-30 flex items-center gap-2">
        <select onchange="appActions.setYear(this.value)" class="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-800 shrink-0 focus:outline-none">
          ${years.map(y => `<option value="${y}" ${state.selectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>

        <div class="as-month-scroller flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
          ${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `
            <button type="button" onclick="appActions.setMonth(${m})" class="as-month-btn px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap shrink-0 transition ${
              !state.filterAllMonthsInList && state.selectedMonth === m
                ? 'active bg-slate-900 text-amber-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }">T${m}</button>
          `).join('')}
        </div>

        <button type="button" onclick="appActions.toggleZenFullscreen()" title="Thu nhỏ về bình thường" class="w-7 h-7 rounded-lg bg-slate-900 text-amber-300 hover:bg-slate-800 flex items-center justify-center shrink-0">
          <i class="fa-solid fa-compress text-xs"></i>
        </button>
      </header>
    `;
  }

  const curMem = getMember(state.currentUserId);
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const savedAvatars = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');
  const avatarSrc = prof.avatarUrl || prof.avatar || savedAvatars[state.currentUserId] || '';
  const logoSrc = state.customLogoDataUrl || localStorage.getItem('as_custom_logo_2026') || FALLBACK_LOGO_SVG;
  const broadcast = state.studioBroadcast;

  return `
    <header class="bg-white border-b border-slate-200 shrink-0 z-30">
      ${broadcast?.enabled && broadcast?.text ? `
        <div class="bg-amber-400 text-slate-950 text-[11px] font-black px-3 py-1 text-center truncate">
          📢 ${escapeHtml(broadcast.text)}
        </div>
      ` : ''}

      <div class="px-2.5 py-1.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <div onclick="appActions.tapLogoSecret()" class="w-8 h-8 rounded-xl bg-slate-950 overflow-hidden shrink-0 cursor-pointer border border-slate-200">
            <img data-brand-logo="true" src="${escapeHtml(logoSrc)}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_SVG}'" alt="Action x Say" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0">
            <div class="font-black text-xs text-slate-900 leading-tight truncate">ACTION × SAY</div>
            <div class="text-[9.5px] font-bold text-slate-400 leading-tight">Lịch Show ${state.selectedYear}</div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button type="button" onclick="appActions.toggleZenFullscreen()" title="Mở rộng toàn màn hình" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center">
            <i class="fa-solid fa-expand text-xs"></i>
          </button>

          <button type="button" onclick="holdBellActions.openBellDrawer()" title="Thông báo & Giữ lịch" class="relative w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center">
            <i class="fa-solid fa-bell text-xs"></i>
            ${bellAlertsCount > 0 ? `<span class="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">${bellAlertsCount}</span>` : ''}
          </button>

          <button type="button" onclick="appActions.openCrewPassModal()" class="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white">
            ${avatarSrc
              ? `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(curMem.name)}" class="w-6 h-6 rounded-lg object-cover shrink-0" />`
              : `<span style="background-color:${curMem.bg || '#334155'};color:${curMem.text || '#ffffff'}" class="w-6 h-6 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0">${escapeHtml((curMem.shortLabel || curMem.name || 'AS').slice(0, 2))}</span>`
            }
            <span class="text-[11px] font-black max-w-[72px] truncate">${escapeHtml(curMem.name)}</span>
          </button>
        </div>
      </div>

      <div class="px-2.5 pb-1.5 flex items-center gap-1.5">
        <select onchange="appActions.setYear(this.value)" class="px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-800 shrink-0 focus:outline-none">
          ${years.map(y => `<option value="${y}" ${state.selectedYear === y ? 'selected' : ''}>${y}</option>`).join('')}
        </select>

        <div class="as-month-scroller flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar">
          ${Array.from({ length: 12 }, (_, i) => i + 1).map(m => `
            <button type="button" onclick="appActions.setMonth(${m})" class="as-month-btn px-2.5 py-1 rounded-lg text-[11px] font-black whitespace-nowrap shrink-0 transition ${
              !state.filterAllMonthsInList && state.selectedMonth === m
                ? 'active bg-slate-900 text-amber-300'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }">T${m}</button>
          `).join('')}
        </div>
      </div>

      ${renderTodayTomorrowTickerHtml()}
    </header>
  `;
}

export function renderBottomNavHtml() {
  return `
    <nav style="padding-bottom: clamp(2px, env(safe-area-inset-bottom), 10px);" class="bg-white border-t border-slate-200 px-2 sm:px-6 pt-1 sm:pt-1.5 shrink-0 z-30 grid grid-cols-[1fr_auto_1fr] sm:flex sm:items-center sm:justify-around items-center gap-1.5">
      <div class="flex items-center justify-around gap-0.5 min-w-0 sm:contents">
        <button type="button" onclick="appActions.setTab('shows')" class="flex flex-col items-center py-0.5 px-1 sm:px-2 rounded-xl whitespace-nowrap transition-colors ${state.activeTab === 'shows' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
          <i class="fa-solid fa-table-list text-[11px] sm:text-sm"></i>
          <span class="text-[8px] sm:text-[11px] tracking-tighter leading-none mt-1">SHOW</span>
        </button>
        <button type="button" onclick="appActions.setTab('matrix')" class="flex flex-col items-center py-0.5 px-1 sm:px-2 rounded-xl whitespace-nowrap transition-colors ${state.activeTab === 'matrix' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
          <i class="fa-solid fa-calendar-days text-[11px] sm:text-sm"></i>
          <span class="text-[8px] sm:text-[11px] tracking-tighter leading-none mt-1">CÔNG TÁC T${state.selectedMonth}</span>
        </button>
      </div>

      <button type="button" data-action="open-add-show" onclick="appActions.openAddModal()" class="active:scale-95 text-white font-black px-2.5 sm:px-5 py-1.5 sm:py-2 rounded-full shadow-sm flex items-center justify-center gap-1 text-[9.5px] sm:text-xs whitespace-nowrap shrink-0">
        <i class="fa-solid fa-bolt text-[9px] sm:text-xs"></i><span>NỔ SHOW</span>
      </button>

      <div class="flex items-center justify-between pl-1.5 pr-1 min-w-0 sm:contents">
        <button type="button" onclick="appActions.setTab('free_finder')" class="flex flex-col items-center py-1 px-0.5 sm:px-2 rounded-xl whitespace-nowrap transition-colors ${state.activeTab === 'free_finder' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
          <i class="fa-solid fa-user-check text-[11px] sm:text-sm"></i>
          <span class="text-[8px] sm:text-[11px] tracking-tighter leading-none mt-1">NS</span>
        </button>
        <button type="button" onclick="appActions.setTab('ctp')" class="flex flex-col items-center py-1 px-0.5 sm:px-2 rounded-xl whitespace-nowrap transition-colors ${state.activeTab === 'ctp' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
          <i class="fa-solid fa-file-invoice-dollar text-[11px] sm:text-sm"></i>
          <span class="text-[8px] sm:text-[11px] tracking-tighter leading-none mt-1">CTP</span>
        </button>
        <button type="button" onclick="appActions.setTab('owner_stats')" class="flex flex-col items-center py-1 px-0.5 sm:px-2 rounded-xl whitespace-nowrap transition-colors ${state.activeTab === 'owner_stats' ? 'text-indigo-600 font-extrabold' : 'text-slate-500 hover:text-slate-800 font-medium'}">
          <i class="fa-solid fa-wallet text-[11px] sm:text-sm ${state.activeTab === 'owner_stats' ? 'text-amber-500' : ''}"></i>
          <span class="text-[8px] sm:text-[11px] tracking-tighter leading-none mt-1">CÔNG NỢ</span>
        </button>
      </div>
    </nav>
  `;
}
