import { state } from '../state/store.js';
import { ALL_YEARS } from '../config/constants.js';
import { escapeHtml, getMember, getSortedMembers, formatDayMonth } from '../utils/helpers.js';

function getFilteredAdminShows() {
  const q = String(state.adminSearch || '').trim().toLowerCase();
  const list = [...(state.shows || [])].sort((a, b) => {
    const ta = Number(a?.createdAt || a?.updatedAt || 0);
    const tb = Number(b?.createdAt || b?.updatedAt || 0);
    if (tb !== ta) return tb - ta;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });

  if (!q) return list;
  return list.filter(sh => {
    if (!sh) return false;
    const crew = (sh.memberIds || []).map(id => getMember(id).name).join(' ');
    const owner = sh.ownerId ? getMember(sh.ownerId).name : '';
    const hay = `${sh.location || ''} ${sh.partner || ''} ${owner} ${crew} ${sh.startDate || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderAdminInspectModalHtml() {
  const showId = state.adminInspectShowId;
  if (!showId) return '';
  const sh = (state.shows || []).find(s => s && s.id === showId);
  if (!sh) return '';

  const ownerName = sh.ownerId ? getMember(sh.ownerId).name : 'Chưa gán';
  const creatorName = (sh.creatorId || sh.createdBy) ? getMember(sh.creatorId || sh.createdBy).name : 'Dữ liệu gốc';
  const crewList = (sh.memberIds || []).map(mid => {
    const m = getMember(mid);
    const r = Array.isArray(sh.roles?.[mid]) ? sh.roles[mid].join(', ') : (sh.roles?.[mid] || 'Tham gia');
    return `<div class="py-2 flex items-center justify-between text-xs"><span class="font-bold text-slate-900">${escapeHtml(m.name)}</span><span class="text-emerald-700 font-semibold">${escapeHtml(r)}</span></div>`;
  }).join('') || '<div class="py-2 text-slate-400">Chưa gán nhân sự</div>';

  return `
    <div onclick="adminProActions.closeInspectShow()" class="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-md bg-white rounded-3xl p-5 space-y-3 text-xs shadow-2xl max-h-[88dvh] overflow-y-auto">
        <div class="flex items-start justify-between border-b pb-2">
          <div>
            <div class="text-[10px] font-black text-emerald-700 uppercase">Chi Tiết Show (Admin)</div>
            <h3 class="text-base font-black text-slate-900 mt-0.5">${escapeHtml(sh.location || '')} ${sh.partner ? `<span class="text-slate-400 font-semibold">(${escapeHtml(sh.partner)})</span>` : ''}</h3>
          </div>
          <button onclick="adminProActions.closeInspectShow()" class="w-8 h-8 rounded-full bg-slate-100 font-bold">✕</button>
        </div>

        <div class="divide-y divide-slate-100">
          <div class="py-2 flex justify-between"><span class="text-slate-400">Thời gian</span><span class="font-mono font-bold">${escapeHtml(formatDayMonth(sh.startDate))}${sh.endDate && sh.endDate !== sh.startDate ? ' → ' + escapeHtml(formatDayMonth(sh.endDate)) : ''}</span></div>
          <div class="py-2 flex justify-between"><span class="text-slate-400">Chủ show</span><span class="font-bold">${escapeHtml(ownerName)}</span></div>
          <div class="py-2 flex justify-between"><span class="text-slate-400">Người tạo</span><span class="font-bold">${escapeHtml(creatorName)}</span></div>
        </div>

        <div>
          <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">Ekip (${(sh.memberIds || []).length} người)</div>
          <div class="divide-y divide-slate-100">${crewList}</div>
        </div>

        ${sh.note ? `<div class="p-3 rounded-2xl bg-slate-50 text-slate-700"><b>Ghi chú:</b> ${escapeHtml(sh.note)}</div>` : ''}

        <div class="grid grid-cols-2 gap-2 pt-2">
          <button onclick="adminProActions.deleteShowFromAdmin('${escapeHtml(sh.id)}')" class="py-2.5 rounded-2xl bg-rose-50 text-rose-600 font-bold">🗑️ Xóa Show</button>
          <button onclick="adminProActions.closeInspectShow()" class="py-2.5 rounded-2xl bg-slate-900 text-white font-bold">Đóng</button>
        </div>
      </div>
    </div>
  `;
}

export function renderAdminPortalHtml() {
  if (!state.isAdminMode) {
    return `
      <div class="w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h2 class="font-black text-sm text-amber-400 uppercase">Đăng Nhập Studio Control (Admin)</h2>
          ${state.adminLoginInput.error ? `<div class="text-rose-400 text-xs font-bold">${escapeHtml(state.adminLoginInput.error)}</div>` : ''}
          <input type="email" value="${escapeHtml(state.adminLoginInput.email)}" placeholder="Email Admin" oninput="state.adminLoginInput.email = this.value" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white" />
          <input type="password" value="${escapeHtml(state.adminLoginInput.password)}" placeholder="Mật khẩu Firebase Auth" oninput="state.adminLoginInput.password = this.value" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white" />
          <button onclick="appActions.submitBackendAdminLogin()" class="w-full bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs">Đăng Nhập Quản Trị</button>
          <button onclick="appActions.exitBackendPortal()" class="w-full text-slate-400 text-xs py-1">← Quay lại Lịch Show</button>
        </div>
      </div>
    `;
  }

  const membersSorted = getSortedMembers();
  const filteredShows = getFilteredAdminShows();

  return `
    <div class="w-full h-[100dvh] bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      <header class="bg-white border-b px-4 py-3 flex items-center justify-between gap-2 shrink-0">
        <div>
          <div class="font-black text-sm uppercase">Studio Control</div>
          <div class="text-[11px] text-slate-400">${state.shows.length} Shows • Action Media x Say Studios</div>
        </div>
        <div class="flex gap-2">
          <button onclick="adminProActions.exportFullJsonBackup()" class="px-3 py-1.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">💾 Backup</button>
          <button onclick="appActions.exitBackendPortal()" class="px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-bold text-xs">← Về App</button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto custom-scroll p-4 max-w-5xl w-full mx-auto space-y-4 text-xs pb-16">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white rounded-3xl p-4 border space-y-2">
            <div class="font-black uppercase">🛡️ Khóa Bảo Trì (Maintenance Mode)</div>
            <p class="text-[11px] text-slate-500">Bật khi cần khóa tạm quyền Nổ Show / sửa / xóa của thành viên để đối soát.</p>
            <button onclick="adminProActions.toggleMaintenanceMode()" class="px-4 py-2 rounded-xl font-black text-white ${state.readonlyMaintenanceMode ? 'bg-emerald-600' : 'bg-rose-600'}">
              ${state.readonlyMaintenanceMode ? '🔓 Tắt Khóa Bảo Trì' : '🛡️ Bật Khóa Bảo Trì'}
            </button>
          </div>
          <div class="bg-white rounded-3xl p-4 border space-y-2">
            <div class="font-black uppercase">📅 Bật / Ẩn Năm Hiển Thị</div>
            <p class="text-[11px] text-slate-500">Chọn các năm hiển thị trên thanh lọc đầu ứng dụng.</p>
            <div class="flex flex-wrap gap-1.5">
              ${ALL_YEARS.map(yr => `<button onclick="adminProActions.toggleYear(${yr})" class="px-3 py-1 rounded-full font-black border ${state.visibleYears.includes(yr) ? 'bg-slate-900 text-amber-400' : 'bg-slate-50 text-slate-500'}">${yr}</button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Thống kê số show theo từng nhân sự -->
        <div class="bg-white rounded-3xl p-4 border space-y-2.5">
          <div class="font-black uppercase">📊 Hiệu Suất Ekip (${membersSorted.length} người)</div>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${membersSorted.map(m => {
              const cnt = (state.shows || []).filter(s => s && !s.isCancelled && (s.memberIds || []).includes(m.id)).length;
              return `
                <div class="p-2.5 rounded-2xl bg-slate-50 border flex items-center justify-between">
                  <span style="background:${m.bg};color:${m.text}" class="px-2 py-0.5 rounded-full text-[10px] font-black">${escapeHtml(m.shortLabel)}</span>
                  <span class="font-mono font-black text-slate-900">${cnt} show</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Danh sách show để Admin kiểm tra & xóa nếu cần -->
        <div class="bg-white rounded-3xl p-4 border space-y-3">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div class="font-black uppercase">📋 Danh Sách Show (${filteredShows.length})</div>
              <div class="text-[11px] text-slate-400">Bấm vào từng show để xem chi tiết hoặc xóa</div>
            </div>
            <input type="text" value="${escapeHtml(state.adminSearch)}" oninput="adminProActions.setAdminSearch(this.value)" placeholder="Tìm địa điểm, đối tác, ekip..." class="w-full sm:w-64 px-3 py-2 rounded-2xl bg-slate-100 text-xs font-semibold focus:outline-none" />
          </div>

          <div class="max-h-72 overflow-y-auto custom-scroll divide-y divide-slate-100">
            ${filteredShows.length === 0 ? `<div class="py-6 text-center text-slate-400">Chưa có dữ liệu show</div>` : filteredShows.map((sh, i) => {
              const crew = (sh.memberIds || []).map(id => getMember(id).name).join(', ');
              return `
                <div onclick="adminProActions.openInspectShow('${escapeHtml(sh.id)}')" class="py-2.5 px-2 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-xl cursor-pointer">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 truncate">
                      <span class="text-[10px] font-mono text-slate-400">#${i + 1}</span>
                      <span class="font-mono font-bold text-emerald-700">${escapeHtml(formatDayMonth(sh.startDate))}</span>
                      <span class="font-bold text-slate-900 truncate ${sh.isCancelled ? 'line-through text-rose-600' : ''}">${escapeHtml(sh.location || '')}</span>
                    </div>
                    <div class="text-[11px] text-slate-500 truncate mt-0.5">Ekip: ${escapeHtml(crew || 'Trống')}</div>
                  </div>
                  <span class="text-slate-400 font-bold">›</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Cấu hình Họ tên xuất vé chuẩn (dùng khi copy danh sách đoàn đặt vé/KS) -->
        <div class="bg-white rounded-3xl p-4 border space-y-2.5">
          <div class="font-black uppercase">🪪 Họ Tên Xuất Vé Chuẩn (Đặt vé máy bay / KS)</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${membersSorted.map(m => `
              <div class="p-2.5 rounded-2xl bg-slate-50 border flex items-center gap-2">
                <span class="w-20 font-extrabold text-slate-800 truncate">${escapeHtml(m.name)}</span>
                <input id="adm-legal-${escapeHtml(m.id)}" type="text" value="${escapeHtml(state.officialLegalNames?.[m.id] || '')}" placeholder="HỌ TÊN TRÊN CCCD" class="flex-1 min-w-0 px-2.5 py-1.5 rounded-xl bg-white border text-[11px] font-bold uppercase" />
                <button onclick="adminProActions.saveLegalNameFromInput('${escapeHtml(m.id)}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[10.5px]">Lưu</button>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Nhật ký hoạt động -->
        <div class="bg-white rounded-3xl p-4 border space-y-2">
          <div class="font-black uppercase">📜 Nhật Ký Hoạt Động (${state.activityLogs.length})</div>
          <div class="max-h-48 overflow-y-auto custom-scroll space-y-1">
            ${state.activityLogs.map(l => `<div class="p-2 bg-slate-50 rounded-xl"><b class="font-mono text-slate-500">[${escapeHtml(l.time)}]</b> <b>${escapeHtml(l.actor)}:</b> ${escapeHtml(l.text)}</div>`).join('') || '<div class="text-slate-400">Chưa có log</div>'}
          </div>
        </div>
      </div>

      ${renderAdminInspectModalHtml()}
    </div>
  `;
}
