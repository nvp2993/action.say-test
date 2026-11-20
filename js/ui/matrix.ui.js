import { state } from '../state/store.js';
import { escapeHtml, getSortedMembers, formatDayMonth, renderPillHtml } from '../utils/helpers.js';
import { getActiveNonCancelledShows } from '../services/show.service.js';

export function getMatrixData() {
  const daysInMonth = new Date(state.selectedYear, state.selectedMonth, 0).getDate();
  const matrix = {};
  for (let d = 1; d <= daysInMonth; d++) {
    matrix[d] = {};
    state.members.forEach(m => { matrix[d][m.id] = []; });
  }
  getActiveNonCancelledShows().forEach(sh => {
    if (!sh.startDate || !sh.endDate) return;
    const start = new Date(sh.startDate + 'T00:00:00');
    const end = new Date(sh.endDate + 'T00:00:00');
    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      if (dt.getFullYear() === state.selectedYear && (dt.getMonth() + 1) === state.selectedMonth) {
        const day = dt.getDate();
        (sh.memberIds || []).forEach(mid => {
          if (matrix[day]?.[mid]) matrix[day][mid].push(sh);
        });
      }
    }
  });
  return { daysInMonth, matrix };
}

export function renderMatrixTabHtml() {
  const { daysInMonth, matrix } = getMatrixData();
  const cols = getSortedMembers();
  const compact = state.compactMatrix;

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-white">
      <div class="bg-[#76a593] text-slate-950 px-2.5 py-1 flex items-center justify-between border-b border-slate-400 shrink-0">
        <span class="text-[11px] font-black uppercase">BẢNG CÔNG TÁC THÁNG ${state.selectedMonth}/${state.selectedYear}</span>
        <button onclick="appActions.toggleCompactMatrix()" class="bg-white/90 text-slate-900 px-2 py-0.5 rounded text-[10px] font-extrabold">${compact ? 'Rộng cột' : 'Thu gọn cột'}</button>
      </div>
      <div class="flex-1 min-h-0 overflow-auto custom-scroll relative">
        <table class="w-full border-collapse select-none table-fixed">
          <thead class="sticky top-0 z-20">
            <tr class="bg-[#f3f3f3] text-slate-900 border-b-2 border-slate-300">
              <th class="sticky left-0 z-30 bg-[#ffd966] border-r-2 border-slate-300 py-1.5 px-1 text-center font-black text-[10px] w-9 sticky-col-shadow">NGÀY</th>
              ${cols.map(mem => `<th style="width:${compact ? '54px' : '82px'};" class="border-r border-slate-300 font-black uppercase text-center bg-[#f3f3f3] py-1.5 px-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'} truncate">${escapeHtml(mem.shortLabel)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${state.selectedYear}-${String(state.selectedMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dow = new Date(dateStr + 'T00:00:00').getDay();
              const isWeekend = dow === 0 || dow === 6;
              return `
                <tr class="border-b border-slate-200">
                  <td ondblclick="holdBellActions.openQuickHoldSheet('${dateStr}')" title="Nháy đúp để Giữ lịch nhanh" class="sticky left-0 z-10 border-r-2 border-slate-300 text-center font-extrabold sticky-col-shadow ${isWeekend ? 'bg-amber-50 text-rose-700' : 'bg-white text-slate-900'} py-1 text-[10px] cursor-pointer">${day}</td>
                  ${cols.map(mem => {
                    const cellShows = matrix[day]?.[mem.id] || [];
                    const first = cellShows[0];
                    const bg = first ? (first.isHold ? '#fef3c7' : (first.color || '#dbeafe')) : 'transparent';
                    const cls = first?.isHold ? 'as-is-hold-cell' : '';
                    const clickAttr = first
                      ? (cellShows.length === 1 ? `onclick="appActions.openShowDetail('${first.id}')"` : `onclick="appActions.openMatrixCell(${day}, '${mem.id}')"`)
                      : `onclick="appActions.openAddModal('${dateStr}', '${mem.id}')"`;
                    return `
                      <td ${clickAttr} style="background-color:${bg};" class="border-r border-slate-200 cursor-pointer px-1 py-1 text-[9px] leading-tight align-top ${cls}">
                        ${first ? (cellShows.length === 1
                          ? `<div class="font-semibold text-slate-900 break-words line-clamp-2">${escapeHtml(first.location)}</div>`
                          : `<span class="inline-block px-1 rounded bg-slate-900 text-white font-extrabold text-[8px] mb-0.5">${cellShows.length} SHOW</span>${cellShows.map((s, k) => `<div class="font-bold text-slate-900 truncate">${k+1}. ${escapeHtml(s.location)}</div>`).join('')}`
                        ) : ''}
                      </td>
                    `;
                  }).join('')}
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}