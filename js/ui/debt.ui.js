import { state } from '../state/store.js';
import { OWNER_STATUS_OPTIONS, CREW_CTP_STATUS_OPTIONS } from '../config/constants.js';
import { escapeHtml, formatDayMonth, getMember, formatCompactMoneyPlain } from '../utils/helpers.js';
import { calculateOwnerShowMetrics, calculateCrewShowMetrics } from '../services/finance.service.js';
import { renderUnifiedDateBarHtml } from './header.ui.js';

export function renderDebtTabHtml() {
  const uid = state.currentUserId;
  const curMem = getMember(uid);

  const allInvolved = (state.shows || []).filter(sh => {
    if (!sh || sh.isCancelled || sh.isHold || !sh.startDate) return false;
    if (sh.ownerId !== uid && !(sh.memberIds || []).includes(uid)) return false;
    const [y, m] = sh.startDate.split('-').map(Number);
    if (y !== state.selectedYear) return false;
    if (!state.ownerAllMonths && m !== state.ownerMonth) return false;
    return true;
  }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  let totNet = 0, ownerProf = 0, crewNet = 0, uncoll = 0;
  let cOwner = 0, cCrew = 0;
  allInvolved.forEach(sh => {
    if (sh.ownerId === uid) {
      cOwner++;
      const m = calculateOwnerShowMetrics(sh);
      ownerProf += m.netProfit; totNet += m.netProfit; uncoll += m.remainingClientDebt;
    } else {
      cCrew++;
      const cm = calculateCrewShowMetrics(sh);
      crewNet += cm.netPocket; totNet += cm.netPocket; uncoll += cm.pendingCtpDebt;
    }
  });

  const filtered = allInvolved.filter(sh => {
    const isOwner = sh.ownerId === uid;
    const settled = isOwner ? calculateOwnerShowMetrics(sh).rec.status === 'settled' : calculateCrewShowMetrics(sh).isSettled;
    if (state.ownerFilterStatus === 'role_owner') return isOwner;
    if (state.ownerFilterStatus === 'role_crew') return !isOwner;
    if (state.ownerFilterStatus === 'unsettled') return !settled;
    if (state.ownerFilterStatus === 'settled') return settled;
    return true;
  });

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-slate-100 text-xs">
      <div class="bg-white px-3 py-2.5 border-b border-slate-200 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase">👑 CÔNG NỢ: ${escapeHtml(curMem.name)}</span>
          <button onclick="ownerActions.exportOwnerExcel()" class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">.XLSX</button>
        </div>
        ${renderUnifiedDateBarHtml('owner')}
        <div class="as-ios-seg-bar">
          ${[
            { id: 'all', label: `ALL (${allInvolved.length})` },
            { id: 'role_owner', label: `Chủ (${cOwner})` },
            { id: 'role_crew', label: `CTP (${cCrew})` },
            { id: 'unsettled', label: 'Chưa thu' },
            { id: 'settled', label: 'Đã xong' }
          ].map(f => `<button onclick="ownerActions.setFilterStatus('${f.id}')" class="as-ios-seg-item ${state.ownerFilterStatus === f.id ? 'active' : ''}">${f.label}</button>`).join('')}
        </div>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 space-y-2.5">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">💎 TỔNG RÒNG</span><span class="font-black font-mono text-emerald-700">${totNet.toLocaleString('vi-VN')}đ</span></div>
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">👑 LÃI CHỦ SHOW</span><span class="font-black font-mono text-slate-900">${ownerProf.toLocaleString('vi-VN')}đ</span></div>
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">🎥 CTP ĐI LÀM</span><span class="font-black font-mono text-indigo-700">${crewNet.toLocaleString('vi-VN')}đ</span></div>
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">⏳ CHƯA THU</span><span class="font-black font-mono text-amber-800">${uncoll.toLocaleString('vi-VN')}đ</span></div>
        </div>

        ${filtered.map((sh, idx) => {
          const isOwner = sh.ownerId === uid;
          const expanded = state.ownerExpandedShowId === sh.id;
          if (isOwner) {
            const m = calculateOwnerShowMetrics(sh);
            const stObj = OWNER_STATUS_OPTIONS.find(o => o.id === m.rec.status) || OWNER_STATUS_OPTIONS[0];
            return `
              <div class="bg-white rounded-2xl border p-3 space-y-2">
                <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-center justify-between cursor-pointer">
                  <div>
                    <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9px] font-black">👑 Chủ Show</span>
                    <span class="font-mono text-[10px] font-bold ml-1">${formatDayMonth(sh.startDate)}</span>
                    <span class="px-2 py-0.5 rounded-full border text-[9px] font-bold ml-1 ${stObj.badgeCls}">${stObj.label}</span>
                    <div class="font-black text-slate-900 mt-1">📍 ${escapeHtml(sh.location)}</div>
                  </div>
                  <div class="text-right font-mono font-black text-emerald-700">${formatCompactMoneyPlain(m.netProfit)}</div>
                </div>
                ${expanded ? `
                  <div class="pt-2 border-t space-y-2">
                    <div class="flex gap-1">${OWNER_STATUS_OPTIONS.map(s => `<button onclick="ownerActions.setStatus('${sh.id}', '${s.id}')" class="px-2 py-1 rounded-xl text-[10px] font-bold border ${m.rec.status === s.id ? s.badgeCls : 'bg-slate-50'}">${s.label}</button>`).join('')}</div>
                    <div class="grid grid-cols-2 gap-2">
                      <input type="tel" value="${m.clientPrice ? m.clientPrice.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'clientPrice', this)" placeholder="Giá báo khách..." class="px-3 py-2 border rounded-xl font-mono font-bold" />
                      <input type="tel" value="${m.depositPaid ? m.depositPaid.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'depositPaid', this)" placeholder="Khách đã cọc/trả..." class="px-3 py-2 border rounded-xl font-mono font-bold text-emerald-700" />
                    </div>
                    <button onclick="ownerActions.saveShowFinanceNow('${sh.id}')" class="w-full py-2 bg-emerald-600 text-white rounded-full font-black">💾 LƯU CÔNG NỢ</button>
                  </div>
                ` : ''}
              </div>
            `;
          } else {
            const cm = calculateCrewShowMetrics(sh);
            const stObj = CREW_CTP_STATUS_OPTIONS.find(o => o.id === cm.meta.ctpStatus) || CREW_CTP_STATUS_OPTIONS[0];
            return `
              <div class="bg-white rounded-2xl border p-3 space-y-2">
                <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-center justify-between cursor-pointer">
                  <div>
                    <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[9px] font-black">🎥 Chủ: ${escapeHtml(getMember(sh.ownerId).name)}</span>
                    <span class="font-mono text-[10px] font-bold ml-1">${formatDayMonth(sh.startDate)}</span>
                    <span class="px-2 py-0.5 rounded-full border text-[9px] font-bold ml-1 ${stObj.badgeCls}">${stObj.label}</span>
                    <div class="font-black text-slate-900 mt-1">📍 ${escapeHtml(sh.location)}</div>
                  </div>
                  <div class="text-right font-mono font-black text-emerald-700">${formatCompactMoneyPlain(cm.netPocket)}</div>
                </div>
                ${expanded ? `
                  <div class="pt-2 border-t space-y-2">
                    <div class="flex gap-1">${CREW_CTP_STATUS_OPTIONS.map(s => `<button onclick="ownerActions.setCrewCtpStatus('${sh.id}', '${s.id}')" class="px-2 py-1 rounded-xl text-[10px] font-bold border ${cm.meta.ctpStatus === s.id ? s.badgeCls : 'bg-slate-50'}">${s.label}</button>`).join('')}</div>
                    <input type="tel" value="${cm.selfExpense ? cm.selfExpense.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleCrewSelfExpenseInput('${sh.id}', this)" placeholder="Chi phí tự túc (nếu có)..." class="w-full px-3 py-2 border rounded-xl font-mono font-bold text-rose-600" />
                    <button onclick="ownerActions.saveShowFinanceNow('${sh.id}')" class="w-full py-2 bg-emerald-600 text-white rounded-full font-black">💾 LƯU</button>
                  </div>
                ` : ''}
              </div>
            `;
          }
        }).join('')}
      </div>
    </div>
  `;
}