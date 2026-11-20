import { state } from '../state/store.js';
import { ALL_YEARS } from '../config/constants.js';
import { escapeHtml } from '../utils/helpers.js';

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

  return `
    <div class="w-full h-[100dvh] bg-slate-50 text-slate-900 flex flex-col overflow-hidden">
      <header class="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <div class="font-black text-sm uppercase">Studio Control</div>
          <div class="text-[11px] text-slate-400">${state.shows.length} Shows • Action Media x Say Studios</div>
        </div>
        <div class="flex gap-2">
          <button onclick="adminProActions.exportFullJsonBackup()" class="px-3 py-1.5 rounded-full bg-amber-400 text-slate-950 font-bold text-xs">💾 Backup</button>
          <button onclick="appActions.exitBackendPortal()" class="px-3.5 py-1.5 rounded-full bg-slate-900 text-white font-bold text-xs">← Về App</button>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto p-4 max-w-5xl w-full mx-auto space-y-4 text-xs">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white rounded-3xl p-4 border space-y-2">
            <div class="font-black uppercase">🛡️ Khóa Bảo Trì (Maintenance Mode)</div>
            <button onclick="adminProActions.toggleMaintenanceMode()" class="px-4 py-2 rounded-xl font-black text-white ${state.readonlyMaintenanceMode ? 'bg-emerald-600' : 'bg-rose-600'}">
              ${state.readonlyMaintenanceMode ? '🔓 Tắt Khóa Bảo Trì' : '🛡️ Bật Khóa Bảo Trì'}
            </button>
          </div>
          <div class="bg-white rounded-3xl p-4 border space-y-2">
            <div class="font-black uppercase">📅 Bật / Ẩn Năm Hiển Thị</div>
            <div class="flex flex-wrap gap-1.5">
              ${ALL_YEARS.map(yr => `<button onclick="adminProActions.toggleYear(${yr})" class="px-3 py-1 rounded-full font-black border ${state.visibleYears.includes(yr) ? 'bg-slate-900 text-amber-400' : 'bg-slate-50 text-slate-500'}">${yr}</button>`).join('')}
            </div>
          </div>
        </div>

        <div class="bg-white rounded-3xl p-4 border space-y-2">
          <div class="font-black uppercase">📜 Nhật Ký Hoạt Động (${state.activityLogs.length})</div>
          <div class="max-h-48 overflow-y-auto space-y-1">
            ${state.activityLogs.map(l => `<div class="p-2 bg-slate-50 rounded-xl"><b class="font-mono text-slate-500">[${escapeHtml(l.time)}]</b> <b>${escapeHtml(l.actor)}:</b> ${escapeHtml(l.text)}</div>`).join('') || '<div class="text-slate-400">Chưa có log</div>'}
          </div>
        </div>
      </div>
    </div>
  `;
}