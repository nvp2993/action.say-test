import { state } from '../state/store.js';
import { POST_STATUS_OPTIONS } from '../config/constants.js';
import { escapeHtml, formatDayMonth, getMember, renderPillHtml, formatMemberRolesClean } from '../utils/helpers.js';
import { canEditShow, getFilteredShows, getVisiblePartnerText } from '../services/show.service.js';

export function renderShowsTabHtml() {
  const filtered = getFilteredShows();
  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      ${state.zenFullscreen ? '' : `
        <div class="bg-[#f8fafc] px-3 py-2.5 border-b border-slate-200/90 shrink-0 space-y-2">
          <div class="flex items-center gap-2">
            <div class="relative flex-1 min-w-0">
              <i class="fa-solid fa-magnifying-glass text-slate-400 text-[11px] absolute left-3 top-1/2 -translate-y-1/2"></i>
              <input id="search-input-box" type="text" value="${escapeHtml(state.searchQuery)}" oninput="appActions.onSearchInput(this.value)"
                placeholder="Tìm Hồ Tràm, Đà Nẵng, Phú Quốc, Golf..." class="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200/90 rounded-xl text-[11.5px] text-slate-800 focus:outline-none focus:border-slate-900" />
            </div>
            <button type="button" onclick="appActions.openZaloTomorrowModal()" class="px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold bg-slate-900 hover:bg-slate-800 text-white shrink-0 transition">📋 Điểm danh Mai</button>
            <button type="button" onclick="appActions.toggleAllMonths()" class="px-3 py-1.5 rounded-xl text-[10.5px] font-bold border shrink-0 transition ${state.filterAllMonthsInList ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200/90'}">
              ${state.filterAllMonthsInList ? `Tất cả (${state.shows.length})` : `T${state.selectedMonth} (${filtered.length})`}
            </button>
          </div>
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button type="button" onclick="appActions.setFilterMember('all')" class="px-2.5 py-1 rounded-full text-[9.5px] font-extrabold shrink-0 border transition ${state.filterMemberId === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200/90'}">
              Tất cả (${state.members.length})
            </button>
            ${[...state.members].sort((a,b) => (a.id === state.currentUserId ? -1 : b.id === state.currentUserId ? 1 : 0))
              .map(m => renderPillHtml(m.id, 'xs', `shrink-0 cursor-pointer ${state.filterMemberId === m.id ? 'ring-2 ring-slate-900' : 'opacity-90 hover:opacity-100'}`, `onclick="appActions.setFilterMember('${m.id}')"` )).join('')}
          </div>
        </div>
      `}

      ${filtered.length === 0 ? `
        <div class="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#f1f5f9] space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200/90 text-slate-500 flex items-center justify-center text-xl shadow-2xs"><i class="fa-regular fa-calendar-xmark"></i></div>
          <div class="text-sm font-black text-slate-600 uppercase tracking-tight">CHƯA CÓ DỮ LIỆU</div>
          <button type="button" onclick="appActions.openAddModal('${state.selectedYear}-${String(state.selectedMonth).padStart(2,'0')}-01')" class="px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold inline-flex items-center gap-1.5 transition">
            <i class="fa-solid fa-bolt"></i><span>Nổ Show Mới</span>
          </button>
        </div>
      ` : `
        <div class="flex-1 min-h-0 overflow-auto custom-scroll relative p-2.5 sm:p-3.5">
          <div class="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
            <table class="w-full table-fixed border-collapse text-[11.5px] min-w-[860px]">
              <thead class="sticky top-0 z-20">
                <tr class="bg-[#f8fafc] text-slate-400 border-b border-slate-200/90 font-black text-[10px] uppercase tracking-wider">
                  <th class="py-2.5 px-2 border-r border-slate-200/70 w-11 text-center">STT</th>
                  <th class="sticky left-0 z-20 bg-[#f8fafc] py-2.5 px-3 border-r border-slate-200/70 text-left w-44 sticky-col-shadow">THÔNG TIN (ĐỊA ĐIỂM)</th>
                  <th class="py-2.5 px-3 border-r border-slate-200/70 text-left w-40">TÊN SHOW - ĐỐI TÁC</th>
                  <th class="py-2.5 px-2 border-r border-slate-200/70 text-center w-16">BĐ</th>
                  <th class="py-2.5 px-2 border-r border-slate-200/70 text-center w-16">KT</th>
                  <th class="py-2.5 px-3 border-r border-slate-200/70 text-left">NHÂN SỰ</th>
                  <th class="py-2.5 px-2.5 border-r border-slate-200/70 text-center w-24">CHỦ SHOW</th>
                  <th class="py-2.5 px-2.5 text-center w-24">NGƯỜI TẠO</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200/65">
                ${filtered.map((sh, idx) => {
                  const editable = canEditShow(sh);
                  const owner = getMember(sh.ownerId);
                  const creator = getMember(sh.creatorId || sh.ownerId);
                  const partner = getVisiblePartnerText(sh);
                  const statusBadge = sh.postStatus === 'done' ? '<span class="text-[9.5px] ml-1">✅</span>' : sh.postStatus === 'editing' ? '<span class="text-[9.5px] ml-1">✂️</span>' : '';
                  const rowCls = sh.isCancelled ? 'as-row-cancelled' : sh.isHold ? 'as-is-hold-card' : (editable ? 'bg-white' : 'bg-[#f8fafc]/60');
                  const stickyCellBg = sh.isCancelled ? 'bg-rose-50' : editable ? 'bg-white' : 'bg-[#f8fafc]';
                  return `
                    <tr onclick="appActions.openShowDetail('${sh.id}')" class="hover:bg-[#f1f5f9]/75 cursor-pointer transition-colors ${rowCls}">
                      <td class="py-2.5 px-2 border-r border-slate-200/65 text-center font-mono tabular-nums text-[10.5px] font-semibold text-slate-400">${idx + 1}</td>
                      <td class="sticky left-0 z-10 ${stickyCellBg} py-2.5 px-3 border-r border-slate-200/65 font-bold text-slate-900 sticky-col-shadow">
                        <div class="flex items-center gap-2 min-w-0">
                          <span class="w-2 h-2 rounded-full shrink-0 border border-black/15" style="background-color:${sh.color || '#dbeafe'}"></span>
                          <span class="truncate as-loc-text">${escapeHtml(sh.isHold ? `⏳ GIỮ LỊCH: ${String(sh.location || '').replace(/^⏳\s*GIỮ LỊCH:\s*/i, '').trim()}` : sh.location)}</span>${statusBadge}
                          ${sh.isCancelled ? '<span class="as-badge-cancelled">🚫 ĐÃ HỦY</span>' : ''}
                        </div>
                      </td>
                      <td class="py-2.5 px-3 border-r border-slate-200/65 text-slate-700 font-medium truncate">
                        ${partner ? escapeHtml(partner) : '<span class="text-slate-300">—</span>'}
                      </td>
                      <td class="py-2.5 px-2 border-r border-slate-200/65 text-center font-mono tabular-nums text-[11px] font-semibold text-slate-700">${formatDayMonth(sh.startDate)}</td>
                      <td class="py-2.5 px-2 border-r border-slate-200/65 text-center font-mono tabular-nums text-[11px] font-semibold text-slate-700">${formatDayMonth(sh.endDate)}</td>
                      <td class="py-2.5 px-3 border-r border-slate-200/65">
                        <div class="flex flex-wrap items-center gap-1.5">
                          ${(sh.memberIds || []).map(mid => renderPillHtml(mid, 'xs')).join('')}
                          ${(sh.externalCrew || []).map((p, eIdx) => {
                            const extLabel = String(p?.name || '').trim() || `NS ${eIdx + 1}`;
                            return `<span style="background:#4f46e5;color:#fff;border:1px dashed #c7d2fe;" class="inline-flex items-center font-extrabold rounded-full px-2 py-0.5 text-[9px]">🤝 ${escapeHtml(extLabel)}</span>`;
                          }).join('')}
                        </div>
                      </td>
                      <td class="py-2.5 px-2.5 border-r border-slate-200/65 text-center truncate"><span class="text-[11px] font-bold text-slate-800">${escapeHtml(owner.name)}</span></td>
                      <td class="py-2.5 px-2.5 text-center truncate"><span class="text-[11px] font-bold text-indigo-700">${escapeHtml(creator.name)}</span></td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `;
}

export function renderDetailModalHtml() {
  if (!state.detailShowId) return '';
  const sh = state.shows.find(s => s.id === state.detailShowId);
  if (!sh) return '';
  const editable = canEditShow(sh);
  const owner = getMember(sh.ownerId);
  const creator = getMember(sh.creatorId || sh.ownerId);
  const curPost = sh.postStatus || 'pending';

  return `
    <div onclick="appActions.closeShowDetail()" class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div onclick="event.stopPropagation()" class="ios-sheet bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3">
        <div class="flex items-start justify-between border-b pb-2">
          <div>
            <span class="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded">STT #${sh.stt || '-'}</span>
            <h3 class="text-base font-black text-slate-900 mt-1">${escapeHtml(sh.location)}</h3>
            ${getVisiblePartnerText(sh) ? `<p class="text-xs text-slate-500">Đối tác: <b>${escapeHtml(getVisiblePartnerText(sh))}</b></p>` : ''}
          </div>
          <button type="button" onclick="appActions.closeShowDetail()" class="w-7 h-7 rounded-full bg-slate-100"><i class="fa-solid fa-xmark"></i></button>
        </div>

        ${sh.isCancelled ? `
          <div class="p-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
            <div class="font-black uppercase text-[11px] text-rose-600">🚫 SHOW NÀY ĐÃ BÁO HỦY</div>
            <div class="mt-0.5">Lý do: ${escapeHtml(sh.cancelReason || 'Đã hủy lịch')}</div>
          </div>
        ` : ''}

        <div class="flex justify-between text-xs bg-slate-50 p-2.5 rounded-xl font-bold">
          <span>Bắt đầu: ${formatDayMonth(sh.startDate)}</span>
          <span>Kết thúc: ${formatDayMonth(sh.endDate)}</span>
        </div>

        <div class="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-1.5">
          <div class="text-[10px] font-black text-slate-400 uppercase">Nhân sự & Nhiệm vụ:</div>
          <div class="space-y-1 text-xs">
            ${(sh.memberIds || []).map(id => {
              const roleStr = formatMemberRolesClean(sh.roles?.[id]);
              return `<div class="flex items-center gap-1.5 font-bold text-slate-800"><span>-</span>${renderPillHtml(id, 'xs')}${roleStr ? `<span>-</span><span class="text-slate-700 font-semibold">${escapeHtml(roleStr)}</span>` : ''}</div>`;
            }).join('')}
            ${(sh.externalCrew || []).length > 0 ? `
              <div class="border-t border-slate-200/80 pt-1.5 mt-1.5 space-y-1">
                ${(sh.externalCrew || []).map((p, eIdx) => {
                  const extLabel = String(p?.name || '').trim() || `NS ${eIdx + 1}`;
                  const rStr = Array.isArray(p?.roles) ? p.roles.filter(Boolean).join(', ') : String(p?.roles || '').trim();
                  return `<div class="flex items-center gap-1.5 font-bold text-slate-800"><span>-</span><span style="background:#4f46e5;color:#fff;" class="px-2 py-0.5 rounded-full text-[10px] font-extrabold">🤝 ${escapeHtml(extLabel)}</span>${rStr ? `<span>-</span><span class="text-slate-700 font-semibold">${escapeHtml(rStr)}</span>` : ''}</div>`;
                }).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <div class="space-y-1.5 pt-1 border-t border-slate-100">
          <div class="text-[10px] font-black text-slate-500 uppercase">📦 Tiến độ Hậu kỳ:</div>
          <div class="grid grid-cols-3 gap-1.5">
            ${POST_STATUS_OPTIONS.map(st => `
              <button type="button" onclick="appActions.updatePostStatus('${sh.id}', '${st.id}')" class="py-1.5 px-1 rounded-xl text-[10px] font-extrabold border ${curPost === st.id ? st.cls + ' ring-2 ring-indigo-500' : 'bg-slate-50 text-slate-400 border-slate-200'}">${st.label}</button>
            `).join('')}
          </div>
        </div>

        <button type="button" onclick="appActions.exportShowToAppleCalendar('${sh.id}')" class="w-full py-2 px-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5">
          <i class="fa-regular fa-calendar-plus"></i><span>Lưu vào Lịch iPhone (.ics)</span>
        </button>
        <button type="button" onclick="appActions.openCrewManifestModal('${sh.id}')" class="w-full py-2.5 px-3 bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-users-viewfinder"></i><span>DANH SÁCH NHÂN SỰ (CCCD / SĐT)</span>
        </button>

        <div class="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span>Chủ show: <b class="text-slate-800">${escapeHtml(owner.name)}</b></span>
          <span>Người tạo: <b class="text-slate-800">${escapeHtml(creator.name)}</b></span>
        </div>

        ${editable ? `
          <div class="flex gap-2">
            <button type="button" onclick="appActions.openEditModal('${sh.id}')" class="flex-1 bg-indigo-600 text-white font-extrabold py-2.5 rounded-xl text-xs">Chỉnh sửa</button>
            <button type="button" onclick="appActions.toggleCancelShow('${sh.id}')" class="px-3 py-2.5 rounded-xl text-xs font-extrabold ${sh.isCancelled ? 'bg-emerald-600 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'}">${sh.isCancelled ? 'Khôi phục' : 'Báo Hủy'}</button>
            <button type="button" onclick="appActions.deleteShow('${sh.id}')" class="px-3.5 py-2.5 bg-rose-50 text-rose-600 rounded-xl text-xs"><i class="fa-solid fa-trash-can"></i></button>
          </div>
        ` : `<div class="bg-slate-100 p-2 rounded-xl text-center text-xs font-bold text-slate-600">🔒 Chỉ Người tạo (${escapeHtml(creator.name)}) hoặc Admin mới được sửa</div>`}
      </div>
    </div>
  `;
}
