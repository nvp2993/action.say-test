import { state } from '../state/store.js';
import { CREW_CTP_STATUS_OPTIONS } from '../config/constants.js';
import { escapeHtml, getShowDays, getMember, formatCompactMoneyPlain, buildVietQrUrl } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import { getCombinedCtpShows, calculateCrewShowMetrics, getDefaultRateForTask, getMemberExtrasForShow } from '../services/finance.service.js';
import { renderUnifiedDateBarHtml } from './header.ui.js';

function shouldCountShowMoney(sh) {
  return !sh?.isHold || Boolean(sh?.countHoldForBilling);
}

function cleanHoldTitle(loc) {
  return String(loc || '').replace(/^⏳\s*GIỮ LỊCH:\s*/i, '').trim();
}

function parseDateParts(rawDate) {
  if (!rawDate) return null;
  if (rawDate instanceof Date && !Number.isNaN(rawDate.getTime())) {
    return {
      day: rawDate.getDate(),
      month: rawDate.getMonth() + 1,
      year: rawDate.getFullYear()
    };
  }
  const str = String(rawDate).trim();
  const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return {
      year: Number(isoMatch[1]),
      month: Number(isoMatch[2]),
      day: Number(isoMatch[3])
    };
  }
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?/);
  if (dmyMatch) {
    return {
      day: Number(dmyMatch[1]),
      month: Number(dmyMatch[2]),
      year: dmyMatch[3] ? Number(dmyMatch[3]) : Number(state.selectedYear || new Date().getFullYear())
    };
  }
  const dt = new Date(str);
  if (!Number.isNaN(dt.getTime())) {
    return {
      day: dt.getDate(),
      month: dt.getMonth() + 1,
      year: dt.getFullYear()
    };
  }
  return null;
}

function formatShowDateRange(sh, days) {
  const start = parseDateParts(sh?.startDate);
  if (!start) return '';

  const totalDays = Math.max(1, Number(days || getShowDays(sh) || 1));
  let end = parseDateParts(sh?.endDate);

  if (!end) {
    const startObj = new Date(start.year, start.month - 1, start.day);
    startObj.setDate(startObj.getDate() + totalDays - 1);
    end = {
      day: startObj.getDate(),
      month: startObj.getMonth() + 1,
      year: startObj.getFullYear()
    };
  }

  const sameDay =
    totalDays <= 1 ||
    (start.day === end.day && start.month === end.month && start.year === end.year);

  if (sameDay) {
    return `${start.day}/${start.month}`;
  }

  if (start.month === end.month && start.year === end.year) {
    return `${start.day}-${end.day}/${start.month}`;
  }

  return `${start.day}/${start.month}-${end.day}/${end.month}`;
}

function isShowBodyExpanded(showId) {
  const collapsedMap = state.ctpCollapsedShowIds || state.ownerCollapsedShowIds || {};
  if (collapsedMap && typeof collapsedMap === 'object' && collapsedMap[showId]) {
    return false;
  }
  return true;
}

function formatCleanStatusLabel(label) {
  return String(label || '')
    .replace(/^⏳\s*/, '')
    .replace(/^✅\s*/, '')
    .replace(/Chủ Show\s*(trả)?/gi, 'trả')
    .replace(/\s+/g, ' ')
    .trim();
}

function getColoredStatusBtnClass(statusId, isActive) {
  const isSettled = statusId === 'settled';
  if (!isActive) {
    return 'bg-white/85 hover:bg-white text-slate-500 border-slate-200/80 font-medium';
  }
  if (isSettled) {
    return 'bg-emerald-50 text-emerald-800 border-emerald-300/90 font-extrabold shadow-2xs';
  }
  return 'bg-amber-50 text-amber-800 border-amber-300/90 font-extrabold shadow-2xs';
}

function getAllCrewShowsForCurrentMember(uid) {
  const combined = typeof getCombinedCtpShows === 'function' ? getCombinedCtpShows() : (state.shows || []);
  return combined.filter(sh => {
    if (!sh || sh.isCancelled || !sh.startDate) return false;
    if (!sh.isCustomCtp && sh.ownerId === uid) return false;
    if (!sh.isCustomCtp && !(sh.memberIds || []).includes(uid)) return false;
    const [y, m] = sh.startDate.split('-').map(Number);
    if (y !== state.selectedYear) return false;
    if (!state.ctpAllMonths && m !== state.ctpMonth) return false;
    return true;
  }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
}

export function renderCtpTabHtml() {
  const uid = state.currentUserId;
  const curMem = getMember(uid);
  const crewShows = getAllCrewShowsForCurrentMember(uid);

  let billSum = 0, extraSum = 0, pendingSum = 0, settledSum = 0, unsettledCount = 0;

  crewShows.forEach(sh => {
    const cm = calculateCrewShowMetrics(sh);
    if (!cm.isSettled) unsettledCount++;
    if (!shouldCountShowMoney(sh)) return;

    billSum += cm.grossCtp;
    extraSum += cm.extraBillSum;
    if (cm.isSettled) {
      settledSum += cm.grossCtp;
    } else {
      pendingSum += cm.pendingCtpDebt;
    }
  });

  const filterMode = state.ctpFilterStatus || 'all';
  const hide = Boolean(state.hideMoneyMode);
  const fmtMoney = (n) => (hide ? '••••••đ' : `${Number(n || 0).toLocaleString('vi-VN')}đ`);

  const statCards = [
    { label: 'TỔNG BILL CTP', val: fmtMoney(billSum), wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-amber-300' },
    { label: 'CHI PHÍ PHÁT SINH', val: fmtMoney(extraSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-indigo-700' },
    { label: 'CTP CHƯA NHẬN', val: fmtMoney(pendingSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-amber-700' },
    { label: 'CTP ĐÃ NHẬN', val: fmtMoney(settledSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-emerald-700' }
  ];

  const filtered = crewShows.filter(sh => {
    const cm = calculateCrewShowMetrics(sh);
    if (filterMode === 'unsettled') return !cm.isSettled;
    if (filterMode === 'settled') return cm.isSettled;
    return true;
  });

  const taskKeys = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'];
  const taskLabels = { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Hình', flycam: 'Flycam', gimbal: 'Gimbal' };

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      <div class="bg-[#f8fafc] px-3 py-2.5 border-b border-slate-200/90 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase tracking-tight truncate">🧾 CTP: ${escapeHtml(curMem.name)}</span>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="appActions.toggleHideMoneyMode()" class="px-2.5 py-1 rounded-full bg-slate-200/70 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700 transition">
              ${hide ? '👁️ Hiện tiền' : '🙈 Ẩn tiền'}
            </button>
            <button type="button" onclick="ctpActions.openCtpBillModal()" class="px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-extrabold transition">📤 Gửi Bill</button>
            <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold transition">+ Show Ngoài</button>
          </div>
        </div>
        <div class="as-ios-seg-bar">
          ${[
            { id: 'all', label: `ALL (${crewShows.length})` },
            { id: 'unsettled', label: 'Chưa nhận' },
            { id: 'settled', label: 'Đã nhận' }
          ].map(f => `<button type="button" onclick="ctpActions.setFilterStatus('${f.id}')" class="as-ios-seg-item ${filterMode === f.id ? 'active' : ''}">${f.label}</button>`).join('')}
        </div>
        ${renderUnifiedDateBarHtml('ctp')}
      </div>

      <div id="ctp-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll px-3 sm:px-4 pb-4">
        <div class="max-w-6xl mx-auto space-y-3">
          <div onclick="appActions.toggleHideMoneyMode()" class="sticky top-0 z-30 bg-[#f1f5f9] -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 pb-2.5 border-b border-slate-200/80 cursor-pointer">
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              ${statCards.map(c => `
                <div class="px-3.5 py-2 rounded-2xl border shadow-2xs transition ${c.wrapCls}">
                  <span class="text-[9px] font-extrabold uppercase tracking-wider block truncate ${c.labelCls}">${c.label}</span>
                  <span class="font-black font-mono tabular-nums text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
                </div>
              `).join('')}
            </div>
          </div>

          ${filtered.length === 0 ? `
            <div class="text-center py-12 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-3 p-4">
              <div class="text-3xl">📭</div>
              <div class="text-slate-800 font-bold text-xs">Chưa có show CTP nào trong mục lọc này (${unsettledCount} show chờ nhận)</div>
              <div class="flex items-center justify-center gap-2">
                <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="px-4 py-2 rounded-full bg-slate-950 text-white font-extrabold text-xs">+ Show Ngoài</button>
              </div>
            </div>
          ` : `
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
              ${filtered.map((sh) => {
                const expanded = isShowBodyExpanded(sh.id);
                const days = Math.max(1, Number(getShowDays(sh) || 1));
                const dateLabel = formatShowDateRange(sh, days);
                const partnerText = getVisiblePartnerText(sh);
                const isCounted = shouldCountShowMoney(sh);
                const displayLocation = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
                const holdCardStyle = sh.isHold
                  ? 'style="background: repeating-linear-gradient(-45deg, #fffbeb, #fffbeb 10px, #fef3c7 10px, #fef3c7 20px); border: 1.5px dashed #f59e0b;"'
                  : '';
                const holdCardCls = sh.isHold
                  ? 'rounded-3xl p-4 space-y-3 shadow-2xs'
                  : 'bg-white rounded-3xl border border-slate-200/90 hover:border-slate-300 p-4 space-y-3 shadow-2xs transition-colors';
                const holdBillingBarHtml = sh.isHold ? `
                  <div onclick="event.stopPropagation(); ctpActions.toggleHoldBilling('${sh.id}')" class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition select-none ${
                    sh.countHoldForBilling
                      ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900'
                      : 'bg-white/90 border-amber-300/80 text-amber-900 hover:bg-white'
                  }">
                    <span class="text-[10.5px] font-extrabold truncate">
                      ${sh.countHoldForBilling ? '💰 Đang tính tiền lịch giữ' : '💵 Tính tiền lịch giữ (0đ)'}
                    </span>
                    <div class="w-8 h-4.5 rounded-full p-0.5 transition-colors shrink-0 ${sh.countHoldForBilling ? 'bg-emerald-500' : 'bg-slate-300'}">
                      <div class="w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-transform ${sh.countHoldForBilling ? 'translate-x-3.5' : 'translate-x-0'}"></div>
                    </div>
                  </div>
                ` : '';

                const cm = calculateCrewShowMetrics(sh);
                const owner = getMember(sh.ownerId);
                const bossLabel = sh.isCustomCtp ? (sh.customBossName || 'Show ngoài') : owner.name;
                const linkedTasks = state.ctpItems?.[sh.id]?.tasks || {};
                const myExtras = getMemberExtrasForShow(sh.id, uid);
                const myExtrasSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

                return `
                  <article id="ctp-show-card-${escapeHtml(sh.id)}" ${holdCardStyle} class="${holdCardCls} flex flex-col justify-between min-w-0">
                    <div class="space-y-3">
                      <div onclick="ctpActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2.5 min-h-[54px] -mx-1.5 -mt-1.5 px-3 py-2.5 rounded-2xl cursor-pointer ${sh.isHold ? 'bg-white/65 border-b border-amber-200/80' : 'bg-[#f8fafc] border-b border-slate-200/70'}">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500 whitespace-nowrap overflow-hidden">
                            <span class="font-mono font-bold text-indigo-600 tabular-nums shrink-0">${dateLabel}</span>
                            <span>•</span>
                            <span class="font-semibold text-slate-600 tabular-nums shrink-0">${days}n</span>
                            <span>•</span>
                            <span class="truncate">Sếp: <b class="text-slate-800">${escapeHtml(bossLabel)}</b></span>
                          </div>
                          <h4 class="font-black text-slate-900 text-sm mt-1 truncate" title="${escapeHtml(displayLocation)}${partnerText ? ` (${escapeHtml(partnerText)})` : ''}">
                            ${escapeHtml(displayLocation)}${partnerText ? ` <span class="text-slate-500 font-semibold text-xs">(${escapeHtml(partnerText)})</span>` : ''}
                          </h4>
                        </div>
                        <div class="text-right shrink-0">
                          <span class="text-[9px] font-black uppercase tracking-wider text-slate-500 block">${sh.isHold && !sh.countHoldForBilling ? 'Tạm giữ' : 'TỔNG SHOW'}</span>
                          <span class="text-[15px] font-mono font-black tabular-nums tracking-tight ${isCounted ? 'text-slate-950' : 'text-slate-400'} block">${isCounted ? fmtMoney(cm.grossCtp) : '0đ'}</span>
                        </div>
                      </div>

                      ${holdBillingBarHtml}

                      ${expanded ? `
                        <div class="space-y-3">
                          <div class="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#f8fafc] border border-slate-200/80">
                            ${CREW_CTP_STATUS_OPTIONS.map(s => `<button type="button" onclick="ctpActions.setCtpStatus('${sh.id}', '${s.id}')" class="py-1 px-2 rounded-lg text-[10.5px] border truncate transition ${getColoredStatusBtnClass(s.id, cm.meta.ctpStatus === s.id)}">${escapeHtml(formatCleanStatusLabel(s.label))}</button>`).join('')}
                          </div>

                          <div class="space-y-1.5">
                            <div class="flex items-center justify-between gap-2">
                              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">CTP</span>
                              <span class="font-mono font-bold tabular-nums text-[10.5px] text-slate-500">${cm.taskSum.toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div class="grid grid-cols-3 gap-1">
                              ${taskKeys.map(tk => {
                                const active = linkedTasks[tk] !== undefined && linkedTasks[tk] !== null;
                                const tVal = active ? linkedTasks[tk] : getDefaultRateForTask(tk, sh);
                                return `
                                  <div class="h-6 rounded-md border px-1.5 flex items-center justify-between gap-0.5 transition min-w-0 ${
                                    active
                                      ? 'bg-slate-100 border-slate-300/90 text-slate-900'
                                      : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/75 text-slate-600'
                                  }">
                                    <button type="button" onclick="ctpActions.toggleSyncedCtpTask('${sh.id}', '${tk}')" class="text-left text-[10px] truncate ${active ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}">
                                      ${taskLabels[tk]}
                                    </button>
                                    ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ctpActions.handleSyncedCtpTaskInput('${sh.id}', '${tk}', this)" class="w-12 min-w-0 bg-transparent text-right font-mono font-extrabold tabular-nums text-[9.5px] text-slate-900 focus:outline-none" />` : ''}
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          </div>

                          <div class="pt-2.5 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-1.5">
                            <div class="flex items-center justify-between gap-2">
                              <div class="flex items-center gap-2 min-w-0">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">PHÁT SINH</span>
                                ${myExtras.length > 0 ? `
                                  <span id="ctp-show-extra-sum-${sh.id}" class="font-mono font-black tabular-nums text-[10.5px] text-emerald-700 shrink-0">
                                    ${myExtrasSum.toLocaleString('vi-VN')}đ
                                  </span>
                                ` : ''}
                              </div>
                              <button type="button" onclick="ctpActions.addExtraItem('${sh.id}')" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold transition shrink-0">+ Thêm phát sinh</button>
                            </div>

                            ${myExtras.length === 0 ? `
                              <div class="text-[11px] text-slate-400 py-0.5">• Không có phát sinh</div>
                            ` : `
                              <ul class="divide-y divide-slate-100">
                                ${myExtras.map((ex, exIdx) => {
                                  const rowKey = `${sh.id}_${ex.id || exIdx}`;
                                  const isEditingRow = state.ctpEditingExtraKey === rowKey;
                                  if (isEditingRow) {
                                    return `
                                      <li class="py-1.5 space-y-1.5">
                                        <div class="flex items-center gap-1.5">
                                          <span class="text-slate-400 font-black select-none">•</span>
                                          <input
                                            id="ctp-extra-name-${escapeHtml(rowKey)}"
                                            type="text"
                                            value="${escapeHtml(ex.name || '')}"
                                            oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                            onkeydown="if(event.key==='Enter'){event.preventDefault();ctpActions.finishEditExtra();}"
                                            placeholder="Tên khoản chi..."
                                            class="flex-1 min-w-0 px-2.5 py-1 bg-[#f8fafc] border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                          />
                                        </div>
                                        <div class="flex items-center justify-end gap-1">
                                          <input
                                            type="tel"
                                            inputmode="numeric"
                                            value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}"
                                            oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                            onkeydown="if(event.key==='Enter'){event.preventDefault();ctpActions.finishEditExtra();}"
                                            placeholder="Số tiền"
                                            class="w-24 px-2 py-1 bg-[#f8fafc] border border-slate-300 rounded-lg text-[11px] font-mono font-black tabular-nums text-emerald-700 text-right focus:outline-none focus:border-slate-900"
                                          />
                                          <button
                                            type="button"
                                            onclick="ctpActions.finishEditExtra()"
                                            class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] transition"
                                          >Xong</button>
                                          <button
                                            type="button"
                                            onclick="ctpActions.removeExtraItem('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                            title="Xóa khoản chi"
                                            class="w-6 h-6 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 font-bold text-[10px] flex items-center justify-center transition"
                                          >✕</button>
                                        </div>
                                      </li>
                                    `;
                                  }

                                  return `
                                    <li class="flex items-center justify-between gap-1.5 py-1">
                                      <div class="flex items-center gap-1.5 min-w-0 flex-1 text-[11px]">
                                        <span class="text-slate-400 font-black select-none shrink-0">•</span>
                                        <span class="font-semibold text-slate-800 truncate">${escapeHtml(ex.name || 'Khoản phát sinh')}</span>
                                        <span class="text-slate-300 shrink-0">—</span>
                                        <span class="font-mono font-extrabold tabular-nums text-emerald-700 shrink-0">${Number(ex.amount || 0).toLocaleString('vi-VN')}đ</span>
                                      </div>
                                      <div class="flex items-center gap-0.5 shrink-0">
                                        <button
                                          type="button"
                                          onclick="ctpActions.startEditExtra('${escapeHtml(rowKey)}')"
                                          class="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                        >Sửa</button>
                                        <button
                                          type="button"
                                          onclick="ctpActions.removeExtraItem('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                          title="Xóa khoản chi"
                                          class="w-5 h-5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center justify-center transition"
                                        >✕</button>
                                      </div>
                                    </li>
                                  `;
                                }).join('')}
                              </ul>
                            `}
                          </div>
                        </div>
                      ` : ''}
                    </div>

                    ${expanded ? `
                      <div class="pt-2.5 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-2.5">
                        <div class="flex items-center justify-between text-xs font-mono tabular-nums">
                          <div>
                            <span class="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider block">CTP + PS</span>
                            <span class="font-black text-slate-900">${cm.taskSum.toLocaleString('vi-VN')}đ + ${cm.extraBillSum.toLocaleString('vi-VN')}đ</span>
                          </div>
                          <div class="text-right">
                            <span class="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider block">TỔNG BILL</span>
                            <span class="text-[14px] font-black text-emerald-700">${cm.grossCtp.toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>

                        <div class="flex items-center gap-1.5">
                          <button type="button" onclick="ctpActions.toggleExpandShow('${sh.id}')" class="px-2.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-[11px] transition">Thu gọn ▲</button>
                          <button type="button" onclick="ctpActions.saveShowFinanceNow('${sh.id}')" class="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[11px] transition">💾 LƯU</button>
                        </div>
                      </div>
                    ` : `
                      <div class="pt-2 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} flex items-center justify-between text-[11px]">
                        <span class="text-slate-400 font-semibold">Đã thu gọn</span>
                        <button type="button" onclick="ctpActions.toggleExpandShow('${sh.id}')" class="font-bold text-slate-700 hover:text-slate-950">Mở rộng ▼</button>
                      </div>
                    `}
                  </article>
                `;
              }).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

export function renderCtpBillModalHtml() {
  if (!state.ctpBillModalOpen) return '';
  const uid = state.currentUserId;
  const curMem = getMember(uid);
  const allShows = getAllCrewShowsForCurrentMember(uid).filter(sh => shouldCountShowMoney(sh));

  const bossOptionsMap = new Map();
  allShows.forEach(sh => {
    const key = sh.isCustomCtp ? `custom:${sh.customBossName || 'Ngoài'}` : `member:${sh.ownerId}`;
    const label = sh.isCustomCtp ? (sh.customBossName || 'Show ngoài') : getMember(sh.ownerId).name;
    if (!bossOptionsMap.has(key)) bossOptionsMap.set(key, label);
  });

  const selectedBoss = state.ctpBillBossFilter || 'all';
  const billShows = allShows.filter(sh => {
    const cm = calculateCrewShowMetrics(sh);
    if (cm.isSettled) return false;
    if (selectedBoss === 'all') return true;
    const key = sh.isCustomCtp ? `custom:${sh.customBossName || 'Ngoài'}` : `member:${sh.ownerId}`;
    return key === selectedBoss;
  });

  const totalAmount = billShows.reduce((sum, sh) => sum + calculateCrewShowMetrics(sh).pendingCtpDebt, 0);
  const periodLabel = state.ctpAllMonths ? `Năm ${state.selectedYear}` : `T${state.ctpMonth}/${state.selectedYear}`;
  const noteText = `CTP ${curMem.name} ${periodLabel}`.trim();
  const qrUrl = totalAmount > 0 && typeof buildVietQrUrl === 'function'
    ? buildVietQrUrl(curMem, totalAmount, noteText)
    : '';

  return `
    <div onclick="ctpActions.closeCtpBillModal()" class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div onclick="event.stopPropagation()" class="ios-sheet bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[90vh] flex flex-col">
        <div class="flex items-center justify-between border-b border-slate-100 pb-2.5 shrink-0">
          <div>
            <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">Tổng hợp thanh toán</span>
            <h3 class="text-base font-black text-slate-900">🧾 BILL CTP: ${escapeHtml(curMem.name)}</h3>
          </div>
          <button type="button" onclick="ctpActions.closeCtpBillModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        ${bossOptionsMap.size > 1 ? `
          <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            <button type="button" onclick="ctpActions.setCtpBillBossFilter('all')" class="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border shrink-0 ${selectedBoss === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-[#f8fafc] text-slate-600 border-slate-200'}">
              Tất cả Sếp
            </button>
            ${Array.from(bossOptionsMap.entries()).map(([key, label]) => `
              <button type="button" onclick="ctpActions.setCtpBillBossFilter('${escapeHtml(key)}')" class="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold border shrink-0 ${selectedBoss === key ? 'bg-slate-900 text-white border-slate-900' : 'bg-[#f8fafc] text-slate-600 border-slate-200'}">
                ${escapeHtml(label)}
              </button>
            `).join('')}
          </div>
        ` : ''}

        <div id="ctp-bill-capture-area" class="flex-1 min-h-0 overflow-y-auto custom-scroll bg-[#f8fafc] rounded-2xl border border-slate-200/90 p-3.5 space-y-3">
          <div class="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <div>
              <div class="text-xs font-black text-slate-900 uppercase">BẢNG KÊ CTP • ${escapeHtml(periodLabel)}</div>
              <div class="text-[11px] text-slate-500 font-semibold">Nhân sự: <b class="text-slate-800">${escapeHtml(curMem.name)}</b></div>
            </div>
            <div class="text-right">
              <span class="text-[9.5px] font-black uppercase text-slate-400 block">Tổng cộng</span>
              <span class="text-base font-mono font-black tabular-nums text-emerald-700">${totalAmount.toLocaleString('vi-VN')}đ</span>
            </div>
          </div>

          ${billShows.length === 0 ? `
            <div class="text-center py-6 text-xs font-semibold text-slate-500">Không còn khoản CTP chưa nhận trong mục này</div>
          ` : `
            <div class="space-y-2">
              ${billShows.map((sh, idx) => {
                const cm = calculateCrewShowMetrics(sh);
                const days = Math.max(1, Number(getShowDays(sh) || 1));
                const dateLabel = formatShowDateRange(sh, days);
                const loc = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
                return `
                  <div class="bg-white rounded-xl border border-slate-200/80 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                    <div class="min-w-0">
                      <div class="font-bold text-slate-900 truncate">${idx + 1}. ${escapeHtml(loc)}</div>
                      <div class="text-[10px] text-slate-500 font-mono">${escapeHtml(dateLabel)} • CTP ${formatCompactMoneyPlain(cm.taskSum)}${cm.extraBillSum > 0 ? ` + PS ${formatCompactMoneyPlain(cm.extraBillSum)}` : ''}</div>
                    </div>
                    <span class="font-mono font-black tabular-nums text-slate-900 shrink-0">${cm.pendingCtpDebt.toLocaleString('vi-VN')}đ</span>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          ${qrUrl ? `
            <div class="bg-white rounded-2xl border border-slate-200/80 p-3 flex flex-col items-center text-center space-y-1.5">
              <img src="${escapeHtml(qrUrl)}" alt="VietQR" class="w-44 h-44 object-contain rounded-xl" />
              <div class="text-[11px] font-extrabold text-slate-800">${escapeHtml(curMem.bankName || '')} • ${escapeHtml(curMem.bankAcc || '')}</div>
              <div class="text-[10px] text-slate-500">${escapeHtml(curMem.bankOwner || curMem.name)}</div>
            </div>
          ` : ''}
        </div>

        <div class="flex items-center gap-2 shrink-0 pt-1">
          <button type="button" onclick="ctpActions.copyCtpBillText()" class="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition">📋 Copy nội dung Bill</button>
          <button type="button" onclick="ctpActions.closeCtpBillModal()" class="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition">Đóng</button>
        </div>
      </div>
    </div>
  `;
}
