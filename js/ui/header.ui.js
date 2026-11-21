import { state } from '../state/store.js';
import { escapeHtml, getMember, getTodayISO } from '../utils/helpers.js';

export function renderUnifiedDateBarHtml(mode = 'shows') {
  const activeMonth = mode === 'ctp' ? state.ctpMonth : mode === 'owner' ? state.ownerMonth : state.selectedMonth;
  const isAllActive = mode === 'shows' ? state.filterAllMonthsInList : mode === 'owner' ? state.ownerAllMonths : false;
  const showAllBtn = (mode === 'shows' || mode === 'owner');
  const allLabel = mode === 'owner' ? 'Cả năm' : 'Tất cả';
  const allClick = mode === 'owner' ? 'ownerActions.toggleAllMonths()' : 'appActions.toggleAllMonths()';
  const monthClickFn = mode === 'ctp' ? 'ctpActions.setMonth' : mode === 'owner' ? 'ownerActions.setMonth' : 'appActions.setMonth';

  return `
    <div class="as-date-bar-wrap">
      <div class="as-year-pinned">
        ${(state.visibleYears || [2026, 2027]).map(y => `
          <button type="button" onclick="appActions.setYear(${y})" class="as-year-btn ${Number(state.selectedYear) === Number(y) ? 'active' : 'inactive'}">${y}</button>
        `).join('')}
      </div>
      <div class="as-divider-v"></div>
      <div class="as-month-scroller">
        ${showAllBtn ? `<button type="button" onclick="${allClick}" class="as-month-btn ${isAllActive ? 'active' : 'inactive'}">${allLabel}</button>` : ''}
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `
          <button type="button" onclick="${monthClickFn}(${m})" class="as-month-btn ${!isAllActive && activeMonth === m ? 'active' : 'inactive'}">T${m}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function renderLiveMarqueeHtml() {
  const uid = state.currentUserId;
  const todayIso = getTodayISO();
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  const tmrIso = `${tmr.getFullYear()}-${String(tmr.getMonth()+1).padStart(2,'0')}-${String(tmr.getDate()).padStart(2,'0')}`;

  const myActive = (state.shows || []).filter(s => s && !s.isCancelled && !s.isHold && (s.memberIds || []).includes(uid));
  const todayShows = myActive.filter(s => s.startDate <= todayIso && s.endDate >= todayIso);
  const tmrShows = myActive.filter(s => s.startDate <= tmrIso && s.endDate >= tmrIso);

  let badge = 'TRỐNG LỊCH', isFree = true, sentence = '';
  if (todayShows.length > 0) {
    badge = 'HÔM NAY'; isFree = false;
    sentence = `Bạn có <b>${todayShows.length} show</b> tại <b class="hl-loc">📍 ${escapeHtml(todayShows[0].location)}</b><span class="hl-reminder">— ⚡ Kiểm tra pin, thẻ nhớ & thiết bị sẵn sàng!</span>`;
  } else if (tmrShows.length > 0) {
    badge = 'NGÀY MAI'; isFree = false;
    sentence = `Ngày mai bạn có <b>${tmrShows.length} show</b> tại <b class="hl-loc">📍 ${escapeHtml(tmrShows[0].location)}</b><span class="hl-reminder">— ⚡ Chuẩn bị thiết bị sẵn sàng!</span>`;
  } else {
    sentence = `Hôm nay & Ngày mai không có show — <b class="hl-crew">Tranh thủ trả deadline hoặc nghỉ ngơi, rủ anh em cà phê lụm job thêm đi nhé!!!</b>`;
  }

  return `
    <div class="as-live-banner-upgraded">
      <div class="as-ticker-wrap">
        <div class="as-fixed-badge ${isFree ? 'free-mode' : ''}">
          <span class="${isFree ? 'as-green-pulse-dot' : 'as-red-pulse-dot'}"></span>
          <span>${badge}</span>
        </div>
        <div class="as-marquee-viewport">
          <div class="as-marquee-track">
            <div class="as-marquee-item">${sentence}</div>
            <div class="as-marquee-item">${sentence}</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

const FALLBACK_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-weight='900' font-size='22' fill='%23fbbf24'%3EA%C3%97S%3C/text%3E%3C/svg%3E";

export function renderHeaderHtml(totalAlerts = 0) {
  const curMem = getMember(state.currentUserId);
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const savedAvatars = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');
  const avatarSrc = prof.avatarUrl || prof.avatar || savedAvatars[state.currentUserId] || '';
  const logoSrc = state.customLogoDataUrl || state.customLogoUrl || localStorage.getItem('as_custom_logo_2026') || './assets/logo.png';

  const uid = state.currentUserId;
  const activeHolds = (state.shows || []).filter(s =>
    s && s.isHold && !s.isCancelled &&
    (s.ownerId === uid || (s.memberIds || []).includes(uid))
  );
  const alertCount = totalAlerts > 0 ? totalAlerts : activeHolds.length;

  return `
    <header style="padding-top: max(18px, env(safe-area-inset-top));" class="bg-slate-900 text-white px-2.5 pb-2 shrink-0 border-b border-slate-800 z-30 space-y-2">
      <div class="flex items-center justify-between gap-1.5">
        <div class="flex items-center gap-2 min-w-0">
          <div onclick="appActions.tapLogoSecret()" class="w-8 h-8 rounded-lg bg-black overflow-hidden flex items-center justify-center shrink-0 shadow-sm border border-slate-700 cursor-pointer active:scale-90">
            <img src="${escapeHtml(logoSrc)}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_SVG}'" alt="Action x Say" class="w-full h-full object-cover" />
          </div>
          <div id="as-two-line-brand-title">
            <span class="as-title-top">LỊCH SHOW</span>
            <span class="as-title-bottom-row">
              <span class="as-title-year">${state.selectedYear}</span>
              <span id="as-compact-sync-pill" class="${state.cloudSynced ? 'is-cloud' : 'is-local'}">
                <span class="as-sync-dot"></span>
                <span>${state.cloudSynced ? 'Cloud' : 'Local'}</span>
              </span>
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1 shrink-0">
          ${state.isAdminMode ? `
            <button type="button" onclick="appActions.enterBackendPortal()" class="px-2 py-1 rounded-full bg-amber-100 border border-amber-300 text-amber-900 text-[9.5px] font-black flex items-center gap-1">
              <i class="fa-solid fa-shield-halved text-amber-600"></i><span>ADMIN</span>
            </button>
          ` : ''}
          <button type="button" id="as-header-bell-btn" onclick="holdBellActions.openBellDrawer()" class="relative ${alertCount > 0 ? 'has-alert' : ''}" title="Thông báo & Giữ lịch">
            <i class="fa-solid fa-bell text-xs"></i>
            ${alertCount > 0 ? `<span id="as-header-bell-badge" style="color: #ffffff !important; background-color: #e11d48 !important;" class="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-black flex items-center justify-center leading-none shadow">${alertCount}</span>` : ''}
          </button>
          <button type="button" onclick="appActions.openGuideModal()" title="Hướng dẫn cài App iPhone" class="w-7 h-7 rounded-lg flex items-center justify-center border text-xs bg-slate-800 text-slate-300 border-slate-700">
            <i class="fa-solid fa-mobile-screen-button"></i>
          </button>
          <button type="button" onclick="appActions.toggleZenFullscreen()" class="w-7 h-7 rounded-lg flex items-center justify-center border text-xs bg-slate-800 text-slate-300 border-slate-700">
            <i class="fa-solid ${state.zenFullscreen ? 'fa-compress' : 'fa-expand'}"></i>
          </button>
          <button type="button" onclick="appActions.openCrewPassModal()" title="Thẻ VIP & Hồ sơ" class="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full p-0.5 pr-1.5">
            ${avatarSrc
              ? `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(curMem.name)}" class="w-6 h-6 rounded-full object-cover border border-amber-300/80 shrink-0" />`
              : `<span style="background-color:${curMem.bg};color:${curMem.text}" class="w-6 h-6 rounded-full text-[9px] font-black uppercase flex items-center justify-center shrink-0">${escapeHtml((curMem.shortLabel || curMem.name || 'AS').slice(0, 2))}</span>`
            }
            <i class="fa-solid fa-key text-[9px] text-amber-300"></i>
          </button>
        </div>
      </div>

      ${renderLiveMarqueeHtml()}

      ${state.readonlyMaintenanceMode ? `
        <div class="bg-amber-100 border border-amber-400 text-amber-900 rounded-xl px-3 py-1.5 text-[11px] font-extrabold flex items-center gap-1.5">
          <span>🛡️</span><span>HỆ THỐNG ĐANG KHÓA BẢO TRÌ (Chế độ chỉ xem)</span>
        </div>
      ` : ''}

      ${(state.studioBroadcast?.enabled && state.studioBroadcast?.text) ? `
        <div class="bg-rose-50 border border-rose-300 text-rose-700 rounded-xl px-3 py-1.5 text-[11px] font-extrabold flex items-center gap-2">
          <span class="bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full shrink-0">📢 THÔNG BÁO</span>
          <span class="flex-1">${escapeHtml(state.studioBroadcast.text)}</span>
        </div>
      ` : ''}

      ${(state.activeTab === 'shows' || state.activeTab === 'matrix') ? renderUnifiedDateBarHtml(state.activeTab) : ''}
    </header>
  `;
}

export function renderBottomNavHtml() {
  return `
    <nav style="padding-bottom: max(4px, env(safe-area-inset-bottom));" class="bg-white border-t border-slate-200 px-1 pt-1 shrink-0 z-30 flex items-center justify-around">
      <button type="button" onclick="appActions.setTab('shows')" class="flex flex-col items-center py-0.5 px-2 rounded-xl ${state.activeTab === 'shows' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'}">
        <i class="fa-solid fa-table-list text-sm"></i><span class="text-[10px] mt-0.5">Lịch Show</span>
      </button>
      <button type="button" onclick="appActions.setTab('matrix')" class="flex flex-col items-center py-0.5 px-2 rounded-xl ${state.activeTab === 'matrix' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'}">
        <i class="fa-solid fa-calendar-days text-sm"></i><span class="text-[10px] mt-0.5">Công Tác T${state.selectedMonth}</span>
      </button>
      <button type="button" data-action="open-add-show" onclick="appActions.openAddModal()" class="active:scale-95 text-white font-extrabold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1 text-xs shrink-0">
        <i class="fa-solid fa-bolt"></i><span>NỔ SHOW</span>
      </button>
      <button type="button" onclick="appActions.setTab('free_finder')" class="flex flex-col items-center py-0.5 px-2 rounded-xl ${state.activeTab === 'free_finder' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'}">
        <i class="fa-solid fa-user-check text-sm"></i><span class="text-[10px] mt-0.5">Người Rảnh</span>
      </button>
      <button type="button" onclick="appActions.setTab('ctp')" class="flex flex-col items-center py-0.5 px-2 rounded-xl ${state.activeTab === 'ctp' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'}">
        <i class="fa-solid fa-file-invoice-dollar text-sm"></i><span class="text-[10px] mt-0.5">Tính CTP</span>
      </button>
      <button type="button" onclick="appActions.setTab('owner_stats')" class="flex flex-col items-center py-0.5 px-2 rounded-xl ${state.activeTab === 'owner_stats' ? 'text-indigo-600 font-extrabold' : 'text-slate-400 font-medium'}">
        <i class="fa-solid fa-wallet text-sm ${state.activeTab === 'owner_stats' ? 'text-amber-500' : ''}"></i><span class="text-[10px] mt-0.5">Công Nợ</span>
      </button>
    </nav>
  `;
}
