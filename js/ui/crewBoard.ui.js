import { state } from '../state/store.js';
import { escapeHtml, getMember } from '../utils/helpers.js';
import { getBusyMembersMap } from '../services/show.service.js';

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

  const renderAvatarBox = (m) => {
    const prof = state.memberProfiles?.[m.id] || {};
    const avatarSrc = prof.avatarUrl || prof.avatar || savedAvatars[m.id] || '';
    if (avatarSrc) {
      return `<img src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(m.name)}" class="w-10 h-10 rounded-2xl object-cover border border-slate-200 shrink-0" />`;
    }
    return `
      <span style="background-color:${m.bg || '#334155'};color:${m.text || '#ffffff'}" class="w-10 h-10 rounded-2xl text-xs font-black uppercase flex items-center justify-center shrink-0">
        ${escapeHtml((m.shortLabel || m.name || 'AS').slice(0, 2))}
      </span>
    `;
  };

  return `
    <div id="crew-board-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll bg-slate-100 px-3 py-3 space-y-3 text-xs">
      <div class="flex items-center justify-between gap-2">
        <div>
          <div class="text-[9.5px] font-extrabold tracking-wider text-slate-400 uppercase">ACTION × SAY • CREW BOARD</div>
          <h2 class="font-black text-sm text-slate-900 uppercase">NHÂN SỰ RẢNH / BẬN</h2>
        </div>
        <div class="px-2.5 py-1 rounded-full bg-white border border-slate-200 text-[10.5px] font-extrabold shrink-0">
          <span class="text-emerald-600">${freeList.length} rảnh</span>
          <span class="text-slate-300 mx-1">•</span>
          <span class="text-amber-600">${busyList.length} bận</span>
        </div>
      </div>

      <div class="bg-white rounded-2xl border border-slate-200/80 px-3 py-2 flex items-center justify-between gap-2">
        <div class="min-w-0 flex-1">
          <label class="block text-[9px] font-extrabold text-slate-400 uppercase">TỪ NGÀY</label>
          <input type="date" value="${escapeHtml(state.checkStart)}" onchange="appActions.setCheckDate('checkStart', this.value)" class="w-full bg-transparent text-xs font-mono font-black text-slate-900 focus:outline-none" />
        </div>
        <span class="text-slate-400 font-bold shrink-0">→</span>
        <div class="min-w-0 flex-1 text-right">
          <label class="block text-[9px] font-extrabold text-slate-400 uppercase">ĐẾN NGÀY</label>
          <input type="date" min="${escapeHtml(state.checkStart)}" value="${escapeHtml(state.checkEnd)}" onchange="appActions.setCheckDate('checkEnd', this.value)" class="w-full bg-transparent text-xs font-mono font-black text-slate-900 text-right focus:outline-none" />
        </div>
      </div>

      <div class="bg-white rounded-3xl border border-slate-200/80 p-3 space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 font-black text-xs text-slate-900">
            <span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Ekip sẵn sàng (${freeList.length}/${totalCount})</span>
          </div>
          <span class="text-[10.5px] font-semibold text-slate-400">Chạm thẻ để nổ show</span>
        </div>

        ${freeList.length === 0 ? `
          <div class="py-4 text-center text-[11px] text-slate-400">Không có nhân sự rảnh trong khoảng ngày này.</div>
        ` : `
          <div class="grid grid-cols-2 gap-2">
            ${freeList.map(m => `
              <button type="button" onclick="appActions.openAddModal('${escapeHtml(state.checkStart)}', '${escapeHtml(m.id)}')" class="p-2.5 rounded-2xl bg-slate-50/70 hover:bg-emerald-50/60 border border-slate-200/80 flex items-center justify-between gap-2 text-left transition active:scale-[0.99]">
                <div class="flex items-center gap-2 min-w-0">
                  ${renderAvatarBox(m)}
                  <div class="min-w-0">
                    <div class="font-black text-xs text-slate-900 uppercase truncate">${escapeHtml(m.name)}</div>
                    <div class="text-[10.5px] font-bold text-emerald-600">Available</div>
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right text-slate-300 text-[10px] shrink-0"></i>
              </button>
            `).join('')}
          </div>
        `}
      </div>

      <div class="bg-white rounded-3xl border border-slate-200/80 p-3 space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 font-black text-xs text-slate-900">
            <span class="w-2 h-2 rounded-full bg-amber-500 inline-block"></span>
            <span>Ekip đang có lịch (${busyList.length}/${totalCount})</span>
          </div>
          <span class="text-[10.5px] font-semibold text-slate-400">Lịch hiện tại</span>
        </div>

        ${busyList.length === 0 ? `
          <div class="py-4 text-center text-[11px] text-slate-400">Tất cả nhân sự đều đang rảnh.</div>
        ` : `
          <div class="space-y-2">
            ${busyList.map(m => {
              const showLabels = busyMap[m.id] || [];
              const firstShow = showLabels[0] || 'Có lịch';
              const extraCount = showLabels.length > 1 ? ` (+${showLabels.length - 1})` : '';
              return `
                <div class="p-2.5 rounded-2xl bg-amber-50/50 border border-amber-200/70 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0">
                    ${renderAvatarBox(m)}
                    <div class="min-w-0">
                      <div class="font-black text-xs text-slate-900 uppercase truncate">${escapeHtml(m.name)}</div>
                      <div class="text-[11px] font-semibold text-slate-600 truncate">📍 ${escapeHtml(firstShow + extraCount)}</div>
                    </div>
                  </div>
                  <span class="px-2.5 py-1 rounded-xl bg-amber-100/90 text-amber-800 text-[10px] font-extrabold shrink-0">Đi show</span>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}
