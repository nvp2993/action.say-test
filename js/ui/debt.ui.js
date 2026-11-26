import { state } from '../state/store.js';
import { escapeHtml, getMember, getShowDays } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import {
  ensureOwnerFinRecord,
  calculateOwnerShowMetrics,
  calculateCrewShowMetrics,
  getDefaultRateForTask,
  getMemberExtrasForShow
} from '../services/finance.service.js';
import { renderUnifiedDateBarHtml } from './header.ui.js';

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

  if (sameDay) return `${start.day}/${start.month}`;
  if (start.month === end.month && start.year === end.year) {
    return `${start.day}-${end.day}/${start.month}`;
  }
  return `${start.day}/${start.month}-${end.day}/${end.month}`;
}

export function renderDebtTabHtml() {
  const uid = state.currentUserId;
  const curMem = getMember(uid);
  const hide = Boolean(state.hideMoneyMode);
  const fmtMoney = (n) => (hide ? '••••••đ' : `${Number(n || 0).toLocaleString('vi-VN')}đ`);
  const fmtSigned = (n) => {
    if (hide) return '••••••đ';
    const num = Number(n || 0);
    return `${num >= 0 ? '+' : ''}${num.toLocaleString('vi-VN')}đ`;
  };

  const periodShows = (state.shows || [])
    .filter(sh => {
      if (!sh || sh.isCancelled || sh.isHold || !sh.startDate) return false;
      if (sh.ownerId !== uid && !(sh.memberIds || []).includes(uid)) return false;
      const [y, m] = sh.startDate.split('-').map(Number);
      if (y !== state.selectedYear) return false;
      if (!state.ownerAllMonths && m !== state.ownerMonth) return false;
      return true;
    })
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  const bossCounts = {};
  periodShows.forEach(sh => {
    if (sh.ownerId === uid) return;
    const bId = sh.ownerId || 'unknown';
    const bMem = getMember(bId);
    if (!bossCounts[bId]) bossCounts[bId] = { key: bId, label: bMem.name, count: 0 };
    bossCounts[bId].count++;
  });
  const bossList = Object.values(bossCounts);

  const filterStatus = state.ownerFilterStatus || 'all';
  const bossFilterKey = state.ownerBossFilterKey || 'all';

  let totalClientDebt = 0;
  let totalCrewUnpaid = 0;
  let totalNetProfit = 0;
  let totalCrewReceivable = 0;
  let pendingShowsCount = 0;

  const enriched = periodShows.map(sh => {
    const isOwner = sh.ownerId === uid;
    if (isOwner) {
      const m = calculateOwnerShowMetrics(sh);
      const isSettled = m.rec.status === 'settled';
      if (!isSettled) {
        totalClientDebt += Math.max(0, m.remainingClientDebt);
        totalCrewUnpaid += Math.max(0, m.unpaidCrewSum);
        pendingShowsCount++;
      }
      totalNetProfit += m.netProfit;
      return { sh, isOwner: true, m, isSettled };
    } else {
      const cm = calculateCrewShowMetrics(sh);
      const isSettled = cm.ctpStatus === 'settled';
      if (!isSettled) {
        totalCrewReceivable += Math.max(0, cm.netPocket);
        pendingShowsCount++;
      }
      totalNetProfit += cm.netPocket;
      return { sh, isOwner: false, cm, isSettled };
    }
  });

  const visibleList = enriched.filter(row => {
    if (bossFilterKey !== 'all') {
      if (bossFilterKey === 'mine' && !row.isOwner) return false;
      if (bossFilterKey !== 'mine' && row.sh.ownerId !== bossFilterKey) return false;
    }
    if (filterStatus === 'unpaid' && row.isSettled) return false;
    if (filterStatus === 'settled' && !row.isSettled) return false;
    if (filterStatus === 'owner_only' && !row.isOwner) return false;
    if (filterStatus === 'crew_only' && row.isOwner) return false;
    return true;
  });

  const debtStatCards = [
    {
      id: 'owner-debt-client-display',
      label: 'KHÁCH CÒN NỢ',
      val: fmtMoney(totalClientDebt),
      wrapCls: 'bg-slate-900 border-slate-900 text-white',
      labelCls: 'text-slate-300',
      valCls: 'text-rose-300'
    },
    {
      id: 'owner-debt-crew-unpaid-display',
      label: 'NỢ EKIP / CTP',
      val: fmtMoney(totalCrewUnpaid),
      wrapCls: 'bg-white border-slate-200/90 text-slate-900',
      labelCls: 'text-slate-400',
      valCls: 'text-amber-700'
    },
    {
      id: 'owner-debt-crew-recv-display',
      label: 'CTP CHỜ NHẬN',
      val: fmtMoney(totalCrewReceivable),
      wrapCls: 'bg-white border-slate-200/90 text-slate-900',
      labelCls: 'text-slate-400',
      valCls: 'text-indigo-700'
    },
    {
      id: 'owner-debt-net-display',
      label: 'LỢI NHUẬN RÒNG',
      val: fmtSigned(totalNetProfit),
      wrapCls: 'bg-white border-slate-200/90 text-slate-900',
      labelCls: 'text-slate-400',
      valCls: totalNetProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'
    }
  ];

  const statusTabs = [
    { key: 'all', label: `Tất cả (${enriched.length})` },
    { key: 'unpaid', label: `Chưa chốt (${pendingShowsCount})` },
    { key: 'settled', label: `Đã xong (${enriched.length - pendingShowsCount})` },
    { key: 'owner_only', label: 'Chủ show' },
    { key: 'crew_only', label: 'Đi show' }
  ];

  const taskDefs = [
    { key: 'quay', label: 'Quay' },
    { key: 'dung', label: 'Dựng' },
    { key: 'chup', label: 'Chụp' },
    { key: 'lamhinh', label: 'Hình' },
    { key: 'flycam', label: 'Flycam' },
    { key: 'gimbal', label: 'Gimbal' }
  ];

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      <div class="bg-[#f8fafc] px-3 py-2 sm:py-2.5 border-b border-slate-200/90 shrink-0 space-y-1.5 sm:space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase tracking-tight truncate">💰 CÔNG NỢ (${escapeHtml(curMem.name)})</span>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="ownerActions.openClientDebtBill()" class="px-2.5 py-1 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black transition">
              🧾 Bill Khách
            </button>
            <button type="button" onclick="appActions.toggleHideMoneyMode()" class="px-2.5 py-1 rounded-full bg-slate-200/70 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700 transition">
              ${hide ? '👁️ Hiện' : '🙈 Ẩn'}
            </button>
          </div>
        </div>

        ${renderUnifiedDateBarHtml('owner')}

        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
          ${statusTabs.map(st => `
            <button
              type="button"
              onclick="ownerActions.setFilterStatus('${st.key}')"
              class="px-2.5 py-1 rounded-full text-[10.5px] font-extrabold whitespace-nowrap shrink-0 transition ${
                filterStatus === st.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }"
            >${st.label}</button>
          `).join('')}
        </div>

        ${bossList.length > 0 ? `
          <div class="lg:hidden flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <button
              type="button"
              onclick="ownerActions.setBossFilter('all')"
              class="px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${bossFilterKey === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}"
            >Mọi Sếp</button>
            <button
              type="button"
              onclick="ownerActions.setBossFilter('mine')"
              class="px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${bossFilterKey === 'mine' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}"
            >Show của tôi</button>
            ${bossList.map(b => `
              <button
                type="button"
                onclick="ownerActions.setBossFilter('${escapeHtml(b.key)}')"
                class="px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${bossFilterKey === b.key ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}"
              >${escapeHtml(b.label)} (${b.count})</button>
            `).join('')}
          </div>
        ` : ''}
      </div>

      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[336px_minmax(0,1fr)]">
        <aside class="hidden lg:flex flex-col gap-3 p-3.5 bg-[#f8fafc] border-r border-slate-200/90 overflow-y-auto custom-scroll">
          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lọc theo Sếp / Vai trò</span>
              <span class="text-[10px] font-mono font-bold text-slate-400 tabular-nums">${visibleList.length} show</span>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <button type="button" onclick="ownerActions.setBossFilter('all')" class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${bossFilterKey === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">Tất cả</button>
              <button type="button" onclick="ownerActions.setBossFilter('mine')" class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${bossFilterKey === 'mine' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}">Show của tôi</button>
              ${bossList.map(b => `
                <button type="button" onclick="ownerActions.setBossFilter('${escapeHtml(b.key)}')" class="px-2.5 py-1 rounded-xl text-[11px] font-extrabold ${bossFilterKey === b.key ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}">${escapeHtml(b.label)} (${b.count})</button>
              `).join('')}
            </div>
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Đối soát & Xuất file</div>
            <button type="button" onclick="ownerActions.openClientDebtBill()" class="w-full py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-extrabold text-[11px] text-left transition">
              🧾 Tạo Bill Công Nợ Khách Hàng
            </button>
            <button type="button" onclick="ownerActions.exportOwnerExcel()" class="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-extrabold text-[11px] text-left transition">
              📊 Xuất Bảng Công Nợ (.XLS)
            </button>
          </div>

          <div class="space-y-2 pt-0.5">
            <button type="button" onclick="ownerActions.saveShowFinanceNow()" class="w-full py-3.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition">
              💾 LƯU & ĐỒNG BỘ CÔNG NỢ
            </button>
          </div>
        </aside>

        <div id="owner-debt-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll px-2.5 sm:px-4 pb-4">
          <div class="max-w-6xl mx-auto space-y-2 sm:space-y-3">
            <div onclick="appActions.toggleHideMoneyMode()" class="sm:sticky sm:top-0 z-20 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 bg-[#f1f5f9] sm:-mx-4 sm:px-4 pt-2 sm:pt-3 pb-1.5 sm:pb-2.5 sm:border-b sm:border-slate-200/80 cursor-pointer">
              ${debtStatCards.map(c => `
                <div class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border shadow-2xs transition ${c.wrapCls}">
                  <span class="text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-wider block truncate ${c.labelCls}">${c.label}</span>
                  <span id="${c.id}" class="font-black font-mono tabular-nums text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
                </div>
              `).join('')}
            </div>

            ${visibleList.length === 0 ? `
              <div class="text-center py-12 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-2 p-4">
                <div class="text-3xl">📭</div>
                <div class="text-slate-800 font-bold text-xs">Không có show phù hợp bộ lọc hiện tại</div>
                <div class="text-[11px] text-slate-400">Thử đổi tháng hoặc chọn "Tất cả" để xem đầy đủ</div>
              </div>
            ` : `
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 items-start">
                ${visibleList.map(({ sh, isOwner, m, cm, isSettled }) => {
                  const days = Math.max(1, Number(getShowDays(sh) || 1));
                  const dateLabel = formatShowDateRange(sh, days);
                  const owner = getMember(sh.ownerId);
                  const partnerText = getVisiblePartnerText(sh);
                  const displayLocation = cleanHoldTitle(sh.location);
                  const isExpanded = state.ownerExpandedShowId === sh.id;

                  if (isOwner) {
                    const rec = ensureOwnerFinRecord(sh);
                    const crewIds = (sh.memberIds || []).filter(mid => mid !== uid);
                    const otherExpenses = Array.isArray(rec.otherExpenses) ? rec.otherExpenses : [];
                    const otherSum = otherExpenses.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

                    return `
                      <article id="debt-show-card-${escapeHtml(sh.id)}" class="bg-white border ${isSettled ? 'border-emerald-200/90' : 'border-slate-200/90 hover:border-slate-300'} rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs space-y-2.5 min-w-0 transition-colors">
                        <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2 -mx-1 -mt-1 sm:-mx-1.5 sm:-mt-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-[#f8fafc] border-b border-slate-200/70 cursor-pointer">
                          <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                              <span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-black text-[9px]">CHỦ SHOW</span>
                              <span class="font-mono font-bold text-indigo-600 tabular-nums shrink-0">${dateLabel}</span>
                              <span>•</span>
                              <span class="font-semibold text-slate-600 tabular-nums shrink-0">${days}n</span>
                            </div>
                            <h4 class="font-black text-slate-900 text-sm mt-1 truncate" title="${escapeHtml(displayLocation)}${partnerText ? ` (${escapeHtml(partnerText)})` : ''}">
                              ${escapeHtml(displayLocation)}${partnerText ? ` <span class="text-slate-500 font-semibold text-xs">(${escapeHtml(partnerText)})</span>` : ''}
                            </h4>
                          </div>
                          <div class="text-right shrink-0">
                            <span class="text-[9px] font-black uppercase tracking-wider block ${isSettled ? 'text-emerald-700' : 'text-rose-600'}">
                              ${isSettled ? 'ĐÃ XONG ✓' : `Nợ: ${fmtMoney(m.remainingClientDebt)}`}
                            </span>
                            <span id="debt-show-net-profit-${sh.id}" class="text-[14px] font-black font-mono tabular-nums ${m.netProfit >= 0 ? 'text-emerald-700' : 'text-rose-600'}">
                              ${fmtSigned(m.netProfit)}
                            </span>
                          </div>
                        </div>

                        <div class="grid grid-cols-2 gap-1.5">
                          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                            <label class="text-[9px] font-black text-slate-400 uppercase block">Báo giá khách</label>
                            <input
                              type="tel"
                              inputmode="numeric"
                              value="${m.clientPrice ? Number(m.clientPrice).toLocaleString('vi-VN') : ''}"
                              oninput="ownerActions.handleMoneyInput('${sh.id}', 'clientPrice', this)"
                              placeholder="0"
                              class="w-full bg-transparent font-mono font-black tabular-nums text-xs text-slate-900 focus:outline-none mt-0.5"
                            />
                          </div>
                          <div class="px-2.5 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80">
                            <label class="text-[9px] font-black text-slate-400 uppercase block">Khách đã trả</label>
                            <input
                              type="tel"
                              inputmode="numeric"
                              value="${m.depositPaid ? Number(m.depositPaid).toLocaleString('vi-VN') : ''}"
                              oninput="ownerActions.handleMoneyInput('${sh.id}', 'depositPaid', this)"
                              placeholder="0"
                              class="w-full bg-transparent font-mono font-black tabular-nums text-xs text-emerald-700 focus:outline-none mt-0.5"
                            />
                          </div>
                        </div>

                        <div class="flex items-center justify-between gap-2 text-[10.5px]">
                          <div class="flex items-center gap-1.5">
                            <button
                              type="button"
                              onclick="ownerActions.setStatus('${sh.id}', '${isSettled ? 'unpaid' : 'settled'}')"
                              class="px-2.5 py-1 rounded-lg font-extrabold transition ${
                                isSettled
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                              }"
                            >${isSettled ? '✓ Đã tất toán' : '⏳ Chưa chốt'}</button>
                            <span class="text-slate-500 font-semibold">Chi: <b id="debt-show-total-exp-${sh.id}" class="font-mono text-slate-800">${m.totalExpense.toLocaleString('vi-VN')}đ</b></span>
                          </div>
                          <button
                            type="button"
                            onclick="ownerActions.toggleExpandShow('${sh.id}')"
                            class="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-[10px]"
                          >${isExpanded ? 'Thu gọn ▲' : `Chi tiết (${crewIds.length} NS) ▼`}</button>
                        </div>

                        ${isExpanded ? `
                          <div class="pt-2.5 border-t border-slate-100 space-y-2.5">
                            ${crewIds.length > 0 ? `
                              <div class="space-y-2">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Chi phí ekip theo nhiệm vụ</span>
                                ${crewIds.map(mid => {
                                  const mem = getMember(mid);
                                  const tMap = rec.crewTasks?.[mid] || {};
                                  const memCost = Number(rec.crewCosts?.[mid] || 0);
                                  return `
                                    <div class="p-2 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                                      <div class="flex items-center justify-between">
                                        <span class="font-extrabold text-slate-800 text-[11px]">${escapeHtml(mem.name)}</span>
                                        <span class="font-mono font-black text-[11px] text-indigo-700 tabular-nums">${memCost.toLocaleString('vi-VN')}đ</span>
                                      </div>
                                      <div class="grid grid-cols-3 gap-1">
                                        ${taskDefs.map(t => {
                                          const checked = tMap[t.key] !== undefined && tMap[t.key] !== null;
                                          const val = checked ? tMap[t.key] : getDefaultRateForTask(t.key, sh);
                                          return `
                                            <div class="h-6 rounded-md border px-1 flex items-center justify-between gap-0.5 transition min-w-0 ${
                                              checked
                                                ? 'bg-white border-slate-300 text-slate-900'
                                                : 'bg-slate-100/70 hover:bg-white border-slate-200/75 text-slate-600'
                                            }">
                                              <button
                                                type="button"
                                                onclick="ownerActions.toggleOwnerCrewTask('${sh.id}', '${mid}', '${t.key}')"
                                                class="text-left text-[9.5px] sm:text-[10px] truncate ${checked ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}"
                                              >${t.label}</button>
                                              ${checked ? `
                                                <input
                                                  type="tel"
                                                  inputmode="numeric"
                                                  value="${Number(val).toLocaleString('vi-VN')}"
                                                  oninput="ownerActions.handleOwnerCrewTaskInput('${sh.id}', '${mid}', '${t.key}', this)"
                                                  class="flex-1 min-w-[34px] bg-transparent text-right font-mono font-extrabold tabular-nums text-[8.5px] sm:text-[9.5px] tracking-tighter text-slate-900 focus:outline-none"
                                                />
                                              ` : ''}
                                            </div>
                                          `;
                                        }).join('')}
                                      </div>
                                    </div>
                                  `;
                                }).join('')}
                              </div>
                            ` : ''}

                            <div class="space-y-1.5">
                              <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5">
                                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Chi phí khác</span>
                                  <span id="debt-show-other-sum-${sh.id}" class="font-mono font-black text-[10.5px] text-emerald-700">${otherSum.toLocaleString('vi-VN')}đ</span>
                                </div>
                                <button type="button" onclick="ownerActions.addOwnerExpense('${sh.id}')" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold">+ Thêm khoản chi</button>
                              </div>

                              ${otherExpenses.length === 0 ? `
                                <div class="text-[11px] text-slate-400">• Không có khoản chi khác</div>
                              ` : `
                                <ul class="divide-y divide-slate-100">
                                  ${otherExpenses.map((ex, exIdx) => {
                                    const rowKey = `${sh.id}_${ex.id || exIdx}`;
                                    const isEd = state.ownerEditingExpenseKey === rowKey;
                                    if (isEd) {
                                      return `
                                        <li class="py-1.5 space-y-1.5">
                                          <input
                                            id="debt-exp-name-${escapeHtml(rowKey)}"
                                            type="text"
                                            value="${escapeHtml(ex.name || '')}"
                                            oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                            onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                            placeholder="Tên khoản chi..."
                                            class="w-full px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-900 focus:outline-none"
                                          />
                                          <div class="flex items-center justify-end gap-1">
                                            <input
                                              type="tel"
                                              inputmode="numeric"
                                              value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}"
                                              oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                              onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                              placeholder="Số tiền"
                                              class="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-mono font-black text-right focus:outline-none"
                                            />
                                            <button type="button" onclick="ownerActions.finishEditOwnerExpense()" class="px-2 py-1 rounded-lg bg-slate-900 text-white font-extrabold text-[10px]">Xong</button>
                                            <button type="button" onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')" class="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 font-bold text-[10px]">✕</button>
                                          </div>
                                        </li>
                                      `;
                                    }
                                    return `
                                      <li class="flex items-center justify-between gap-1.5 py-1 text-[11px]">
                                        <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                          <span class="font-semibold text-slate-800 truncate">• ${escapeHtml(ex.name || 'Khoản chi')}</span>
                                          <span class="font-mono font-extrabold text-emerald-700 shrink-0">${Number(ex.amount || 0).toLocaleString('vi-VN')}đ</span>
                                        </div>
                                        <div class="flex items-center gap-0.5 shrink-0">
                                          <button type="button" onclick="ownerActions.startEditOwnerExpense('${escapeHtml(rowKey)}')" class="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:bg-slate-100">Sửa</button>
                                          <button type="button" onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')" class="w-5 h-5 rounded text-slate-400 hover:text-rose-600 font-bold text-[10px]">✕</button>
                                        </div>
                                      </li>
                                    `;
                                  }).join('')}
                                </ul>
                              `}
                            </div>

                            <button type="button" onclick="ownerActions.saveShowFinanceNow()" class="w-full py-2 rounded-xl bg-slate-900 text-white font-black text-[11px]">
                              💾 Lưu show này
                            </button>
                          </div>
                        ` : ''}
                      </article>
                    `;
                  }

                  // Thẻ đi show (nhận CTP từ Sếp) — đồng bộ 3 cột nhiệm vụ với tab CTP
                  const ctpIt = state.ctpItems?.[sh.id] || { tasks: {}, extras: [] };
                  const myExtras = getMemberExtrasForShow(sh.id, uid);
                  const rec = ensureOwnerFinRecord(sh);
                  const myMeta = rec.crewMemberMeta?.[uid] || { ctpStatus: 'unpaid', selfExpense: 0, selfExpenseNote: '' };

                  return `
                    <article id="debt-show-card-${escapeHtml(sh.id)}" class="bg-white border ${isSettled ? 'border-emerald-200/90' : 'border-slate-200/90 hover:border-slate-300'} rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs space-y-2.5 min-w-0 transition-colors">
                      <div class="flex items-start justify-between gap-2 -mx-1 -mt-1 sm:-mx-1.5 sm:-mt-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl bg-[#f8fafc] border-b border-slate-200/70">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                            <span class="font-mono font-bold text-indigo-600 tabular-nums shrink-0">${dateLabel}</span>
                            <span>•</span>
                            <span class="font-semibold text-slate-600 tabular-nums shrink-0">${days}n</span>
                            <span>•</span>
                            <span class="truncate">Sếp: <b class="text-slate-800">${escapeHtml(owner.name)}</b></span>
                          </div>
                          <h4 class="font-black text-slate-900 text-sm mt-1 truncate" title="${escapeHtml(displayLocation)}${partnerText ? ` (${escapeHtml(partnerText)})` : ''}">
                            ${escapeHtml(displayLocation)}${partnerText ? ` <span class="text-slate-500 font-semibold text-xs">(${escapeHtml(partnerText)})</span>` : ''}
                          </h4>
                        </div>
                        <div class="text-right shrink-0">
                          <span class="text-[9px] font-black uppercase tracking-wider block ${isSettled ? 'text-emerald-700' : 'text-amber-700'}">
                            ${isSettled ? 'ĐÃ NHẬN CTP' : 'THỰC NHẬN'}
                          </span>
                          <span class="text-[15px] font-black font-mono tabular-nums text-slate-950">
                            ${fmtMoney(cm.netPocket)}
                          </span>
                        </div>
                      </div>

                      <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                          <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nhiệm vụ CTP</span>
                          <span class="font-mono font-bold tabular-nums text-[10.5px] text-slate-500">${Number(cm.grossCtp || 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div class="grid grid-cols-3 gap-1">
                          ${taskDefs.map(t => {
                            const checked = ctpIt.tasks?.[t.key] !== undefined && ctpIt.tasks?.[t.key] !== null;
                            const val = checked ? ctpIt.tasks[t.key] : getDefaultRateForTask(t.key, sh);
                            return `
                              <div class="h-6 rounded-md border px-1 flex items-center justify-between gap-0.5 transition min-w-0 ${
                                checked
                                  ? 'bg-slate-100 border-slate-300/90 text-slate-900'
                                  : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/75 text-slate-600'
                              }">
                                <button
                                  type="button"
                                  onclick="ownerActions.toggleSyncedCtpTask('${sh.id}', '${t.key}')"
                                  class="text-left text-[9.5px] sm:text-[10px] truncate ${checked ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}"
                                >${t.label}</button>
                                ${checked ? `
                                  <input
                                    type="tel"
                                    inputmode="numeric"
                                    value="${Number(val).toLocaleString('vi-VN')}"
                                    oninput="ownerActions.handleSyncedCtpTaskInput('${sh.id}', '${t.key}', this)"
                                    class="flex-1 min-w-[34px] bg-transparent text-right font-mono font-extrabold tabular-nums text-[8.5px] sm:text-[9.5px] tracking-tighter text-slate-900 focus:outline-none"
                                  />
                                ` : ''}
                              </div>
                            `;
                          }).join('')}
                        </div>
                      </div>

                      ${myExtras.length > 0 ? `
                        <div class="text-[10.5px] text-emerald-700 font-bold bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-2.5 py-1.5">
                          + Phát sinh ứng trước: <span class="font-mono font-black">${myExtras.reduce((s, e) => s + (Number(e.amount) || 0), 0).toLocaleString('vi-VN')}đ</span>
                        </div>
                      ` : ''}

                      <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-1.5">
                        <div class="px-2 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
                          <label class="text-[8.5px] font-black text-slate-400 uppercase block">Tự túc chi</label>
                          <input
                            type="tel"
                            inputmode="numeric"
                            value="${myMeta.selfExpense ? Number(myMeta.selfExpense).toLocaleString('vi-VN') : ''}"
                            oninput="ownerActions.handleCrewSelfExpenseInput('${sh.id}', this)"
                            placeholder="0"
                            class="w-full bg-transparent font-mono font-black text-[11px] text-rose-600 focus:outline-none"
                          />
                        </div>
                        <div class="px-2 py-1 rounded-xl bg-slate-50 border border-slate-200/80">
                          <label class="text-[8.5px] font-black text-slate-400 uppercase block">Ghi chú tự túc</label>
                          <input
                            type="text"
                            value="${escapeHtml(myMeta.selfExpenseNote || '')}"
                            oninput="ownerActions.handleCrewNoteInput('${sh.id}', this.value)"
                            placeholder="Xăng, ăn uống..."
                            class="w-full bg-transparent font-semibold text-[11px] text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div class="flex items-center justify-between gap-2 pt-0.5">
                        <button
                          type="button"
                          onclick="ownerActions.setCrewCtpStatus('${sh.id}', '${isSettled ? 'unpaid' : 'settled'}')"
                          class="px-3 py-1.5 rounded-xl text-[10.5px] font-extrabold transition ${
                            isSettled
                              ? 'bg-emerald-600 text-white'
                              : 'bg-amber-100 text-amber-900 hover:bg-amber-200'
                          }"
                        >${isSettled ? '✓ Sếp đã chuyển CTP' : '⏳ Chưa nhận CTP'}</button>
                        <button
                          type="button"
                          onclick="ownerActions.saveShowFinanceNow()"
                          class="px-2.5 py-1.5 rounded-xl bg-slate-900 text-white text-[10px] font-black"
                        >💾 Lưu</button>
                      </div>
                    </article>
                  `;
                }).join('')}
              </div>
            `}
          </div>
        </div>
      </div>

      <div class="lg:hidden p-3 bg-[#f8fafc] border-t border-slate-200/90 shrink-0 flex items-center gap-2">
        <button type="button" onclick="ownerActions.exportOwnerExcel()" class="px-3.5 py-3.5 rounded-2xl bg-white border border-slate-300 text-slate-800 font-black text-xs">📊 XLS</button>
        <button type="button" onclick="ownerActions.saveShowFinanceNow()" class="flex-1 bg-slate-900 text-white font-black py-3.5 rounded-2xl text-xs uppercase">💾 LƯU & ĐỒNG BỘ CÔNG NỢ</button>
      </div>
    </div>
  `;
}
