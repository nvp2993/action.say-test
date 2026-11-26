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

export function renderDebtTabHtml() {
  const uid = state.currentUserId;
  const curMem = getMember(uid);

  const prevCarryByBoss = new Map();
  let prevCarryCount = 0;
  let prevCarryAmount = 0;

  if (!state.ownerAllMonths && Number(state.ownerMonth) > 1) {
    (state.shows || []).forEach(sh => {
      if (!sh || sh.isCancelled || !sh.startDate) return;
      if (sh.ownerId !== uid && !(sh.memberIds || []).includes(uid)) return;
      const [y, m] = sh.startDate.split('-').map(Number);
      if (y !== state.selectedYear || !(m < Number(state.ownerMonth))) return;
      if (!shouldCountShowMoney(sh)) return;

      const isOwner = sh.ownerId === uid;
      const key = isOwner ? `self_owner:${uid}` : `boss:${sh.ownerId || 'unknown'}`;
      const bossName = isOwner ? `${curMem.name} (Chủ show)` : getMember(sh.ownerId).name;

      let pending = 0;
      let isUnsettled = false;
      if (isOwner) {
        const mObj = calculateOwnerShowMetrics(sh);
        if (mObj.rec.status !== 'settled' && mObj.remainingClientDebt > 0) {
          pending = mObj.remainingClientDebt;
          isUnsettled = true;
        }
      } else {
        const cm = calculateCrewShowMetrics(sh);
        if (!cm.isSettled && cm.pendingCtpDebt > 0) {
          pending = cm.pendingCtpDebt;
          isUnsettled = true;
        }
      }

      if (isUnsettled && pending > 0) {
        prevCarryCount++;
        prevCarryAmount += pending;
        if (!prevCarryByBoss.has(key)) {
          prevCarryByBoss.set(key, { key, name: bossName, isOwner, count: 0, amount: 0 });
        }
        const entry = prevCarryByBoss.get(key);
        entry.count++;
        entry.amount += pending;
      }
    });
  }

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
  const selectedBossKey = state.ownerBossFilterKey || 'all';
  const totalIncomeAll = ownerProfitSum + crewPocketSum;
  const totalUncollectedToWallet = unsettledClientDebtSum + unsettledCrewDebtSum;
  const hide = Boolean(state.hideMoneyMode);
  const fmtMoney = (n) => (hide ? '••••••đ' : `${Number(n || 0).toLocaleString('vi-VN')}đ`);
  const fmtCompact = (n) => (hide ? '••••đ' : formatCompactMoneyPlain(n));

  const bossMap = new Map();
  allInvolved.forEach(sh => {
    const isOwner = sh.ownerId === uid;
    const key = isOwner ? `self_owner:${uid}` : `boss:${sh.ownerId || 'unknown'}`;
    if (!bossMap.has(key)) {
      const carry = prevCarryByBoss.get(key);
      bossMap.set(key, {
        key,
        name: isOwner ? `${curMem.name} (Chủ show)` : getMember(sh.ownerId).name,
        isOwner,
        showCount: 0,
        unsettledCount: 0,
        billOrProfit: 0,
        pendingAmount: 0,
        prevCarryCount: carry ? carry.count : 0,
        prevCarryAmount: carry ? carry.amount : 0
      });
    }
    const g = bossMap.get(key);
    g.showCount++;
    if (!shouldCountShowMoney(sh)) return;

    if (isOwner) {
      const m = calculateOwnerShowMetrics(sh);
      g.billOrProfit += m.netProfit;
      if (m.rec.status !== 'settled') {
        g.unsettledCount++;
        g.pendingAmount += m.remainingClientDebt;
      }
    } else {
      const cm = calculateCrewShowMetrics(sh);
      g.billOrProfit += cm.grossCtp;
      if (!cm.isSettled) {
        g.unsettledCount++;
        g.pendingAmount += cm.pendingCtpDebt;
      }
    }
  });

  prevCarryByBoss.forEach((carry, key) => {
    if (!bossMap.has(key)) {
      bossMap.set(key, {
        key,
        name: carry.name,
        isOwner: carry.isOwner,
        showCount: 0,
        unsettledCount: 0,
        billOrProfit: 0,
        pendingAmount: 0,
        prevCarryCount: carry.count,
        prevCarryAmount: carry.amount
      });
    }
  });

  const bossSummaryList = Array.from(bossMap.values()).sort(
    (a, b) => (b.pendingAmount + b.prevCarryAmount) - (a.pendingAmount + a.prevCarryAmount) || b.showCount - a.showCount
  );
  const carryOnlyBossList = Array.from(prevCarryByBoss.values()).sort((a, b) => b.amount - a.amount);

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
    const bossKey = isOwner ? `self_owner:${uid}` : `boss:${sh.ownerId || 'unknown'}`;
    if (selectedBossKey !== 'all' && bossKey !== selectedBossKey) return false;
    const settled = isOwner ? calculateOwnerShowMetrics(sh).rec.status === 'settled' : calculateCrewShowMetrics(sh).isSettled;
    if (filterMode === 'role_owner') return isOwner;
    if (filterMode === 'role_crew') return !isOwner;
    if (filterMode === 'unsettled') return !settled;
    if (filterMode === 'settled') return settled;
    return true;
  });

  const taskKeys = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'];
  const taskLabels = { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Hình', flycam: 'Flycam', gimbal: 'Gimbal' };

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      <div class="bg-[#f8fafc] px-3 py-2.5 border-b border-slate-200/90 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase tracking-tight truncate">👑 CÔNG NỢ: ${escapeHtml(curMem.name)}</span>
          <div class="flex items-center gap-1.5 shrink-0">
  <button type="button" onclick="appActions.toggleHideMoneyMode()" title="${hide ? 'Hiện tiền' : 'Ẩn tiền'}" aria-label="${hide ? 'Hiện tiền' : 'Ẩn tiền'}" class="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-200 text-xs flex items-center justify-center text-slate-700 transition">
    ${hide ? '👁️' : '🙈'}
  </button>
  <button type="button" onclick="ownerActions.openClientDebtBill()" class="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-extrabold transition">📤 Gửi Công Nợ</button>
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
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2 text-[11px]">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Số show kỳ này</span>
              <span class="font-mono font-black text-slate-900">${allInvolved.length} show</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5 pt-0.5">
              <div class="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-slate-200/70 flex items-center justify-between">
                <span class="text-slate-500 font-semibold">Chủ show</span>
                <span class="font-mono font-black text-slate-900">${cOwner}</span>
              </div>
              <div class="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-slate-200/70 flex items-center justify-between">
                <span class="text-slate-500 font-semibold">Đi CTP</span>
                <span class="font-mono font-black text-indigo-700">${cCrew}</span>
              </div>
              <div class="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-slate-200/70 flex items-center justify-between">
                <span class="text-slate-500 font-semibold">Chưa xong</span>
                <span class="font-mono font-black text-amber-700">${unsettledCount}</span>
              </div>
              <div class="px-2.5 py-1.5 rounded-xl bg-[#f8fafc] border border-slate-200/70 flex items-center justify-between">
                <span class="text-slate-500 font-semibold">Đã xong</span>
                <span class="font-mono font-black text-emerald-700">${settledCount}</span>
              </div>
            </div>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2.5">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">ĐỐI CHIẾU THEO CHỦ SHOW</span>
              ${selectedBossKey !== 'all' ? `
                <button type="button" onclick="ownerActions.setBossFilter('all')" class="text-[10px] font-extrabold text-indigo-600 hover:underline">Bỏ lọc</button>
              ` : `
                <span class="font-mono font-bold text-[10px] text-slate-400">${bossSummaryList.length} chủ show</span>
              `}
            </div>

            <div class="space-y-1.5">
              ${bossSummaryList.length === 0 ? `
                <div class="text-[11px] text-slate-400 py-3 text-center">Không có dữ liệu trong kỳ</div>
              ` : bossSummaryList.map(g => {
                const isSelected = selectedBossKey === g.key;
                const combinedPending = g.pendingAmount + g.prevCarryAmount;
                return `
                  <button
                    type="button"
                    onclick="ownerActions.setBossFilter('${escapeHtml(g.key)}')"
                    class="w-full text-left p-2.5 rounded-xl border transition space-y-1 ${
                      isSelected
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-[#f8fafc] hover:bg-slate-100/80 border-slate-200/80 text-slate-900'
                    }"
                  >
                    <div class="flex items-center justify-between gap-2 text-[11px]">
                      <span class="font-black truncate">${escapeHtml(g.name)}</span>
                      <span class="font-mono text-[10px] font-bold shrink-0 ${isSelected ? 'text-slate-300' : 'text-slate-500'}">${g.showCount} show${g.prevCarryCount > 0 ? ` + ${g.prevCarryCount} cũ` : ''}</span>
                    </div>
                    <div class="flex items-center justify-between gap-2 text-[10px]">
                      <span class="${isSelected ? 'text-amber-300' : 'text-slate-600'} font-semibold">
                        ${g.isOwner ? 'Lãi:' : 'Bill:'} <b class="font-mono tabular-nums">${fmtCompact(g.billOrProfit)}</b>
                      </span>
                      <span class="font-mono font-black tabular-nums shrink-0 ${
                        combinedPending > 0
                          ? (isSelected ? 'text-rose-300' : 'text-rose-600')
                          : (isSelected ? 'text-emerald-300' : 'text-emerald-700')
                      }">
                        ${combinedPending > 0 ? `Chờ ${fmtCompact(combinedPending)}` : 'Đã xong ✓'}
                      </span>
                    </div>
                    ${g.prevCarryAmount > 0 ? `
                      <div class="text-[9.5px] font-mono ${isSelected ? 'text-amber-200' : 'text-amber-800'}">
                        ↳ Công nợ Cộng dồn: +${fmtCompact(g.prevCarryAmount)} (${g.prevCarryCount} show)
                      </div>
                    ` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2 text-[11px]">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Công nợ Cộng dồn</span>
              <span class="font-mono font-bold text-[10px] text-slate-400">${state.ownerAllMonths ? `Cả năm ${state.selectedYear}` : `T1–T${Math.max(0, Number(state.ownerMonth) - 1)}`}</span>
            </div>
            ${(() => {
              const displayAmount = state.ownerAllMonths ? totalUncollectedToWallet : prevCarryAmount;
              const displayCount = state.ownerAllMonths ? unsettledCount : prevCarryCount;
              const displayList = state.ownerAllMonths
                ? bossSummaryList
                    .filter(g => g.pendingAmount > 0)
                    .map(g => ({ key: g.key, name: g.name, count: g.unsettledCount, amount: g.pendingAmount }))
                    .sort((a, b) => b.amount - a.amount)
                : carryOnlyBossList;

              if (displayAmount <= 0) {
                return `
                  <div class="text-[11px] text-emerald-700 font-semibold py-2 px-2.5 rounded-xl bg-slate-50 border border-slate-200/70">
                    ✓ ${state.ownerAllMonths ? `Không có công nợ treo trong năm ${state.selectedYear}` : 'Không có công nợ cộng dồn từ tháng trước'}
                  </div>
                `;
              }

              return `
                <div class="space-y-2">
                  <div class="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/90 space-y-1">
                    <div class="flex items-center justify-between">
                      <span class="font-bold text-amber-950">${state.ownerAllMonths ? `Tổng treo cả năm ${state.selectedYear}` : 'Tổng treo từ tháng trước'}</span>
                      <span class="font-mono font-black text-rose-600">${fmtMoney(displayAmount)}</span>
                    </div>
                    <div class="flex items-center justify-between text-[10px] text-amber-800">
                      <span>${displayCount} show chưa hoàn tất</span>
                      ${!state.ownerAllMonths ? `<button type="button" onclick="ownerActions.toggleAllMonths()" class="font-extrabold text-indigo-700 hover:underline">Xem cả năm →</button>` : ''}
                    </div>
                  </div>
                  <div class="space-y-1">
                    ${displayList.map(c => `
                      <button
                        type="button"
                        onclick="ownerActions.setBossFilter('${escapeHtml(c.key)}')"
                        class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#f8fafc] hover:bg-slate-100 border border-slate-200/80 text-[10.5px] transition"
                      >
                        <span class="font-bold text-slate-800 truncate">${escapeHtml(c.name)} <span class="text-slate-400 font-normal">(${c.count} show)</span></span>
                        <span class="font-mono font-black text-rose-600 shrink-0">${fmtCompact(c.amount)}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              `;
            })()}
          </div>
        </aside>

        <div id="owner-debt-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll px-3 sm:px-4 pb-4">
          <div class="max-w-6xl mx-auto space-y-3">
            <div onclick="appActions.toggleHideMoneyMode()" class="sticky top-0 z-20 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f1f5f9] -mx-3 sm:-mx-4 px-3 sm:px-4 pt-3 pb-2.5 border-b border-slate-200/80 cursor-pointer">
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
                              <span class="text-[9px] font-black uppercase tracking-wider text-slate-500 block">${isCounted ? 'TỔNG SHOW' : 'Tạm giữ'}</span>
                              <span class="text-[15px] font-mono font-black tabular-nums tracking-tight ${isCounted ? 'text-emerald-700' : 'text-slate-400'} block">${isCounted ? `${m.netProfit >= 0 ? '+' : ''}${fmtMoney(m.netProfit)}` : '0đ'}</span>
                            </div>
                          </div>

                          ${holdBillingBarHtml}

                          ${expanded ? `
                            <div class="space-y-3">
                              <div class="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-[#f8fafc] border border-slate-200/80">
                                ${OWNER_STATUS_OPTIONS.map(s => `<button type="button" onclick="ownerActions.setStatus('${sh.id}', '${s.id}')" class="py-1 px-1.5 rounded-lg text-[10px] border truncate transition ${getColoredStatusBtnClass(s.id, m.rec.status === s.id)}">${escapeHtml(formatCleanStatusLabel(s.label))}</button>`).join('')}
                              </div>

                              <div class="space-y-1">
                                <div class="grid grid-cols-2 gap-1.5">
                                  <div class="h-8 px-2.5 bg-[#f8fafc] border border-slate-200/90 focus-within:border-slate-900 focus-within:bg-white rounded-xl flex items-center justify-between gap-1.5 min-w-0">
                                    <span class="text-[10px] font-extrabold text-slate-500 shrink-0">Báo giá</span>
                                    <input
                                      type="tel"
                                      inputmode="numeric"
                                      value="${m.clientPrice ? m.clientPrice.toLocaleString('vi-VN') : ''}"
                                      oninput="ownerActions.handleMoneyInput('${sh.id}', 'clientPrice', this)"
                                      placeholder="0"
                                      class="flex-1 min-w-0 bg-transparent font-mono font-black tabular-nums text-slate-900 text-right text-[11.5px] focus:outline-none"
                                    />
                                  </div>
                                  <div class="h-8 px-2.5 bg-[#f8fafc] border border-slate-200/90 focus-within:border-slate-900 focus-within:bg-white rounded-xl flex items-center justify-between gap-1.5 min-w-0">
                                    <span class="text-[10px] font-extrabold text-slate-500 shrink-0">Đã cọc</span>
                                    <input
                                      type="tel"
                                      inputmode="numeric"
                                      value="${m.depositPaid ? m.depositPaid.toLocaleString('vi-VN') : ''}"
                                      oninput="ownerActions.handleMoneyInput('${sh.id}', 'depositPaid', this)"
                                      placeholder="0"
                                      class="flex-1 min-w-0 bg-transparent font-mono font-black tabular-nums text-emerald-700 text-right text-[11.5px] focus:outline-none"
                                    />
                                  </div>
                                </div>
                                ${missingClient > 0 ? `
                                  <div class="flex justify-end px-1">
                                    <span class="font-mono tabular-nums text-[9.5px] font-bold text-rose-600">Khách còn thiếu: ${missingClient.toLocaleString('vi-VN')}đ</span>
                                  </div>
                                ` : ''}
                              </div>

                              <div class="space-y-1.5">
                                <div class="flex items-center justify-between gap-2">
                                  <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Dự kiến chi CTP (${crewMembers.length})</span>
                                  ${crewMembers.length > 0 ? `
                                    <button
                                      type="button"
                                      onclick="ownerActions.toggleAllCrewRowsForShow('${sh.id}', '${crewMembers.join(',')}')"
                                      class="text-[10px] font-extrabold text-indigo-600 hover:underline"
                                    >
                                      ${crewMembers.some(mid => !state.ownerExpandedCrewRows?.[`${sh.id}_${mid}`]) ? 'Mở tất cả' : 'Thu gọn hết'}
                                    </button>
                                  ` : ''}
                                </div>

                                ${crewMembers.length === 0 ? `
                                  <div class="text-[11px] text-slate-400 py-0.5">• Không có nhân sự CTP đi cùng</div>
                                ` : `
                                  <div class="divide-y divide-slate-200/70 rounded-2xl bg-[#f8fafc] border border-slate-200/80 overflow-hidden">
                                    ${crewMembers.map(mid => {
                                      const mem = getMember(mid);
                                      const memCost = Number(m.rec.crewCosts?.[mid]) || 0;
                                      const memTasks = m.rec.crewTasks?.[mid] || {};
                                      const activeTaskSummary = taskKeys
                                        .filter(tk => memTasks[tk] !== undefined && memTasks[tk] !== null)
                                        .map(tk => `${taskLabels[tk]} ${formatCompactMoneyPlain(memTasks[tk])}`)
                                        .join(' • ');
                                      const roleHint = (sh.roles?.[mid] || []).join(', ');
                                      const isCrewOpen = Boolean(state.ownerExpandedCrewRows?.[`${sh.id}_${mid}`]);

                                      return `
                                        <div class="px-2.5 py-1.5 space-y-1.5">
                                          <div
                                            onclick="ownerActions.toggleCrewRowExpand('${sh.id}', '${mid}')"
                                            class="flex items-center justify-between gap-2 cursor-pointer select-none"
                                          >
                                            <div class="min-w-0 flex-1 flex items-center gap-1.5">
                                              <span class="font-black text-slate-900 text-[11px] shrink-0">${escapeHtml(mem.name)}</span>
                                              <span class="text-[9.5px] font-semibold truncate ${activeTaskSummary ? 'text-indigo-700' : 'text-slate-400'}">
                                                ${activeTaskSummary ? escapeHtml(activeTaskSummary) : (roleHint ? `(${escapeHtml(roleHint)})` : 'Chưa chọn')}
                                              </span>
                                            </div>
                                            <div class="flex items-center gap-1.5 shrink-0">
                                              <span class="font-mono font-black tabular-nums text-[11px] ${memCost > 0 ? 'text-slate-900' : 'text-slate-400'}">${formatCompactMoneyPlain(memCost)}</span>
                                              <span class="w-5 h-5 rounded-md bg-white border border-slate-200/90 text-[9px] font-black text-slate-600 flex items-center justify-center">
                                                ${isCrewOpen ? '▲' : '✎'}
                                              </span>
                                            </div>
                                          </div>

                                          ${isCrewOpen ? `
                                            <div class="grid grid-cols-3 gap-1 pt-0.5">
                                              ${taskKeys.map(tk => {
                                                const active = memTasks[tk] !== undefined && memTasks[tk] !== null;
                                                const tVal = active ? memTasks[tk] : getDefaultRateForTask(tk, sh);
                                                return `
                                                  <div class="h-6 rounded-md border px-1.5 flex items-center justify-between gap-1 transition min-w-0 ${
                                                    active
                                                      ? 'bg-white border-slate-300 text-slate-900'
                                                      : 'bg-white/60 hover:bg-white border-slate-200/75 text-slate-600'
                                                  }">
                                                    <button type="button" onclick="ownerActions.toggleOwnerCrewTask('${sh.id}', '${mid}', '${tk}')" class="text-left text-[10px] truncate ${active ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}">
                                                      ${taskLabels[tk]}
                                                    </button>
                                                    ${active ? `
                                                      <input
                                                        type="text"
                                                        inputmode="decimal"
                                                        value="${formatCompactMoneyPlain(tVal)}"
                                                        onfocus="this.value='${Number(tVal || 0) || ''}';this.select();"
                                                        oninput="ownerActions.handleOwnerCrewTaskInput('${sh.id}', '${mid}', '${tk}', this)"
                                                        onblur="renderApp()"
                                                        class="flex-1 min-w-0 bg-transparent text-right font-mono font-extrabold tabular-nums text-[10px] text-slate-900 focus:outline-none"
                                                      />
                                                    ` : ''}
                                                  </div>
                                                `;
                                              }).join('')}
                                            </div>
                                          ` : ''}
                                        </div>
                                      `;
                                    }).join('')}
                                  </div>
                                `}
                              </div>

                              <div class="space-y-1.5">
                                <div class="flex items-center justify-between gap-2">
                                  <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">PHÁT SINH</span>
                                    ${allExpList.length > 0 ? `
                                      <span id="debt-show-other-sum-${sh.id}" class="font-mono font-black tabular-nums text-[10.5px] text-rose-600">
                                        ${otherExpSum.toLocaleString('vi-VN')}đ
                                      </span>
                                    ` : ''}
                                  </div>
                                  <button type="button" onclick="ownerActions.addOwnerExpense('${sh.id}')" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold transition">+ Thêm chi</button>
                                </div>

                                ${allExpList.length === 0 ? `
                                  <div class="text-[11px] text-slate-400 py-0.5">• Không có phát sinh</div>
                                ` : `
                                  <ul class="divide-y divide-slate-100">
                                    ${allExpList.map((ex, exIdx) => {
                                      const payerName = ex.payerId && ex.payerId !== sh.ownerId ? getMember(ex.payerId).name : '';
                                      const rowKey = `${sh.id}_${ex.id || exIdx}`;
                                      const isEditingRow = state.ownerEditingExpenseKey === rowKey;
                                        if (isEditingRow) {
                                          return `
                                            <li class="py-1 flex items-center gap-1.5">
                                              <div class="flex-1 min-w-0 flex items-center gap-1 p-1 rounded-xl bg-[#f8fafc] border border-slate-200/90">
                                                <input
                                                  id="debt-exp-name-${escapeHtml(rowKey)}"
                                                  type="text"
                                                  value="${escapeHtml(ex.name || '')}"
                                                  oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                                  onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                                  placeholder="Khoản chi..."
                                                  class="flex-1 min-w-0 h-7 px-2 bg-white border border-slate-200/90 rounded-lg text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                                />
                                                <input
                                                  type="text"
                                                  inputmode="decimal"
                                                  value="${ex.amount ? Number(ex.amount) : ''}"
                                                  oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                                  onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                                  placeholder="Số tiền"
                                                  class="w-20 sm:w-24 shrink-0 h-7 px-2 bg-white border border-slate-200/90 rounded-lg text-[11px] font-mono font-black tabular-nums text-rose-600 text-right focus:outline-none focus:border-slate-900"
                                                />
                                              </div>
                                              <button
                                                type="button"
                                                onclick="ownerActions.finishEditOwnerExpense()"
                                                title="Xong"
                                                class="px-1 text-emerald-600 hover:text-emerald-700 font-black text-sm shrink-0 transition"
                                              >✓</button>
                                              <button
                                                type="button"
                                                onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                                title="Xóa khoản chi"
                                                class="px-1 text-slate-400 hover:text-rose-600 font-bold text-xs shrink-0 transition"
                                              >✕</button>
                                            </li>
                                          `;
                                        }

                                      return `
                                        <li class="flex items-center justify-between gap-1.5 py-1">
                                          <div class="flex items-center gap-1.5 min-w-0 flex-1 text-[11px]">
                                            <span class="text-slate-400 font-black select-none shrink-0">•</span>
                                            <span class="font-semibold text-slate-800 truncate">${escapeHtml(ex.name || 'Khoản phát sinh')}</span>
                                            ${payerName ? `<span class="text-[9.5px] text-slate-500 shrink-0">(${escapeHtml(payerName)})</span>` : ''}
                                            <span class="text-slate-300 shrink-0">—</span>
                                            <span class="font-mono font-extrabold tabular-nums text-rose-600 shrink-0">${Number(ex.amount || 0).toLocaleString('vi-VN')}đ</span>
                                          </div>
                                          <div class="flex items-center gap-0.5 shrink-0">
                                            <button
                                                type="button"
                                                onclick="ownerActions.startEditOwnerExpense('${escapeHtml(rowKey)}', '${sh.id}', '${escapeHtml(ex.id || '')}')"
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
                  } else {
                    const cm = calculateCrewShowMetrics(sh);
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
                              <span class="text-[9px] font-black uppercase tracking-wider text-slate-500 block">${sh.isHold && !sh.countHoldForBilling ? 'Tạm giữ' : 'TỔNG SHOW'}</span>
                              <span class="text-[15px] font-mono font-black tabular-nums tracking-tight ${isCounted ? 'text-slate-950' : 'text-slate-400'} block">${isCounted ? fmtMoney(cm.grossCtp) : '0đ'}</span>
                            </div>
                          </div>

                          ${holdBillingBarHtml}

                          ${expanded ? `
                            <div class="space-y-3">
                              <div class="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-[#f8fafc] border border-slate-200/80">
                                ${CREW_CTP_STATUS_OPTIONS.map(s => `<button type="button" onclick="ownerActions.setCrewCtpStatus('${sh.id}', '${s.id}')" class="py-1 px-2 rounded-lg text-[10.5px] border truncate transition ${getColoredStatusBtnClass(s.id, cm.meta.ctpStatus === s.id)}">${escapeHtml(formatCleanStatusLabel(s.label))}</button>`).join('')}
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
      <div class="h-6 rounded-md border px-1.5 flex items-center justify-between gap-1 transition min-w-0 ${
        active
          ? 'bg-slate-100 border-slate-300/90 text-slate-900'
          : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/75 text-slate-600'
      }">
        <button type="button" onclick="ownerActions.toggleSyncedCtpTask('${sh.id}', '${tk}')" class="text-left text-[10px] truncate ${active ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}">
          ${taskLabels[tk]}
        </button>
        ${active ? `
          <input
            type="text"
            inputmode="decimal"
            value="${formatCompactMoneyPlain(tVal)}"
            onfocus="this.value='${Number(tVal || 0) || ''}';this.select();"
            oninput="ownerActions.handleSyncedCtpTaskInput('${sh.id}', '${tk}', this)"
            onblur="const n=Number(state.ctpItems?.['${sh.id}']?.tasks?.['${tk}']||0);this.value=${formatCompactMoneyPlain.name}(n);"
            class="flex-1 min-w-0 bg-transparent text-right font-mono font-extrabold tabular-nums text-[10px] text-slate-900 focus:outline-none"
          />
        ` : ''}
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
                                          <li class="py-1 flex items-center gap-1.5">
                                            <div class="flex-1 min-w-0 flex items-center gap-1 p-1 rounded-xl bg-[#f8fafc] border border-slate-200/90">
                                              <input
                                                id="debt-exp-name-${escapeHtml(rowKey)}"
                                                type="text"
                                                value="${escapeHtml(ex.name || '')}"
                                                oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                                onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                                placeholder="Khoản chi..."
                                                class="flex-1 min-w-0 h-7 px-2 bg-white border border-slate-200/90 rounded-lg text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                              />
                                              <input
                                                type="text"
                                                inputmode="decimal"
                                                value="${ex.amount ? Number(ex.amount) : ''}"
                                                oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                                onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                                placeholder="Số tiền"
                                                class="w-20 sm:w-24 shrink-0 h-7 px-2 bg-white border border-slate-200/90 rounded-lg text-[11px] font-mono font-black tabular-nums text-rose-600 text-right focus:outline-none focus:border-slate-900"
                                              />
                                            </div>
                                            <button
                                              type="button"
                                              onclick="ownerActions.finishEditOwnerExpense()"
                                              title="Xong"
                                              class="px-1 text-emerald-600 hover:text-emerald-700 font-black text-sm shrink-0 transition"
                                            >✓</button>
                                            <button
                                              type="button"
                                              onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                              title="Xóa khoản chi"
                                              class="px-1 text-slate-400 hover:text-rose-600 font-bold text-xs shrink-0 transition"
                                            >✕</button>
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
