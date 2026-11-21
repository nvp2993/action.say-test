import { state } from '../state/store.js';
import { OWNER_STATUS_OPTIONS, CREW_CTP_STATUS_OPTIONS } from '../config/constants.js';
import { escapeHtml, formatDayMonth, getShowDays, getMember, formatCompactMoneyPlain } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import { calculateOwnerShowMetrics, calculateCrewShowMetrics, getDefaultRateForTask } from '../services/finance.service.js';
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

  const taskKeys = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'];
  const taskLabels = { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Làm hình', flycam: 'Flycam', gimbal: 'Gimbal' };

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-slate-100 text-xs">
      <div class="bg-white px-3 py-2.5 border-b border-slate-200 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase">👑 CÔNG NỢ: ${escapeHtml(curMem.name)}</span>
          <div class="flex items-center gap-1.5">
            <button type="button" onclick="ownerActions.openClientDebtBill()" class="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-extrabold">📤 Gửi Công Nợ</button>
            <button type="button" onclick="ownerActions.exportOwnerExcel()" class="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold">.XLSX</button>
          </div>
        </div>
        ${renderUnifiedDateBarHtml('owner')}
        <div class="as-ios-seg-bar">
          ${[
            { id: 'all', label: `ALL (${allInvolved.length})` },
            { id: 'role_owner', label: `Chủ (${cOwner})` },
            { id: 'role_crew', label: `CTP (${cCrew})` },
            { id: 'unsettled', label: 'Chưa thu' },
            { id: 'settled', label: 'Đã xong' }
          ].map(f => `<button type="button" onclick="ownerActions.setFilterStatus('${f.id}')" class="as-ios-seg-item ${state.ownerFilterStatus === f.id ? 'active' : ''}">${f.label}</button>`).join('')}
        </div>
      </div>

      <div id="owner-debt-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 space-y-2.5">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">💎 TỔNG RÒNG</span><span class="font-black font-mono text-emerald-700">${totNet >= 0 ? '+' : ''}${totNet.toLocaleString('vi-VN')}đ</span></div>
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">👑 LÃI CHỦ SHOW</span><span class="font-black font-mono text-slate-900">${ownerProf >= 0 ? '+' : ''}${ownerProf.toLocaleString('vi-VN')}đ</span></div>
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">🎥 CTP ĐI LÀM</span><span class="font-black font-mono text-indigo-700">${crewNet >= 0 ? '+' : ''}${crewNet.toLocaleString('vi-VN')}đ</span></div>
          <div class="bg-white p-2.5 rounded-2xl border"><span class="text-[9px] font-extrabold text-slate-400 block">⏳ CHƯA THU</span><span class="font-black font-mono text-amber-800">${uncoll.toLocaleString('vi-VN')}đ</span></div>
        </div>

        ${filtered.length === 0 ? `
          <div class="text-center py-10 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-3 p-4">
            <div class="text-3xl">📭</div>
            <div class="text-slate-800 font-bold text-xs">Chưa có show nào trong danh mục lọc này</div>
            <div class="flex items-center justify-center gap-2">
              <button type="button" onclick="appActions.openAddModal()" class="px-4 py-2 rounded-full bg-slate-950 text-white font-extrabold text-xs">⚡ Nổ Show Lịch Chung</button>
              <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="px-4 py-2 rounded-full bg-white text-slate-800 border border-slate-300 font-extrabold text-xs">Note Show Ngoài</button>
            </div>
          </div>
        ` : filtered.map((sh, idx) => {
          const isOwner = sh.ownerId === uid;
          const expanded = state.ownerExpandedShowId === sh.id;
          const days = getShowDays(sh);
          const partnerText = getVisiblePartnerText(sh);

          if (isOwner) {
            const m = calculateOwnerShowMetrics(sh);
            const stObj = OWNER_STATUS_OPTIONS.find(o => o.id === m.rec.status) || OWNER_STATUS_OPTIONS[0];
            const crewMembers = (sh.memberIds || []).filter(mid => mid !== sh.ownerId);
            const missingClient = Math.max(0, m.clientPrice - m.depositPaid);

            return `
              <div class="bg-white rounded-3xl border border-slate-200 p-3.5 space-y-3">
                <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2 cursor-pointer">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-[10px] font-mono font-bold text-slate-400">#${idx + 1}</span>
                      <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9.5px] font-black">👑 Chủ Show</span>
                      <span class="font-mono text-[10px] font-bold text-slate-600">${formatDayMonth(sh.startDate)} (${days}n)</span>
                      <span class="px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${stObj.badgeCls}">${stObj.label}</span>
                    </div>
                    <div class="font-black text-slate-900 text-sm mt-1">📍 ${escapeHtml(sh.location)} ${partnerText ? `<span class="text-slate-500 font-bold text-xs">(${escapeHtml(partnerText)})</span>` : ''}</div>
                  </div>
                  <div class="text-right shrink-0 space-y-0.5">
                    <div class="text-[10px] font-mono text-slate-500">Thu: <b>${formatCompactMoneyPlain(m.clientPrice)}</b> • Chi: <b class="text-rose-600">${formatCompactMoneyPlain(m.totalExpense)}</b></div>
                    <div class="text-[10.5px] font-mono font-black text-emerald-700">Lãi: ${m.netProfit >= 0 ? '+' : ''}${formatCompactMoneyPlain(m.netProfit)}</div>
                  </div>
                </div>

                ${expanded ? `
                  <div class="pt-2.5 border-t border-slate-100 space-y-3">
                    <div class="space-y-1.5">
                      <span class="text-[10px] font-black text-slate-400 uppercase block">TÌNH TRẠNG THANH LÝ KHÁCH:</span>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${OWNER_STATUS_OPTIONS.map(s => `<button type="button" onclick="ownerActions.setStatus('${sh.id}', '${s.id}')" class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${m.rec.status === s.id ? s.badgeCls : 'bg-slate-50 text-slate-600'}">${s.label}</button>`).join('')}
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">💰 GIÁ BÁO KHÁCH HÀNG (VNĐ):</label>
                        <input type="tel" inputmode="numeric" value="${m.clientPrice ? m.clientPrice.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'clientPrice', this)" placeholder="Nhập giá báo khách..." class="w-full px-3 py-2 border rounded-xl font-mono font-bold text-xs" />
                      </div>
                      <div>
                        <div class="flex items-center justify-between gap-1 mb-1">
                          <label class="text-[10px] font-black text-slate-500 uppercase">💵 KHÁCH ĐÃ CỌC / ĐÃ TRẢ:</label>
                          ${missingClient > 0 ? `<span class="text-[10px] font-bold text-amber-700">Thiếu: ${missingClient.toLocaleString('vi-VN')}đ</span>` : ''}
                        </div>
                        <input type="tel" inputmode="numeric" value="${m.depositPaid ? m.depositPaid.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'depositPaid', this)" placeholder="Số tiền khách đã chuyển..." class="w-full px-3 py-2 border rounded-xl font-mono font-bold text-xs text-emerald-700" />
                      </div>
                    </div>

                    <div class="space-y-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[10px] font-black text-slate-500 uppercase">👥 DỰ KIẾN CHI CTP ANH EM (${crewMembers.length})</span>
                        <span class="text-[10px] font-semibold text-slate-400">Chạm thẻ để chọn</span>
                      </div>
                      ${crewMembers.length === 0 ? `
                        <div class="p-2.5 rounded-2xl bg-slate-50 text-[11px] text-slate-400">Show này không có nhân sự CTP đi cùng.</div>
                      ` : crewMembers.map(mid => {
                        const mem = getMember(mid);
                        const memCost = Number(m.rec.crewCosts?.[mid]) || 0;
                        const memTasks = m.rec.crewTasks?.[mid] || {};
                        const roleHint = (sh.roles?.[mid] || []).join(' • ');
                        return `
                          <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                            <div class="flex items-center justify-between gap-2">
                              <div class="flex items-center gap-1.5 flex-wrap">
                                <span class="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase">${escapeHtml(mem.name)}</span>
                                ${roleHint ? `<span class="text-[10px] font-bold text-slate-500">• ${escapeHtml(roleHint)}</span>` : ''}
                              </div>
                              <span class="font-mono font-black text-xs text-slate-900">${memCost.toLocaleString('vi-VN')}đ</span>
                            </div>

                            <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                              ${taskKeys.map(tk => {
                                const active = memTasks[tk] !== undefined && memTasks[tk] !== null;
                                const tVal = active ? memTasks[tk] : getDefaultRateForTask(tk, sh);
                                return `
                                  <div class="flex flex-col">
                                    <button type="button" onclick="ownerActions.toggleOwnerCrewTask('${sh.id}', '${mid}', '${tk}')" class="w-full py-1.5 px-2 rounded-xl text-[10.5px] font-extrabold border transition text-center ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}">
                                      ${taskLabels[tk]}
                                    </button>
                                    ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ownerActions.handleOwnerCrewTaskInput('${sh.id}', '${mid}', '${tk}', this)" class="mt-1 w-full px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-[10px] font-mono font-black text-right" />` : ''}
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          </div>
                        `;
                      }).join('')}
                    </div>

                    <div class="space-y-2">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-black text-slate-500 uppercase">🚌 CHI PHÍ KHÁC (XE, KS, ĂN, ĐỒ):</span>
                        <button type="button" onclick="ownerActions.addOwnerExpense('${sh.id}')" class="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-[10px]">Thêm chi</button>
                      </div>
                      ${(m.rec.otherExpenses || []).map((ex, exIdx) => `
                        <div class="flex items-center gap-1.5">
                          <input type="text" value="${escapeHtml(ex.name || '')}" oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'name', this)" placeholder="Tên khoản chi..." class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs font-bold" />
                          <input type="tel" inputmode="numeric" value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}" oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'amount', this)" placeholder="Số tiền" class="w-28 sm:w-32 px-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs font-mono font-black text-right text-rose-600 shrink-0" />
                          <button type="button" onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx})" class="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 font-bold shrink-0">✕</button>
                        </div>
                      `).join('')}
                    </div>

                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">TỔNG CHI DỰ KIẾN:</span>
                        <span class="font-black text-rose-600">${m.totalExpense.toLocaleString('vi-VN')}đ</span>
                      </div>
                      <div class="text-right">
                        <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">💎 CÒN LẠI (LÃI CHỦ SHOW):</span>
                        <span class="font-black text-emerald-700">${m.netProfit >= 0 ? '+' : ''}${m.netProfit.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="px-3.5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs">Thu gọn ▲</button>
                      <button type="button" onclick="ownerActions.saveShowFinanceNow('${sh.id}')" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs">💾 LƯU THÔNG TIN SHOW</button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          } else {
            const cm = calculateCrewShowMetrics(sh);
            const stObj = CREW_CTP_STATUS_OPTIONS.find(o => o.id === cm.meta.ctpStatus) || CREW_CTP_STATUS_OPTIONS[0];
            const owner = getMember(sh.ownerId);
            const linkedTasks = state.ctpItems?.[sh.id]?.tasks || {};

            return `
              <div class="bg-white rounded-3xl border border-slate-200 p-3.5 space-y-3">
                <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2 cursor-pointer">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="text-[10px] font-mono font-bold text-slate-400">#${idx + 1}</span>
                      <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[9.5px] font-black">🎥 Chủ: ${escapeHtml(owner.name)}</span>
                      <span class="font-mono text-[10px] font-bold text-slate-600">${formatDayMonth(sh.startDate)} (${days}n)</span>
                      <span class="px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${stObj.badgeCls}">${stObj.label}</span>
                    </div>
                    <div class="font-black text-slate-900 text-sm mt-1">📍 ${escapeHtml(sh.location)} ${partnerText ? `<span class="text-slate-500 font-bold text-xs">(${escapeHtml(partnerText)})</span>` : ''}</div>
                  </div>
                  <div class="text-right shrink-0 space-y-0.5">
                    <div class="text-[10px] font-mono text-slate-500">CTP: <b>${formatCompactMoneyPlain(cm.grossCtp)}</b> • Tự chi: <b class="text-rose-600">${cm.selfExpense ? formatCompactMoneyPlain(cm.selfExpense) : '-'}</b></div>
                    <div class="text-[10.5px] font-mono font-black text-emerald-700">BỎ TÚI: ${cm.netPocket >= 0 ? '+' : ''}${formatCompactMoneyPlain(cm.netPocket)}</div>
                  </div>
                </div>

                ${expanded ? `
                  <div class="pt-2.5 border-t border-slate-100 space-y-3">
                    <div class="space-y-1.5">
                      <span class="text-[10px] font-black text-slate-500 uppercase block">CHỦ SHOW (${escapeHtml(owner.name.toUpperCase())}) THANH TOÁN:</span>
                      <div class="flex items-center gap-1.5 flex-wrap">
                        ${CREW_CTP_STATUS_OPTIONS.map(s => `<button type="button" onclick="ownerActions.setCrewCtpStatus('${sh.id}', '${s.id}')" class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${cm.meta.ctpStatus === s.id ? s.badgeCls : 'bg-slate-50 text-slate-600'}">${s.label}</button>`).join('')}
                      </div>
                    </div>

                    <div class="space-y-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[10px] font-black text-slate-500 uppercase">🎬 NHIỆM VỤ CTP (ĐỒNG BỘ TAB TÍNH CTP)</span>
                        <span class="text-[10px] font-semibold text-slate-400">Chạm để chọn</span>
                      </div>
                      <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                        ${taskKeys.map(tk => {
                          const active = linkedTasks[tk] !== undefined && linkedTasks[tk] !== null;
                          const tVal = active ? linkedTasks[tk] : getDefaultRateForTask(tk, sh);
                          return `
                            <div class="flex flex-col">
                              <button type="button" onclick="ownerActions.toggleSyncedCtpTask('${sh.id}', '${tk}')" class="w-full py-1.5 px-2 rounded-xl text-[10.5px] font-extrabold border transition text-center ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200'}">
                                ${taskLabels[tk]}
                              </button>
                              ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ownerActions.handleSyncedCtpTaskInput('${sh.id}', '${tk}', this)" class="mt-1 w-full px-1.5 py-1 bg-indigo-50 border border-indigo-300 rounded-lg text-[10px] font-mono font-black text-right" />` : ''}
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">💵 CHI PHÍ CÁ NHÂN TỰ TÚC:</label>
                        <input type="tel" inputmode="numeric" value="${cm.selfExpense ? cm.selfExpense.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleCrewSelfExpenseInput('${sh.id}', this)" placeholder="VD: Nhập số tiền.." class="w-full px-3 py-2 border rounded-xl font-mono font-bold text-xs text-rose-600" />
                      </div>
                      <div>
                        <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">📝 GHI CHÚ CÁ NHÂN:</label>
                        <input type="text" value="${escapeHtml(cm.meta.selfExpenseNote || '')}" oninput="ownerActions.handleCrewNoteInput('${sh.id}', this.value)" placeholder="Ghi chú thêm..." class="w-full px-3 py-2 border rounded-xl text-xs font-semibold" />
                      </div>
                    </div>

                    <div class="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
                      <div>
                        <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">TỔNG BILL CTP:</span>
                        <span class="font-black text-slate-900">${cm.grossCtp.toLocaleString('vi-VN')}đ</span>
                      </div>
                      <div class="text-right">
                        <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">💎 BỎ TÚI THỰC NHẬN:</span>
                        <span class="font-black text-emerald-700">${cm.netPocket >= 0 ? '+' : ''}${cm.netPocket.toLocaleString('vi-VN')}đ</span>
                      </div>
                    </div>

                    <div class="flex items-center gap-2">
                      <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="px-3.5 py-2.5 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs">Thu gọn ▲</button>
                      <button type="button" onclick="ownerActions.saveShowFinanceNow('${sh.id}')" class="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs">💾 LƯU THÔNG TIN</button>
                    </div>
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
