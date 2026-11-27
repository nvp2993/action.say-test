import { state } from '../state/store.js';
import { escapeHtml, getMember } from '../utils/helpers.js';
import { getBusyMembersMap } from '../services/show.service.js';

function formatIsoToDmy(isoStr) {
  const m = String(isoStr || '').trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return '--/--/----';
  const yyyy = m[1];
  const mm = String(m[2]).padStart(2, '0');
  const dd = String(m[3]).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}`;
}

export function renderCrewBoardTabHtml() {
  const busyMap = getBusyMembersMap(state.checkStart, state.checkEnd);
  const savedAvatars = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');

  const sortedMembers = [...(state.members || [])].sort((a, b) => {
    const aBusy = !!busyMap[a.id];
    const bBusy = !!busyMap[b.id];
    if (aBusy !== bBusy) return aBusy ? 1 : -1;
    if (a.id === state.currentUserId) return -1;
    if (b.id === state.currentUserId) return 1;
    return (Number(a.order) || 99) - (Number(b.order) || 99);
  });

  const freeList = sortedMembers.filter(m => !busyMap[m.id]);
  const busyList = sortedMembers.filter(m => !!busyMap[m.id]);
  const totalCount = sortedMembers.length;
  const freePct = totalCount > 0 ? Math.round((freeList.length / totalCount) * 100) : 0;

  const locationGroupMap = new Map();
  busyList.forEach(m => {
    const rawLabels = Array.isArray(busyMap[m.id]) ? busyMap[m.id] : [];
    const labels = rawLabels.length ? rawLabels : ['Có lịch'];
    labels.forEach(lbl => {
      const locName = String(lbl || 'Có lịch').trim() || 'Có lịch';
      if (!locationGroupMap.has(locName)) {
        locationGroupMap.set(locName, { location: locName, members: [] });
      }
      const entry = locationGroupMap.get(locName);
      if (!entry.members.some(x => x.id === m.id)) {
        entry.members.push(m);
      }
    });
  });
  const busyByLocation = Array.from(locationGroupMap.values()).sort(
    (a, b) => b.members.length - a.members.length || a.location.localeCompare(b.location, 'vi')
  );

  const startDmy = formatIsoToDmy(state.checkStart);
  const endDmy = formatIsoToDmy(state.checkEnd);

  const renderAvatarBox = (m) => {
    const prof = state.memberProfiles?.[m.id] || {};
    const avatarSrc = prof.avatarUrl || prof.avatar || savedAvatars[m.id] || '';
    if (avatarSrc) {
      return `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(m.name)}" class="w-10 h-10 rounded-2xl object-cover border border-slate-200/90 shrink-0" />`;
    }
    return `
      <span style="background-color:${m.bg || '#334155'};color:${m.text || '#ffffff'}" class="w-10 h-10 rounded-2xl text-xs font-black uppercase flex items-center justify-center shrink-0">
        ${escapeHtml((m.shortLabel || m.name || 'AS').slice(0, 2))}
      </span>
    `;
  };

  const statCards = [
    { label: 'TỔNG NHÂN SỰ', val: `${totalCount} người`, wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-amber-300' },
    { label: 'SẴN SÀNG ĐI SHOW', val: `${freeList.length} rảnh`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-emerald-700' },
    { label: 'ĐANG CÓ LỊCH', val: `${busyList.length} bận`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-amber-700' },
    { label: 'TỶ LỆ RẢNH', val: `${freePct}%`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-indigo-700' }
  ];

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      <!-- Top Bar đồng bộ CTP / Công nợ -->
      <div class="bg-[#f8fafc] px-3 py-2.5 border-b border-slate-200/90 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase tracking-tight truncate">👥 NHÂN SỰ RẢNH / BẬN (${totalCount})</span>
          <button
            type="button"
            onclick="appActions.openAddModal('${escapeHtml(state.checkStart)}')"
            class="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold transition shrink-0"
          >⚡ Nổ Show Ngày Này</button>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200/90 px-3 py-1.5 flex items-center justify-between gap-2 max-w-2xl">
          <div class="min-w-0 flex-1 flex items-center justify-between gap-1.5">
            <div class="min-w-0">
              <div class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Từ ngày</div>
              <div class="font-mono font-black text-[11.5px] text-slate-900 tabular-nums">${escapeHtml(startDmy)}</div>
            </div>
            <input
              type="date"
              aria-label="Từ ngày"
              value="${escapeHtml(state.checkStart)}"
              onchange="appActions.setCheckDate('checkStart', this.value)"
              class="w-7 h-7 bg-slate-50 border border-slate-200/80 rounded-lg text-[10px] font-mono text-slate-700 shrink-0 focus:outline-none"
            />
          </div>

          <span class="text-slate-300 font-black shrink-0">→</span>

          <div class="min-w-0 flex-1 flex items-center justify-between gap-1.5">
            <div class="min-w-0">
              <div class="text-[9px] font-black text-slate-400 uppercase tracking-wider">Đến ngày</div>
              <div class="font-mono font-black text-[11.5px] text-slate-900 tabular-nums">${escapeHtml(endDmy)}</div>
            </div>
            <input
              type="date"
              aria-label="Đến ngày"
              min="${escapeHtml(state.checkStart)}"
              value="${escapeHtml(state.checkEnd)}"
              onchange="appActions.setCheckDate('checkEnd', this.value)"
              class="w-7 h-7 bg-slate-50 border border-slate-200/80 rounded-lg text-[10px] font-mono text-slate-700 shrink-0 focus:outline-none"
            />
          </div>
        </div>
      </div>

      <!-- Layout 2 cột đồng bộ CTP / Công nợ -->
      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[336px_minmax(0,1fr)]">
        <!-- Sidebar Desktop -->
        <aside class="hidden lg:flex flex-col gap-3 p-3.5 bg-[#f8fafc] border-r border-slate-200/90 overflow-y-auto custom-scroll">
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2 text-[11px]">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tổng quan quân số</span>
              <span class="font-mono font-black text-slate-900">${totalCount} thành viên</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 pt-0.5">
              <div class="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-slate-200/70 flex items-center justify-between">
                <span class="text-slate-500 font-semibold">Sẵn sàng</span>
                <span class="font-mono font-black text-emerald-700">${freeList.length}</span>
              </div>
              <div class="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-slate-200/70 flex items-center justify-between">
                <span class="text-slate-500 font-semibold">Đang bận</span>
                <span class="font-mono font-black text-amber-700">${busyList.length}</span>
              </div>
            </div>
            <div class="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
              <div style="width:${freePct}%" class="bg-emerald-500 h-full transition-all"></div>
              <div style="width:${100 - freePct}%" class="bg-amber-400 h-full transition-all"></div>
            </div>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Chạm nhanh nổ show</span>
              <span class="font-mono font-bold text-[10px] text-emerald-700">${freeList.length} rảnh</span>
            </div>
            ${freeList.length === 0 ? `
              <div class="text-[11px] text-slate-400 py-3 text-center">Toàn bộ ekip đều kín lịch</div>
            ` : `
              <div class="flex flex-wrap gap-1.5">
                ${freeList.map(m => `
                  <button
                    type="button"
                    onclick="appActions.openAddModal('${escapeHtml(state.checkStart)}', '${escapeHtml(m.id)}')"
                    class="px-2.5 py-1 rounded-full bg-[#f8fafc] hover:bg-emerald-50 border border-slate-200/90 hover:border-emerald-300 text-[10.5px] font-extrabold text-slate-800 hover:text-emerald-800 transition"
                  >+ ${escapeHtml(m.name)}</button>
                `).join('')}
              </div>
            `}
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Tóm tắt lịch bận theo địa điểm</span>
              <span class="font-mono font-bold text-[10px] text-amber-700">${busyByLocation.length} địa điểm</span>
            </div>
            ${busyByLocation.length === 0 ? `
              <div class="text-[11px] text-emerald-700 font-semibold py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                ✓ Không có thành viên nào trùng lịch
              </div>
            ` : `
              <div class="space-y-1.5">
                ${busyByLocation.map(grp => `
                  <div class="px-2.5 py-2 rounded-xl bg-[#f8fafc] border border-slate-200/80 space-y-1">
                    <div class="flex items-center justify-between gap-2">
                      <span class="font-black text-[11px] text-slate-900 truncate">📍 ${escapeHtml(grp.location)}</span>
                      <span class="px-1.5 py-0.5 rounded-md bg-amber-50 border border-amber-200/90 font-mono font-black text-[9.5px] text-amber-800 shrink-0">${grp.members.length} người</span>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      ${grp.members.map(mem => `
                        <span class="px-2 py-0.5 rounded-full bg-white border border-slate-200/80 text-[10px] font-bold text-slate-700">${escapeHtml(mem.name)}</span>
                      `).join('')}
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>
        </aside>

        <!-- Main Content -->
        <div id="crew-board-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll px-3 sm:px-4 pb-4">
          <div class="max-w-6xl mx-auto space-y-3">
            <!-- Sticky 4 Stat Cards -->
            <div class="sticky top-0 z-20 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f1f5f9] -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 pb-2.5 border-b border-slate-200/80">
              ${statCards.map(c => `
                <div class="px-3.5 py-2 rounded-2xl border shadow-2xs transition ${c.wrapCls}">
                  <span class="text-[9px] font-extrabold uppercase tracking-wider block truncate ${c.labelCls}">${c.label}</span>
                  <span class="font-black font-mono tabular-nums text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
                </div>
              `).join('')}
            </div>

            <!-- Section 1: Ekip sẵn sàng -->
            <section class="bg-white rounded-3xl border border-slate-200/90 p-3.5 sm:p-4 space-y-3 shadow-2xs">
              <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <h3 class="font-black text-xs text-slate-900 uppercase tracking-tight">Ekip sẵn sàng (${freeList.length}/${totalCount})</h3>
                </div>
                <span class="text-[10px] font-bold text-slate-400">Chạm thẻ để nổ show</span>
              </div>

              ${freeList.length === 0 ? `
                <div class="py-6 text-center text-[11px] text-slate-400 bg-[#f8fafc] rounded-2xl border border-dashed border-slate-200">
                  Không có nhân sự rảnh trong khoảng ngày này.
                </div>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  ${freeList.map(m => `
                    <button
                      type="button"
                      onclick="appActions.openAddModal('${escapeHtml(state.checkStart)}', '${escapeHtml(m.id)}')"
                      class="p-2.5 rounded-2xl bg-[#f8fafc] hover:bg-emerald-50/70 border border-slate-200/90 hover:border-emerald-300 flex items-center justify-between gap-2.5 text-left transition active:scale-[0.99]"
                    >
                      <div class="flex items-center gap-2.5 min-w-0">
                        ${renderAvatarBox(m)}
                        <div class="min-w-0">
                          <div class="font-black text-xs text-slate-900 uppercase truncate">${escapeHtml(m.name)}</div>
                          <div class="text-[10px] font-extrabold text-emerald-700 mt-0.5">● Sẵn sàng</div>
                        </div>
                      </div>
                      <span class="px-2 py-0.5 rounded-lg bg-white border border-slate-200/90 text-[10px] font-extrabold text-slate-700 shrink-0">+ Show</span>
                    </button>
                  `).join('')}
                </div>
              `}
            </section>

            <!-- Section 2: Ekip đang có lịch -->
            <section class="bg-white rounded-3xl border border-slate-200/90 p-3.5 sm:p-4 space-y-3 shadow-2xs">
              <div class="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
                  <h3 class="font-black text-xs text-slate-900 uppercase tracking-tight">Ekip đang có lịch (${busyList.length}/${totalCount})</h3>
                </div>
                <span class="text-[10px] font-bold text-slate-400">Lịch trùng ngày</span>
              </div>

              ${busyList.length === 0 ? `
                <div class="py-6 text-center text-[11px] text-emerald-700 font-semibold bg-[#f8fafc] rounded-2xl border border-dashed border-slate-200">
                  ✓ Tất cả nhân sự đều đang rảnh.
                </div>
              ` : `
                <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                  ${busyList.map(m => {
                    const showLabels = busyMap[m.id] || [];
                    const firstShow = showLabels[0] || 'Có lịch';
                    const extraCount = showLabels.length > 1 ? ` (+${showLabels.length - 1})` : '';
                    return `
                      <div class="p-2.5 rounded-2xl bg-[#f8fafc] border border-slate-200/90 flex items-center justify-between gap-2.5">
                        <div class="flex items-center gap-2.5 min-w-0">
                          ${renderAvatarBox(m)}
                          <div class="min-w-0">
                            <div class="font-black text-xs text-slate-900 uppercase truncate">${escapeHtml(m.name)}</div>
                            <div class="text-[10.5px] font-semibold text-slate-600 truncate mt-0.5" title="${escapeHtml(showLabels.join(', '))}">
                              📍 ${escapeHtml(firstShow + extraCount)}
                            </div>
                          </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300/90 text-amber-800 text-[10px] font-extrabold shrink-0">Đi show</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              `}
            </section>
          </div>
        </div>
      </div>
    </div>
  `;
}
