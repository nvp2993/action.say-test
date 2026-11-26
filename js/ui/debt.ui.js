import { state } from '../state/store.js';
import { OWNER_STATUS_OPTIONS, CREW_CTP_STATUS_OPTIONS } from '../config/constants.js';
import { escapeHtml, getShowDays, getMember, formatCompactMoneyPlain } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import { calculateOwnerShowMetrics, calculateCrewShowMetrics, getDefaultRateForTask, getMemberExtrasForShow } from '../services/finance.service.js';
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
  const collapsedMap = state.ownerCollapsedShowIds || {};
  if (collapsedMap && typeof collapsedMap === 'object' && collapsedMap[showId]) {
    return false;
  }
  return true;
}

function getNextOption(options, currentId) {
  if (!Array.isArray(options) || options.length === 0) return null;
  const idx = options.findIndex(o => o.id === currentId);
  return options[(idx + 1) % options.length];
}

function formatCompactStatusLabel(label) {
  return String(label || '')
    .replace(/^⏳\s*/, '')
    .replace(/^✅\s*/, '')
    .replace(/Chủ Show trả/gi, 'Trả')
    .replace(/Chủ Show/gi, 'Sếp')
    .trim();
}

export function renderDebtTabHtml() {
  const uid = state.currentUserId;
  const curMem = getMember(uid);

  const allInvolved = (state.shows || []).filter(sh => {
    if (!sh || sh.isCancelled || !sh.startDate) return false;
    if (sh.ownerId !== uid && !(sh.memberIds || []).includes(uid)) return false;
    const [y, m] = sh.startDate.split('-').map(Number);
    if (y !== state.selectedYear) return false;
    if (!state.ownerAllMonths && m !== state.ownerMonth) return false;
    return true;
  }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  let ownerPriceSum = 0, ownerExpSum = 0, ownerProfitSum = 0, ownerUnpaidSum = 0;
  let crewBillSum = 0, crewExtraExpSum = 0, crewPocketSum = 0, crewUnpaidSum = 0;
  let settledNetSum = 0, settledClientPaidSum = 0, settledCrewPaidSum = 0, settledCount = 0;
  let unsettledClientDebtSum = 0, unsettledCrewDebtSum = 0, unsettledCount = 0;
  let cOwner = 0, cCrew = 0;

  allInvolved.forEach(sh => {
    const isOwner = sh.ownerId === uid;
    if (isOwner) cOwner++;
    else cCrew++;

    if (!shouldCountShowMoney(sh)) return;

    if (isOwner) {
      const m = calculateOwnerShowMetrics(sh);
      const isSettled = m.rec.status === 'settled';
      ownerPriceSum += m.clientPrice;
      ownerExpSum += m.totalExpense;
      ownerProfitSum += m.netProfit;
      ownerUnpaidSum += m.remainingClientDebt;

      if (isSettled) {
        settledCount++;
        settledNetSum += m.netProfit;
        settledClientPaidSum += m.clientPrice;
      } else {
        unsettledCount++;
        unsettledClientDebtSum += m.remainingClientDebt;
      }
    } else {
      const cm = calculateCrewShowMetrics(sh);
      const isSettled = cm.isSettled;
      crewBillSum += cm.grossCtp;
      crewExtraExpSum += cm.extraBillSum;
      crewPocketSum += cm.netPocket;
      crewUnpaidSum += cm.pendingCtpDebt;

      if (isSettled) {
        settledCount++;
        settledNetSum += cm.netPocket;
        settledCrewPaidSum += cm.grossCtp;
      } else {
        unsettledCount++;
        unsettledCrewDebtSum += cm.pendingCtpDebt;
      }
    }
  });

  const filterMode = state.ownerFilterStatus || 'all';
  const totalIncomeAll = ownerProfitSum + crewPocketSum;
  const totalUncollectedToWallet = unsettledClientDebtSum + unsettledCrewDebtSum;
  const hide = Boolean(state.hideMoneyMode);
  const fmtMoney = (n) => (hide ? '••••••đ' : `${Number(n || 0).toLocaleString('vi-VN')}đ`);
  const fmtCompact = (n) => (hide ? '••••đ' : formatCompactMoneyPlain(n));

  let statCards = [];
  if (filterMode === 'role_owner') {
    statCards = [
      { label: 'DOANH THU KHÁCH', val: fmtMoney(ownerPriceSum), wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-amber-300' },
      { label: 'TỔNG CHI PHÍ', val: fmtMoney(ownerExpSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-rose-600' },
      { label: 'LÃI RÒNG CHỦ SHOW', val: `${ownerProfitSum >= 0 ? '+' : ''}${fmtMoney(ownerProfitSum)}`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-emerald-700' },
      { label: 'KHÁCH CÒN NỢ', val: fmtMoney(ownerUnpaidSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-amber-700' }
    ];
  } else if (filterMode === 'role_crew') {
    statCards = [
      { label: 'TỔNG BILL CTP', val: fmtMoney(crewBillSum), wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-amber-300' },
      { label: 'CHI PHÍ PHÁT SINH', val: fmtMoney(crewExtraExpSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-indigo-700' },
      { label: 'THỰC NHẬN VỀ', val: `${crewPocketSum >= 0 ? '+' : ''}${fmtMoney(crewPocketSum)}`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-emerald-700' },
      { label: 'CTP CHƯA NHẬN', val: fmtMoney(crewUnpaidSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-amber-700' }
    ];
  } else if (filterMode === 'settled') {
    statCards = [
      { label: 'ĐÃ NHẬN (RÒNG)', val: `${settledNetSum >= 0 ? '+' : ''}${fmtMoney(settledNetSum)}`, wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-emerald-400' },
      { label: 'ĐÃ THU KHÁCH', val: fmtMoney(settledClientPaidSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-slate-900' },
      { label: 'ĐÃ NHẬN CTP', val: fmtMoney(settledCrewPaidSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-indigo-700' },
      { label: 'SHOW HOÀN TẤT', val: `${settledCount} show`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-slate-800' }
    ];
  } else if (filterMode === 'unsettled') {
    statCards = [
      { label: 'TỔNG CÔNG NỢ', val: fmtMoney(totalUncollectedToWallet), wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-rose-400' },
      { label: 'NỢ KHÁCH HÀNG', val: fmtMoney(unsettledClientDebtSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-amber-700' },
      { label: 'NỢ CTP', val: fmtMoney(unsettledCrewDebtSum), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-indigo-700' },
      { label: 'SHOW CHƯA XONG', val: `${unsettledCount} show`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-amber-700' }
    ];
  } else {
    statCards = [
      { label: 'TỔNG THU NHẬP', val: `${totalIncomeAll >= 0 ? '+' : ''}${fmtMoney(totalIncomeAll)}`, wrapCls: 'bg-slate-900 border-slate-900 text-white', labelCls: 'text-slate-300', valCls: 'text-amber-300' },
      { label: 'LÃI NHẬN KHÁCH', val: `${ownerProfitSum >= 0 ? '+' : ''}${fmtMoney(ownerProfitSum)}`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-slate-900' },
      { label: 'CTP ĐI LÀM', val: `${crewPocketSum >= 0 ? '+' : ''}${fmtMoney(crewPocketSum)}`, wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-indigo-700' },
      { label: 'CHƯA THU VỀ VÍ', val: fmtMoney(totalUncollectedToWallet), wrapCls: 'bg-white border-slate-200/90 text-slate-900', labelCls: 'text-slate-400', valCls: 'text-rose-600' }
    ];
  }

  const filtered = allInvolved.filter(sh => {
    const isOwner = sh.ownerId === uid;
    const settled = isOwner ? calculateOwnerShowMetrics(sh).rec.status === 'settled' : calculateCrewShowMetrics(sh).isSettled;
    if (filterMode === 'role_owner') return isOwner;
    if (filterMode === 'role_crew') return !isOwner;
    if (filterMode === 'unsettled') return !settled;
    if (filterMode === 'settled') return settled;
    return true;
  });

  const periodExpenses = [];
  filtered.forEach(sh => {
    if (!shouldCountShowMoney(sh)) return;
    const isOwner = sh.ownerId === uid;
    const loc = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
    if (isOwner) {
      const m = calculateOwnerShowMetrics(sh);
      const list = Array.isArray(m.allShowExp) ? m.allShowExp : (m.rec.otherExpenses || []);
      list.forEach(ex => {
        const amt = Number(ex?.amount) || 0;
        if (amt > 0 || String(ex?.name || '').trim()) {
          periodExpenses.push({
            showId: sh.id,
            showLoc: loc,
            name: ex.name || 'Chi phí phát sinh',
            amount: amt,
            payerName: ex.payerId ? getMember(ex.payerId).name : ''
          });
        }
      });
    } else {
      const cm = calculateCrewShowMetrics(sh);
      (cm.ctpItem?.extras || []).forEach(ex => {
        const amt = Number(ex?.amount) || 0;
        if (amt > 0 || String(ex?.name || '').trim()) {
          periodExpenses.push({
            showId: sh.id,
            showLoc: loc,
            name: ex.name || 'Phát sinh CTP',
            amount: amt,
            payerName: curMem.name
          });
        }
      });
    }
  });
  const periodExpTotal = periodExpenses.reduce((s, r) => s + r.amount, 0);

  const pendingDebts = [];
  filtered.forEach(sh => {
    if (!shouldCountShowMoney(sh)) return;
    const isOwner = sh.ownerId === uid;
    const loc = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
    const days = Math.max(1, Number(getShowDays(sh) || 1));
    const dateLabel = formatShowDateRange(sh, days);
    if (isOwner) {
      const m = calculateOwnerShowMetrics(sh);
      if (m.rec.status !== 'settled' && m.remainingClientDebt > 0) {
        pendingDebts.push({
          showId: sh.id,
          loc,
          dateLabel,
          roleLabel: sh.partner ? `Khách: ${sh.partner}` : 'Khách chưa thanh toán',
          amount: m.remainingClientDebt,
          badgeText: `Nợ ${fmtCompact(m.remainingClientDebt)}`,
          badgeCls: 'text-rose-600'
        });
      }
    } else {
      const cm = calculateCrewShowMetrics(sh);
      if (!cm.isSettled && cm.pendingCtpDebt > 0) {
        pendingDebts.push({
          showId: sh.id,
          loc,
          dateLabel,
          roleLabel: `Sếp: ${getMember(sh.ownerId).name}`,
          amount: cm.pendingCtpDebt,
          badgeText: `Chờ ${fmtCompact(cm.pendingCtpDebt)}`,
          badgeCls: 'text-amber-700'
        });
      }
    }
  });

  const taskKeys = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'];
  const taskLabels = { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Làm hình', flycam: 'Flycam', gimbal: 'Gimbal' };

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      <div class="bg-[#f8fafc] px-3 py-2.5 border-b border-slate-200/90 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase tracking-tight truncate">👑 CÔNG NỢ: ${escapeHtml(curMem.name)}</span>
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="appActions.toggleHideMoneyMode()" class="px-2.5 py-1 rounded-full bg-slate-200/70 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700 transition">
              ${hide ? '👁️ Hiện tiền' : '🙈 Ẩn tiền'}
            </button>
            <button type="button" onclick="ownerActions.openClientDebtBill()" class="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold transition">📤 Gửi Công Nợ</button>
            <button type="button" onclick="ownerActions.exportOwnerExcel()" class="px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-extrabold transition">.XLSX</button>
          </div>
        </div>
        <div class="as-ios-seg-bar">
          ${[
            { id: 'all', label: `ALL (${allInvolved.length})` },
            { id: 'role_owner', label: `Chủ (${cOwner})` },
            { id: 'role_crew', label: `CTP (${cCrew})` },
            { id: 'unsettled', label: 'Chưa thu' },
            { id: 'settled', label: 'Đã xong' }
          ].map(f => `<button type="button" onclick="ownerActions.setFilterStatus('${f.id}')" class="as-ios-seg-item ${filterMode === f.id ? 'active' : ''}">${f.label}</button>`).join('')}
        </div>
        ${renderUnifiedDateBarHtml('owner')}
      </div>

      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[336px_minmax(0,1fr)]">
        <aside class="hidden lg:flex flex-col gap-3 p-3.5 bg-[#f8fafc] border-r border-slate-200/90 overflow-y-auto custom-scroll">
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Cần thu / Chờ nhận (${pendingDebts.length})</span>
              <span class="font-mono font-black tabular-nums text-[10.5px] text-rose-600">${fmtMoney(pendingDebts.reduce((s, x) => s + x.amount, 0))}</span>
            </div>
            <div class="space-y-1.5 max-h-56 overflow-y-auto custom-scroll pr-0.5">
              ${pendingDebts.length === 0 ? `
                <div class="text-[11px] text-emerald-700 font-semibold py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200/70 text-center">
                  ✓ Không còn khoản nợ tồn đọng trong kỳ
                </div>
              ` : pendingDebts.map(item => `
                <button
                  type="button"
                  onclick="ownerActions.focusShow('${escapeHtml(item.showId)}')"
                  class="w-full text-left px-2.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-slate-100/80 border border-slate-200/80 transition space-y-0.5"
                >
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <span class="font-extrabold text-slate-900 truncate">${escapeHtml(item.loc || 'Show')}</span>
                    <span class="font-mono tabular-nums text-[9.5px] text-indigo-600 font-bold shrink-0">${escapeHtml(item.dateLabel)}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2 text-[10px]">
                    <span class="text-slate-500 truncate">${escapeHtml(item.roleLabel)}</span>
                    <span class="font-mono font-black tabular-nums shrink-0 ${item.badgeCls}">${item.badgeText}</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Phát sinh trong kỳ (${periodExpenses.length})</span>
              <span class="font-mono font-black tabular-nums text-[10.5px] text-rose-600">${fmtMoney(periodExpTotal)}</span>
            </div>
            <div class="space-y-1.5 max-h-56 overflow-y-auto custom-scroll pr-0.5">
              ${periodExpenses.length === 0 ? `
                <div class="text-[11px] text-slate-400 py-2.5 text-center">• Không có phát sinh trong kỳ</div>
              ` : periodExpenses.map(row => `
                <button
                  type="button"
                  onclick="ownerActions.focusShow('${escapeHtml(row.showId)}')"
                  class="w-full text-left px-2.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-slate-100/80 border border-slate-200/80 transition space-y-0.5"
                >
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <span class="font-bold text-slate-800 truncate">• ${escapeHtml(row.name)}</span>
                    <span class="font-mono font-black tabular-nums text-rose-600 shrink-0">${hide ? '••••đ' : `${row.amount.toLocaleString('vi-VN')}đ`}</span>
                  </div>
                  <div class="text-[9.5px] text-slate-500 truncate">
                    ${escapeHtml(row.showLoc || '')}${row.payerName ? ` • ${escapeHtml(row.payerName)}` : ''}
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        </aside>

        <div id="owner-debt-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 sm:p-4">
          <div class="max-w-6xl mx-auto space-y-3">
            <div onclick="appActions.toggleHideMoneyMode()" class="sticky top-0 z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f1f5f9] -mx-3 sm:-mx-4 px-3 sm:px-4 pt-1 pb-2 border-b border-slate-200/70 cursor-pointer">
              ${statCards.map(c => `
                <div class="px-3.5 py-2 rounded-2xl border shadow-2xs transition ${c.wrapCls}">
                  <span class="text-[9px] font-extrabold uppercase tracking-wider block truncate ${c.labelCls}">${c.label}</span>
                  <span class="font-black font-mono tabular-nums text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
                </div>
              `).join('')}
            </div>

            ${filtered.length === 0 ? `
              <div class="text-center py-12 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-3 p-4">
                <div class="text-3xl">📭</div>
                <div class="text-slate-800 font-bold text-xs">Chưa có show nào trong danh mục lọc này (${unsettledCount} show chờ xử lý)</div>
                <div class="flex items-center justify-center gap-2">
                  <button type="button" onclick="appActions.openAddModal()" class="px-4 py-2 rounded-full bg-slate-950 text-white font-extrabold text-xs">⚡ Nổ Show Lịch Chung</button>
                  <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="px-4 py-2 rounded-full bg-white text-slate-800 border border-slate-300 font-extrabold text-xs">Note Show Ngoài</button>
                </div>
              </div>
            ` : `
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch">
                ${filtered.map((sh) => {
                  const isOwner = sh.ownerId === uid;
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

                  if (isOwner) {
                    const m = calculateOwnerShowMetrics(sh);
                    const stObj = OWNER_STATUS_OPTIONS.find(o => o.id === m.rec.status) || OWNER_STATUS_OPTIONS[0];
                    const nextSt = getNextOption(OWNER_STATUS_OPTIONS, m.rec.status);
                    const crewMembers = (sh.memberIds || []).filter(mid => mid !== sh.ownerId);
                    const missingClient = Math.max(0, m.clientPrice - m.depositPaid);
                    const allExpList = Array.isArray(m.allShowExp) ? m.allShowExp : (m.rec.otherExpenses || []);
                    const otherExpSum = allExpList.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

                    return `
                      <article id="debt-show-card-${escapeHtml(sh.id)}" ${holdCardStyle} class="${holdCardCls} flex flex-col justify-between min-w-0">
                        <div class="space-y-3">
                          <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2.5 min-h-[54px] -mx-1.5 -mt-1.5 px-3 py-2.5 rounded-2xl cursor-pointer ${sh.isHold ? 'bg-white/65 border-b border-amber-200/80' : 'bg-[#f8fafc] border-b border-slate-200/70'}">
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500 whitespace-nowrap overflow-hidden">
                                <span class="font-mono font-bold text-indigo-600 tabular-nums shrink-0">${dateLabel}</span>
                                <span>•</span>
                                <span class="font-semibold text-slate-600 tabular-nums shrink-0">${days}n</span>
                                <span>•</span>
                                <span class="font-bold text-slate-800 truncate">Chủ show</span>
                              </div>
                              <h4 class="font-black text-slate-900 text-sm mt-1 truncate" title="${escapeHtml(displayLocation)}${partnerText ? ` (${escapeHtml(partnerText)})` : ''}">
                                ${escapeHtml(displayLocation)}${partnerText ? ` <span class="text-slate-500 font-semibold text-xs">(${escapeHtml(partnerText)})</span>` : ''}
                              </h4>
                            </div>
                            <div class="text-right shrink-0">
                              ${isCounted ? `
                                <span class="text-[10px] font-mono tabular-nums text-slate-500 block">Thu ${fmtCompact(m.clientPrice)} • Chi ${fmtCompact(m.totalExpense)}</span>
                                <span class="text-[15px] font-mono font-black tabular-nums tracking-tight text-emerald-700 block">Lãi ${m.netProfit >= 0 ? '+' : ''}${fmtCompact(m.netProfit)}</span>
                              ` : `
                                <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tạm giữ</span>
                                <span class="text-[15px] font-mono font-black tabular-nums text-slate-400 block">0đ</span>
                              `}
                            </div>
                          </div>

                          ${holdBillingBarHtml}

                          ${expanded ? `
                            <div class="space-y-3">
                              <div class="flex items-center justify-between gap-2">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Thanh lý khách</span>
                                <button
                                  type="button"
                                  onclick="ownerActions.setStatus('${sh.id}', '${nextSt ? nextSt.id : stObj.id}')"
                                  title="Bấm để đổi trạng thái"
                                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-[10.5px] font-bold text-slate-800 shrink-0 transition"
                                >${escapeHtml(formatCompactStatusLabel(stObj.label))} ↻</button>
                              </div>

                              <div class="grid grid-cols-1 gap-2">
                                <div class="min-w-0">
                                  <label class="block text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Giá báo khách hàng (VNĐ)</label>
                                  <input type="tel" inputmode="numeric" value="${m.clientPrice ? m.clientPrice.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'clientPrice', this)" placeholder="Nhập giá báo khách..." class="w-full min-w-0 px-3 py-1.5 bg-[#f8fafc] border border-slate-200/90 rounded-xl font-mono font-black tabular-nums text-slate-900 text-right text-xs focus:outline-none focus:border-slate-900 focus:bg-white" />
                                </div>
                                <div class="min-w-0">
                                  <div class="flex items-center justify-between flex-wrap gap-1 mb-1">
                                    <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Khách đã cọc / đã trả</label>
                                    ${missingClient > 0 ? `<span class="font-mono tabular-nums text-[10px] font-bold text-rose-600">Thiếu: ${missingClient.toLocaleString('vi-VN')}đ</span>` : ''}
                                  </div>
                                  <input type="tel" inputmode="numeric" value="${m.depositPaid ? m.depositPaid.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'depositPaid', this)" placeholder="Số tiền khách đã chuyển..." class="w-full min-w-0 px-3 py-1.5 bg-[#f8fafc] border border-slate-200/90 rounded-xl font-mono font-black tabular-nums text-right text-xs text-emerald-700 focus:outline-none focus:border-slate-900 focus:bg-white" />
                                </div>
                              </div>

                              <div class="space-y-2">
                                <div class="flex items-center justify-between gap-2">
                                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dự kiến chi CTP (${crewMembers.length})</span>
                                  <span class="text-[10px] font-semibold text-slate-400">Chạm để chọn</span>
                                </div>
                                ${crewMembers.length === 0 ? `
                                  <div class="text-[11px] text-slate-400 py-0.5">• Không có nhân sự CTP đi cùng</div>
                                ` : crewMembers.map(mid => {
                                  const mem = getMember(mid);
                                  const memCost = Number(m.rec.crewCosts?.[mid]) || 0;
                                  const memTasks = m.rec.crewTasks?.[mid] || {};
                                  const roleHint = (sh.roles?.[mid] || []).join(' • ');
                                  return `
                                    <div class="p-2.5 rounded-2xl bg-[#f8fafc] border border-slate-200/80 space-y-1.5">
                                      <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                                          <span class="font-black text-slate-900 text-[11.5px] truncate">${escapeHtml(mem.name)}</span>
                                          ${roleHint ? `<span class="text-[9.5px] font-semibold text-slate-500 truncate">• ${escapeHtml(roleHint)}</span>` : ''}
                                        </div>
                                        <span class="font-mono font-black tabular-nums text-[11px] text-slate-900 shrink-0">${memCost.toLocaleString('vi-VN')}đ</span>
                                      </div>

                                      <div class="grid grid-cols-2 gap-1.5">
                                        ${taskKeys.map(tk => {
                                          const active = memTasks[tk] !== undefined && memTasks[tk] !== null;
                                          const tVal = active ? memTasks[tk] : getDefaultRateForTask(tk, sh);
                                          return `
                                            <div class="h-7 rounded-lg border px-2 flex items-center justify-between gap-1 transition min-w-0 ${
                                              active
                                                ? 'bg-slate-100 border-slate-300/90 text-slate-900'
                                                : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/75 text-slate-600'
                                            }">
                                              <button type="button" onclick="ownerActions.toggleOwnerCrewTask('${sh.id}', '${mid}', '${tk}')" class="text-left text-[10.5px] truncate ${active ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}">
                                                ${taskLabels[tk]}
                                              </button>
                                              ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ownerActions.handleOwnerCrewTaskInput('${sh.id}', '${mid}', '${tk}', this)" class="w-16 min-w-0 bg-transparent text-right font-mono font-extrabold tabular-nums text-[10.5px] text-slate-900 focus:outline-none" />` : ''}
                                            </div>
                                          `;
                                        }).join('')}
                                      </div>
                                    </div>
                                  `;
                                }).join('')}
                              </div>

                              <div class="space-y-1.5">
                                <div class="flex items-center justify-between gap-2">
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Chi phí khác</span>
                                    ${allExpList.length > 0 ? `
                                      <span id="debt-show-other-sum-${sh.id}" class="font-mono font-black tabular-nums text-[10.5px] text-rose-600">
                                        ${otherExpSum.toLocaleString('vi-VN')}đ
                                      </span>
                                    ` : ''}
                                  </div>
                                  <button type="button" onclick="ownerActions.addOwnerExpense('${sh.id}')" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold transition">+ Thêm chi</button>
                                </div>

                                ${allExpList.length === 0 ? `
                                  <div class="text-[11px] text-slate-400 py-0.5">• Không có chi phí khác</div>
                                ` : `
                                  <ul class="divide-y divide-slate-100">
                                    ${allExpList.map((ex, exIdx) => {
                                      const payerName = ex.payerId && ex.payerId !== sh.ownerId ? getMember(ex.payerId).name : '';
                                      const rowKey = `${sh.id}_${ex.id || exIdx}`;
                                      const isEditingRow = state.ownerEditingExpenseKey === rowKey;
                                      if (isEditingRow) {
                                        return `
                                          <li class="py-1.5 space-y-1.5">
                                            <div class="flex items-center gap-1.5">
                                              <span class="text-slate-400 font-black select-none">•</span>
                                              <input
                                                id="debt-exp-name-${escapeHtml(rowKey)}"
                                                type="text"
                                                value="${escapeHtml(ex.name || '')}"
                                                oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                                onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                                placeholder="Tên khoản chi..."
                                                class="flex-1 min-w-0 px-2.5 py-1 bg-[#f8fafc] border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                              />
                                            </div>
                                            <div class="flex items-center justify-end gap-1">
                                              <input
                                                type="tel"
                                                inputmode="numeric"
                                                value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}"
                                                oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                                onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                                placeholder="Số tiền"
                                                class="w-24 px-2 py-1 bg-[#f8fafc] border border-slate-300 rounded-lg text-[11px] font-mono font-black tabular-nums text-rose-600 text-right focus:outline-none focus:border-slate-900"
                                              />
                                              <button
                                                type="button"
                                                onclick="ownerActions.finishEditOwnerExpense()"
                                                class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] transition"
                                              >Xong</button>
                                              <button
                                                type="button"
                                                onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
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
                                            <span class="font-semibold text-slate-800 truncate">${escapeHtml(ex.name || 'Khoản chi phí')}</span>
                                            ${payerName ? `<span class="text-[9.5px] text-slate-500 shrink-0">(${escapeHtml(payerName)})</span>` : ''}
                                            <span class="text-slate-300 shrink-0">—</span>
                                            <span class="font-mono font-extrabold tabular-nums text-rose-600 shrink-0">${Number(ex.amount || 0).toLocaleString('vi-VN')}đ</span>
                                          </div>
                                          <div class="flex items-center gap-0.5 shrink-0">
                                            <button
                                              type="button"
                                              onclick="ownerActions.startEditOwnerExpense('${escapeHtml(rowKey)}')"
                                              class="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                                            >Sửa</button>
                                            <button
                                              type="button"
                                              onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
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
                                <span class="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider block">Tổng chi</span>
                                <span id="debt-show-total-exp-${sh.id}" class="font-black text-rose-600">${m.totalExpense.toLocaleString('vi-VN')}đ</span>
                              </div>
                              <div class="text-right">
                                <span class="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider block">Lãi chủ show</span>
                                <span id="debt-show-net-profit-${sh.id}" class="text-[14px] font-black text-emerald-700">${m.netProfit >= 0 ? '+' : ''}${m.netProfit.toLocaleString('vi-VN')}đ</span>
                              </div>
                            </div>

                            <div class="flex items-center gap-1.5">
                              <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="px-2.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-[11px] transition">Thu gọn ▲</button>
                              <button type="button" onclick="ownerActions.saveShowFinanceNow('${sh.id}')" class="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[11px] transition">💾 LƯU SHOW</button>
                            </div>
                          </div>
                        ` : `
                          <div class="pt-2 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} flex items-center justify-between text-[11px]">
                            <span class="text-slate-400 font-semibold">Đã thu gọn</span>
                            <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="font-bold text-slate-700 hover:text-slate-950">Mở rộng ▼</button>
                          </div>
                        `}
                      </article>
                    `;
                  } else {
                    const cm = calculateCrewShowMetrics(sh);
                    const stObj = CREW_CTP_STATUS_OPTIONS.find(o => o.id === cm.meta.ctpStatus) || CREW_CTP_STATUS_OPTIONS[0];
                    const nextSt = getNextOption(CREW_CTP_STATUS_OPTIONS, cm.meta.ctpStatus);
                    const owner = getMember(sh.ownerId);
                    const linkedTasks = state.ctpItems?.[sh.id]?.tasks || {};
                    const myExtras = getMemberExtrasForShow(sh.id, uid);
                    const myExtrasSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

                    return `
                      <article id="debt-show-card-${escapeHtml(sh.id)}" ${holdCardStyle} class="${holdCardCls} flex flex-col justify-between min-w-0">
                        <div class="space-y-3">
                          <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2.5 min-h-[54px] -mx-1.5 -mt-1.5 px-3 py-2.5 rounded-2xl cursor-pointer ${sh.isHold ? 'bg-white/65 border-b border-amber-200/80' : 'bg-[#f8fafc] border-b border-slate-200/70'}">
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-1.5 text-[10.5px] text-slate-500 whitespace-nowrap overflow-hidden">
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
                              ${isCounted ? `
                                <span class="text-[10px] font-mono tabular-nums text-slate-500 block">Công ${fmtCompact(cm.taskSum)}${cm.extraBillSum > 0 ? ` • PS +${fmtCompact(cm.extraBillSum)}` : ''}</span>
                                <span class="text-[15px] font-mono font-black tabular-nums tracking-tight text-slate-950 block">${fmtCompact(cm.grossCtp)}</span>
                              ` : `
                                <span class="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Tạm giữ</span>
                                <span class="text-[15px] font-mono font-black tabular-nums text-slate-400 block">0đ</span>
                              `}
                            </div>
                          </div>

                          ${holdBillingBarHtml}

                          ${expanded ? `
                            <div class="space-y-3">
                              <div class="flex items-center justify-between gap-2">
                                <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider truncate">Sếp ${escapeHtml(owner.name)}</span>
                                <button
                                  type="button"
                                  onclick="ownerActions.setCrewCtpStatus('${sh.id}', '${nextSt ? nextSt.id : stObj.id}')"
                                  title="Bấm để đổi trạng thái"
                                  class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200/80 border border-slate-200/90 text-[10.5px] font-bold text-slate-800 shrink-0 transition"
                                >${escapeHtml(formatCompactStatusLabel(stObj.label))} ↻</button>
                              </div>

                              <div class="space-y-1.5">
                                <div class="flex items-center justify-between gap-2">
                                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nhiệm vụ CTP</span>
                                  <span class="font-mono font-bold tabular-nums text-[10.5px] text-slate-500">${cm.taskSum.toLocaleString('vi-VN')}đ</span>
                                </div>
                                <div class="grid grid-cols-2 gap-1.5">
                                  ${taskKeys.map(tk => {
                                    const active = linkedTasks[tk] !== undefined && linkedTasks[tk] !== null;
                                    const tVal = active ? linkedTasks[tk] : getDefaultRateForTask(tk, sh);
                                    return `
                                      <div class="h-7 rounded-lg border px-2 flex items-center justify-between gap-1 transition min-w-0 ${
                                        active
                                          ? 'bg-slate-100 border-slate-300/90 text-slate-900'
                                          : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/75 text-slate-600'
                                      }">
                                        <button type="button" onclick="ownerActions.toggleSyncedCtpTask('${sh.id}', '${tk}')" class="text-left text-[10.5px] truncate ${active ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}">
                                          ${taskLabels[tk]}
                                        </button>
                                        ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ownerActions.handleSyncedCtpTaskInput('${sh.id}', '${tk}', this)" class="w-16 min-w-0 bg-transparent text-right font-mono font-extrabold tabular-nums text-[10.5px] text-slate-900 focus:outline-none" />` : ''}
                                      </div>
                                    `;
                                  }).join('')}
                                </div>
                              </div>

                              <div class="pt-2.5 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-1.5">
                                <div class="flex items-center justify-between gap-2">
                                  <div class="flex items-center gap-2 min-w-0">
                                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Phát sinh</span>
                                    ${myExtras.length > 0 ? `
                                      <span id="ctp-show-extra-sum-${sh.id}" class="font-mono font-black tabular-nums text-[10.5px] text-emerald-700 shrink-0">
                                        ${myExtrasSum.toLocaleString('vi-VN')}đ
                                      </span>
                                    ` : ''}
                                  </div>
                                  <button type="button" onclick="ctpActions.addExtraItem('${sh.id}')" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold transition shrink-0">+ Thêm phí</button>
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
                                <span class="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider block">Nhiệm vụ + PS</span>
                                <span class="font-black text-slate-900">${cm.taskSum.toLocaleString('vi-VN')}đ + ${cm.extraBillSum.toLocaleString('vi-VN')}đ</span>
                              </div>
                              <div class="text-right">
                                <span class="text-[9px] font-sans font-black text-slate-400 uppercase tracking-wider block">Tổng bill CTP</span>
                                <span class="text-[14px] font-black text-emerald-700">${cm.grossCtp.toLocaleString('vi-VN')}đ</span>
                              </div>
                            </div>

                            <div class="flex items-center gap-1.5">
                              <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="px-2.5 py-2 rounded-xl bg-[#f8fafc] hover:bg-slate-100 border border-slate-200/90 text-slate-700 font-bold text-[11px] transition">Thu gọn ▲</button>
                              <button type="button" onclick="ownerActions.saveShowFinanceNow('${sh.id}')" class="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-[11px] transition">💾 LƯU</button>
                            </div>
                          </div>
                        ` : `
                          <div class="pt-2 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} flex items-center justify-between text-[11px]">
                            <span class="text-slate-400 font-semibold">Đã thu gọn</span>
                            <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="font-bold text-slate-700 hover:text-slate-950">Mở rộng ▼</button>
                          </div>
                        `}
                      </article>
                    `;
                  }
                }).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
}
