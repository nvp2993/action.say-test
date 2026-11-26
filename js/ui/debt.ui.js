import { state } from '../state/store.js';
import { OWNER_STATUS_OPTIONS, CREW_CTP_STATUS_OPTIONS } from '../config/constants.js';
import { escapeHtml, formatDayMonth, getShowDays, getMember, formatCompactMoneyPlain } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import { calculateOwnerShowMetrics, calculateCrewShowMetrics, getDefaultRateForTask, getMemberExtrasForShow } from '../services/finance.service.js';
import { renderUnifiedDateBarHtml } from './header.ui.js';

function shouldCountShowMoney(sh) {
  return !sh?.isHold || Boolean(sh?.countHoldForBilling);
}

function cleanHoldTitle(loc) {
  return String(loc || '').replace(/^⏳\s*GIỮ LỊCH:\s*/i, '').trim();
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

  let statCards = [];
  if (filterMode === 'role_owner') {
    statCards = [
      { label: '💰 TỔNG DOANH THU (BÁO KHÁCH)', val: `${ownerPriceSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-slate-900 border-slate-800', labelCls: 'text-slate-300', valCls: 'text-white' },
      { label: '💸 TỔNG CHI PHÍ', val: `${ownerExpSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-rose-50 border-rose-200', labelCls: 'text-rose-700', valCls: 'text-rose-600' },
      { label: '💎 LÃI RÒNG CHỦ SHOW', val: `${ownerProfitSum >= 0 ? '+' : ''}${ownerProfitSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-emerald-50 border-emerald-200', labelCls: 'text-emerald-700', valCls: 'text-emerald-700' },
      { label: '⏳ KHÁCH CÒN NỢ', val: `${ownerUnpaidSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-amber-50 border-amber-200', labelCls: 'text-amber-800', valCls: 'text-amber-700' }
    ];
  } else if (filterMode === 'role_crew') {
    statCards = [
      { label: '🎬 TỔNG BILL CTP', val: `${crewBillSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-slate-900 border-slate-800', labelCls: 'text-slate-300', valCls: 'text-amber-300' },
      { label: '🧾 CHI PHÍ PHÁT SINH', val: `${crewExtraExpSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-indigo-50 border-indigo-200', labelCls: 'text-indigo-700', valCls: 'text-indigo-700' },
      { label: '💎 THỰC NHẬN VỀ', val: `${crewPocketSum >= 0 ? '+' : ''}${crewPocketSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-emerald-50 border-emerald-200', labelCls: 'text-emerald-700', valCls: 'text-emerald-700' },
      { label: '⏳ CTP CHƯA NHẬN', val: `${crewUnpaidSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-amber-50 border-amber-200', labelCls: 'text-amber-800', valCls: 'text-amber-700' }
    ];
  } else if (filterMode === 'settled') {
    statCards = [
      { label: '✅ TỔNG ĐÃ NHẬN (RÒNG)', val: `${settledNetSum >= 0 ? '+' : ''}${settledNetSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-emerald-50 border-emerald-200', labelCls: 'text-emerald-700', valCls: 'text-emerald-700' },
      { label: '👑 ĐÃ THU KHÁCH HÀNG', val: `${settledClientPaidSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-slate-900 border-slate-800', labelCls: 'text-slate-300', valCls: 'text-white' },
      { label: '🎥 ĐÃ NHẬN CTP', val: `${settledCrewPaidSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-indigo-50 border-indigo-200', labelCls: 'text-indigo-700', valCls: 'text-indigo-700' },
      { label: '🏁 SỐ SHOW HOÀN TẤT', val: `${settledCount} show`, wrapCls: 'bg-white border-slate-200', labelCls: 'text-slate-500', valCls: 'text-slate-800' }
    ];
  } else if (filterMode === 'unsettled') {
    statCards = [
      { label: '⏳ TỔNG CÔNG NỢ', val: `${totalUncollectedToWallet.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-rose-50 border-rose-200', labelCls: 'text-rose-700', valCls: 'text-rose-600' },
      { label: '👑 CÔNG NỢ KHÁCH HÀNG', val: `${unsettledClientDebtSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-amber-50 border-amber-200', labelCls: 'text-amber-800', valCls: 'text-amber-700' },
      { label: '🎥 CÔNG NỢ CTP', val: `${unsettledCrewDebtSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-indigo-50 border-indigo-200', labelCls: 'text-indigo-700', valCls: 'text-indigo-700' },
      { label: '📌 SỐ SHOW CHƯA XONG', val: `${unsettledCount} show`, wrapCls: 'bg-slate-900 border-slate-800', labelCls: 'text-slate-300', valCls: 'text-amber-300' }
    ];
  } else {
    statCards = [
      { label: '💎 TỔNG THU NHẬP', val: `${totalIncomeAll >= 0 ? '+' : ''}${totalIncomeAll.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-emerald-50 border-emerald-200', labelCls: 'text-emerald-700', valCls: 'text-emerald-700' },
      { label: '👑 LÃI SHOW NHẬN KHÁCH', val: `${ownerProfitSum >= 0 ? '+' : ''}${ownerProfitSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-slate-900 border-slate-800', labelCls: 'text-slate-300', valCls: 'text-white' },
      { label: '🎥 CTP ĐI LÀM', val: `${crewPocketSum >= 0 ? '+' : ''}${crewPocketSum.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-indigo-50 border-indigo-200', labelCls: 'text-indigo-700', valCls: 'text-indigo-700' },
      { label: '⏳ CHƯA THU VỀ VÍ', val: `${totalUncollectedToWallet.toLocaleString('vi-VN')}đ`, wrapCls: 'bg-rose-50 border-rose-200', labelCls: 'text-rose-700', valCls: 'text-rose-600' }
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
    if (isOwner) {
      const m = calculateOwnerShowMetrics(sh);
      if (m.rec.status !== 'settled' && m.remainingClientDebt > 0) {
        pendingDebts.push({
          showId: sh.id,
          loc,
          dateLabel: formatDayMonth(sh.startDate),
          roleLabel: sh.partner ? `Khách: ${sh.partner}` : 'Khách chưa thanh toán',
          amount: m.remainingClientDebt,
          badgeText: `Nợ ${formatCompactMoneyPlain(m.remainingClientDebt)}`,
          badgeCls: 'text-rose-600'
        });
      }
    } else {
      const cm = calculateCrewShowMetrics(sh);
      if (!cm.isSettled && cm.pendingCtpDebt > 0) {
        pendingDebts.push({
          showId: sh.id,
          loc,
          dateLabel: formatDayMonth(sh.startDate),
          roleLabel: `Chủ show: ${getMember(sh.ownerId).name}`,
          amount: cm.pendingCtpDebt,
          badgeText: `Chờ ${formatCompactMoneyPlain(cm.pendingCtpDebt)}`,
          badgeCls: 'text-amber-700'
        });
      }
    }
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

      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside class="hidden lg:flex flex-col gap-3 p-3 bg-slate-50/95 border-r border-slate-200 overflow-y-auto custom-scroll">
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-500 uppercase">📌 CẦN THU / CHỜ NHẬN (${pendingDebts.length})</span>
              <span class="font-mono font-black text-[10.5px] text-rose-600">${pendingDebts.reduce((s, x) => s + x.amount, 0).toLocaleString('vi-VN')}đ</span>
            </div>
            <div class="space-y-1.5 max-h-56 overflow-y-auto custom-scroll pr-0.5">
              ${pendingDebts.length === 0 ? `
                <div class="text-[11px] text-emerald-700 font-semibold py-2.5 px-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70 text-center">
                  ✓ Không còn khoản nợ tồn đọng trong kỳ!
                </div>
              ` : pendingDebts.map(item => `
                <button
                  type="button"
                  onclick="ownerActions.focusShow('${escapeHtml(item.showId)}')"
                  class="w-full text-left px-2.5 py-2 rounded-xl bg-slate-50/90 hover:bg-amber-50/70 border border-slate-200/80 hover:border-amber-200 transition space-y-0.5"
                >
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <span class="font-extrabold text-slate-900 truncate">${escapeHtml(item.loc || 'Show')}</span>
                    <span class="font-mono text-[9.5px] text-slate-400 shrink-0">${escapeHtml(item.dateLabel)}</span>
                  </div>
                  <div class="flex items-center justify-between gap-2 text-[10px]">
                    <span class="text-slate-500 truncate">${escapeHtml(item.roleLabel)}</span>
                    <span class="font-mono font-black shrink-0 ${item.badgeCls}">${item.badgeText}</span>
                  </div>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[10px] font-black text-slate-500 uppercase">🧾 PHÁT SINH TRONG KỲ (${periodExpenses.length})</span>
              <span class="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 font-mono font-black text-[10.5px] text-rose-600">${periodExpTotal.toLocaleString('vi-VN')}đ</span>
            </div>
            <div class="space-y-1.5 max-h-56 overflow-y-auto custom-scroll pr-0.5">
              ${periodExpenses.length === 0 ? `
                <div class="text-[11px] text-slate-400 py-2.5 text-center">Chưa có khoản phát sinh nào trong kỳ.</div>
              ` : periodExpenses.map(row => `
                <button
                  type="button"
                  onclick="ownerActions.focusShow('${escapeHtml(row.showId)}')"
                  class="w-full text-left px-2.5 py-2 rounded-xl bg-slate-50/90 hover:bg-indigo-50/60 border border-slate-200/80 hover:border-indigo-200 transition space-y-0.5"
                >
                  <div class="flex items-center justify-between gap-2 text-[11px]">
                    <span class="font-bold text-slate-800 truncate">• ${escapeHtml(row.name)}</span>
                    <span class="font-mono font-black text-rose-600 shrink-0">${row.amount.toLocaleString('vi-VN')}đ</span>
                  </div>
                  <div class="text-[9.5px] text-slate-500 truncate">
                    Show: <b class="text-slate-700">${escapeHtml(row.showLoc || '')}</b>${row.payerName ? ` • ${escapeHtml(row.payerName)}` : ''}
                  </div>
                </button>
              `).join('')}
            </div>
          </div>
        </aside>

        <div id="owner-debt-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 space-y-2.5">
          <div class="sticky top-0 z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/95 backdrop-blur-xs pb-1.5">
            ${statCards.map(c => `
              <div class="p-2.5 rounded-2xl border shadow-2xs ${c.wrapCls}">
                <span class="text-[9px] font-extrabold uppercase block truncate ${c.labelCls}">${c.label}</span>
                <span class="font-black font-mono text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
              </div>
            `).join('')}
          </div>

          ${filtered.length === 0 ? `
            <div class="text-center py-10 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-3 p-4">
              <div class="text-3xl">📭</div>
              <div class="text-slate-800 font-bold text-xs">Chưa có show nào trong danh mục lọc này (${unsettledCount} show chờ xử lý)</div>
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
            const isCounted = shouldCountShowMoney(sh);
            const displayLocation = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
            const holdCardStyle = sh.isHold
              ? 'style="background: repeating-linear-gradient(-45deg, #fffbeb, #fffbeb 10px, #fef3c7 10px, #fef3c7 20px); border: 1.5px dashed #f59e0b;"'
              : '';
            const holdCardCls = sh.isHold
              ? 'rounded-3xl p-3.5 space-y-3'
              : 'bg-white rounded-3xl border border-slate-200 p-3.5 space-y-3';
            const holdControlsHtml = sh.isHold
              ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-extrabold">⏳ Giữ lịch</span>`
              : '';
            const holdBillingBarHtml = sh.isHold ? `
              <div onclick="event.stopPropagation(); ctpActions.toggleHoldBilling('${sh.id}')" class="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border cursor-pointer transition select-none ${
                sh.countHoldForBilling
                  ? 'bg-emerald-50/95 border-emerald-300 text-emerald-900'
                  : 'bg-white/90 border-amber-300/80 text-amber-900 hover:bg-white'
              }">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm leading-none">${sh.countHoldForBilling ? '💰' : '💵'}</span>
                  <span class="text-[11px] font-extrabold truncate">
                    ${sh.countHoldForBilling ? 'Đang tính tiền show này' : 'Tính tiền show này (mặc định 0đ)'}
                  </span>
                </div>
                <div class="w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 ${sh.countHoldForBilling ? 'bg-emerald-500' : 'bg-slate-300'}">
                  <div class="w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${sh.countHoldForBilling ? 'translate-x-4' : 'translate-x-0'}"></div>
                </div>
              </div>
            ` : '';

            if (isOwner) {
              const m = calculateOwnerShowMetrics(sh);
              const stObj = OWNER_STATUS_OPTIONS.find(o => o.id === m.rec.status) || OWNER_STATUS_OPTIONS[0];
              const crewMembers = (sh.memberIds || []).filter(mid => mid !== sh.ownerId);
              const missingClient = Math.max(0, m.clientPrice - m.depositPaid);
              const allExpList = Array.isArray(m.allShowExp) ? m.allShowExp : (m.rec.otherExpenses || []);
              const otherExpSum = allExpList.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

              return `
                <div id="debt-show-card-${escapeHtml(sh.id)}" ${holdCardStyle} class="${holdCardCls}">
                  <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2 cursor-pointer">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-mono font-bold text-slate-400">#${idx + 1}</span>
                        <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[9.5px] font-black">👑 Chủ Show</span>
                        <span class="font-mono text-[10px] font-bold text-slate-600">${formatDayMonth(sh.startDate)} (${days}n)</span>
                        <span class="px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${stObj.badgeCls}">${stObj.label}</span>
                        ${holdControlsHtml}
                      </div>
                      <div class="font-black text-slate-900 text-sm mt-1.5">${escapeHtml(displayLocation)} ${partnerText ? `<span class="text-slate-500 font-bold text-xs">(${escapeHtml(partnerText)})</span>` : ''}</div>
                    </div>
                    <div class="text-right shrink-0 space-y-0.5">
                      ${isCounted ? `
                        <div class="text-[10px] font-mono text-slate-500">Thu: <b>${formatCompactMoneyPlain(m.clientPrice)}</b> • Chi: <b class="text-rose-600">${formatCompactMoneyPlain(m.totalExpense)}</b></div>
                        <div class="text-[10.5px] font-mono font-black text-emerald-700">Lãi: ${m.netProfit >= 0 ? '+' : ''}${formatCompactMoneyPlain(m.netProfit)}</div>
                      ` : `
                        <div class="text-[10px] font-bold text-amber-800">Không tính tiền</div>
                        <div class="text-[10.5px] font-mono font-black text-slate-500">0đ</div>
                      `}
                    </div>
                  </div>

                  ${holdBillingBarHtml}

                  ${expanded ? `
                    <div class="pt-2.5 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-3">
                      <div class="space-y-1.5">
                        <span class="text-[10px] font-black text-slate-400 uppercase block">TÌNH TRẠNG THANH LÝ KHÁCH:</span>
                        <div class="flex items-center gap-1.5 flex-wrap">
                          ${OWNER_STATUS_OPTIONS.map(s => `<button type="button" onclick="ownerActions.setStatus('${sh.id}', '${s.id}')" class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${m.rec.status === s.id ? s.badgeCls : 'bg-white/90 text-slate-600'}">${s.label}</button>`).join('')}
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        <div class="min-w-0">
                          <label class="block text-[10px] font-black text-slate-500 uppercase mb-1">💰 GIÁ BÁO KHÁCH HÀNG (VNĐ):</label>
                          <input type="tel" inputmode="numeric" value="${m.clientPrice ? m.clientPrice.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'clientPrice', this)" placeholder="Nhập giá báo khách..." class="w-full min-w-0 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-black text-slate-900 text-right text-xs" />
                        </div>
                        <div class="min-w-0">
                          <div class="flex items-center justify-between flex-wrap gap-1 mb-1">
                            <label class="text-[10px] font-black text-slate-500 uppercase">💵 KHÁCH ĐÃ CỌC / ĐÃ TRẢ:</label>
                            ${missingClient > 0 ? `<span class="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[9.5px] font-bold">Thiếu: ${missingClient.toLocaleString('vi-VN')}đ</span>` : ''}
                          </div>
                          <input type="tel" inputmode="numeric" value="${m.depositPaid ? m.depositPaid.toLocaleString('vi-VN') : ''}" oninput="ownerActions.handleMoneyInput('${sh.id}', 'depositPaid', this)" placeholder="Số tiền khách đã chuyển..." class="w-full min-w-0 px-3 py-2 bg-emerald-50/70 border border-emerald-300 rounded-xl font-mono font-black text-right text-xs text-emerald-800" />
                        </div>
                      </div>

                      <div class="space-y-2">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-[10px] font-black text-slate-500 uppercase">👥 DỰ KIẾN CHI CTP ANH EM (${crewMembers.length})</span>
                          <span class="text-[10px] font-semibold text-slate-400">Chạm thẻ để chọn</span>
                        </div>
                        ${crewMembers.length === 0 ? `
                          <div class="p-2.5 rounded-2xl bg-white/80 text-[11px] text-slate-400">Show này không có nhân sự CTP đi cùng.</div>
                        ` : crewMembers.map(mid => {
                          const mem = getMember(mid);
                          const memCost = Number(m.rec.crewCosts?.[mid]) || 0;
                          const memTasks = m.rec.crewTasks?.[mid] || {};
                          const roleHint = (sh.roles?.[mid] || []).join(' • ');
                          return `
                            <div class="p-3 rounded-2xl bg-white/90 border border-slate-200/80 space-y-2">
                              <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                  <span class="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[10px] font-black uppercase">${escapeHtml(mem.name)}</span>
                                  ${roleHint ? `<span class="text-[10px] font-bold text-slate-500">• ${escapeHtml(roleHint)}</span>` : ''}
                                </div>
                                <span class="font-mono font-black text-xs text-slate-900">${memCost.toLocaleString('vi-VN')}đ</span>
                              </div>

                              <div class="grid grid-cols-3 sm:grid-cols-6 gap-1">
                                ${taskKeys.map(tk => {
                                  const active = memTasks[tk] !== undefined && memTasks[tk] !== null;
                                  const tVal = active ? memTasks[tk] : getDefaultRateForTask(tk, sh);
                                  return `
                                    <div class="flex flex-col">
                                      <button type="button" onclick="ownerActions.toggleOwnerCrewTask('${sh.id}', '${mid}', '${tk}')" class="w-full py-1 px-1.5 rounded-lg text-[9.5px] font-bold border leading-tight transition text-center ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'}">
                                        ${taskLabels[tk]}
                                      </button>
                                      ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ownerActions.handleOwnerCrewTaskInput('${sh.id}', '${mid}', '${tk}', this)" class="mt-1 w-full px-1.5 py-0.5 bg-white border border-slate-300 rounded-md text-[9.5px] font-mono font-bold text-right" />` : ''}
                                    </div>
                                  `;
                                }).join('')}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>

                      <div class="space-y-2">
                        <div class="flex items-center justify-between gap-2">
                          <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-[10px] font-black text-slate-500 uppercase">🚌 CHI PHÍ KHÁC (XE, KS, ĂN, ĐỒ):</span>
                            ${allExpList.length > 0 ? `
                              <span id="debt-show-other-sum-${sh.id}" class="px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-200 font-mono font-black text-[10px] text-rose-600">
                                ${otherExpSum.toLocaleString('vi-VN')}đ
                              </span>
                            ` : ''}
                          </div>
                          <button type="button" onclick="ownerActions.addOwnerExpense('${sh.id}')" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-black text-[10px] transition">+ Thêm chi</button>
                        </div>

                        ${allExpList.length === 0 ? `
                          <div class="text-[11px] text-slate-400 py-0.5">• Chưa có khoản chi phí khác nào.</div>
                        ` : `
                          <ul class="space-y-1.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 px-3 py-2">
                            ${allExpList.map((ex, exIdx) => {
                              const payerName = ex.payerId && ex.payerId !== sh.ownerId ? getMember(ex.payerId).name : '';
                              const rowKey = `${sh.id}_${ex.id || exIdx}`;
                              const isEditingRow = state.ownerEditingExpenseKey === rowKey;
                              if (isEditingRow) {
                                return `
                                  <li class="flex items-center justify-between gap-2 py-1 border-b last:border-b-0 border-slate-200/60">
                                    <div class="flex items-center gap-2 flex-1 min-w-0">
                                      <span class="text-slate-400 font-black select-none">•</span>
                                      <input
                                        id="debt-exp-name-${escapeHtml(rowKey)}"
                                        type="text"
                                        value="${escapeHtml(ex.name || '')}"
                                        oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                        placeholder="Tên khoản chi..."
                                        class="flex-1 min-w-0 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                      />
                                    </div>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                      <input
                                        type="tel"
                                        inputmode="numeric"
                                        value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}"
                                        oninput="ownerActions.saveOwnerExpenseField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                        onkeydown="if(event.key==='Enter'){event.preventDefault();ownerActions.finishEditOwnerExpense();}"
                                        placeholder="Số tiền"
                                        class="w-32 sm:w-36 px-2.5 py-1 bg-rose-50/70 border border-rose-300 rounded-lg text-xs font-mono font-black text-rose-700 text-right focus:outline-none focus:border-rose-500"
                                      />
                                      <button
                                        type="button"
                                        onclick="ownerActions.finishEditOwnerExpense()"
                                        class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] transition"
                                      >Xong</button>
                                      <button
                                        type="button"
                                        onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                        title="Xóa khoản chi"
                                        class="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 font-bold text-xs flex items-center justify-center transition"
                                      >✕</button>
                                    </div>
                                  </li>
                                `;
                              }

                              return `
                                <li class="flex items-center justify-between gap-2 py-1 border-b last:border-b-0 border-slate-200/60">
                                  <div class="flex items-center gap-2 min-w-0 flex-1 text-xs">
                                    <span class="text-slate-400 font-black select-none">•</span>
                                    <span class="font-semibold text-slate-800 truncate">${escapeHtml(ex.name || 'Khoản chi phí')}</span>
                                    ${payerName ? `<span class="px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[9.5px] font-bold text-indigo-700 shrink-0">${escapeHtml(payerName)}</span>` : ''}
                                    <span class="text-slate-300">—</span>
                                    <span class="font-mono font-black text-rose-600 shrink-0">${Number(ex.amount || 0).toLocaleString('vi-VN')}đ</span>
                                  </div>
                                  <div class="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onclick="ownerActions.startEditOwnerExpense('${escapeHtml(rowKey)}')"
                                      class="px-2.5 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10.5px] font-bold text-slate-700 transition"
                                    >Sửa</button>
                                    <button
                                      type="button"
                                      onclick="ownerActions.removeOwnerExpense('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                      title="Xóa khoản chi"
                                      class="w-6 h-6 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 font-bold text-[10.5px] flex items-center justify-center transition"
                                    >✕</button>
                                  </div>
                                </li>
                              `;
                            }).join('')}
                          </ul>
                        `}
                      </div>

                      <div class="pt-2 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} flex items-center justify-between text-xs font-mono">
                        <div>
                          <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">TỔNG CHI DỰ KIẾN:</span>
                          <span id="debt-show-total-exp-${sh.id}" class="font-black text-rose-600">${m.totalExpense.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div class="text-right">
                          <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">💎 CÒN LẠI (LÃI CHỦ SHOW):</span>
                          <span id="debt-show-net-profit-${sh.id}" class="font-black text-emerald-700">${m.netProfit >= 0 ? '+' : ''}${m.netProfit.toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="px-3.5 py-2.5 rounded-2xl bg-white/90 border border-slate-200 text-slate-700 font-bold text-xs">Thu gọn ▲</button>
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
              const myExtras = getMemberExtrasForShow(sh.id, uid);
              const myExtrasSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

              return `
                <div id="debt-show-card-${escapeHtml(sh.id)}" ${holdCardStyle} class="${holdCardCls}">
                  <div onclick="ownerActions.toggleExpandShow('${sh.id}')" class="flex items-start justify-between gap-2 cursor-pointer">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-[10px] font-mono font-bold text-slate-400">#${idx + 1}</span>
                        <span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-800 text-[9.5px] font-black">🎥 Chủ: ${escapeHtml(owner.name)}</span>
                        <span class="font-mono text-[10px] font-bold text-slate-600">${formatDayMonth(sh.startDate)} (${days}n)</span>
                        <span class="px-2 py-0.5 rounded-full border text-[9.5px] font-bold ${stObj.badgeCls}">${stObj.label}</span>
                        ${holdControlsHtml}
                      </div>
                      <div class="font-black text-slate-900 text-sm mt-1.5">${escapeHtml(displayLocation)} ${partnerText ? `<span class="text-slate-500 font-bold text-xs">(${escapeHtml(partnerText)})</span>` : ''}</div>
                    </div>
                    <div class="text-right shrink-0 space-y-0.5">
                      ${isCounted ? `
                        <div class="text-[10px] font-mono text-slate-500">Công: <b>${formatCompactMoneyPlain(cm.taskSum)}</b>${cm.extraBillSum > 0 ? ` • Phát sinh: <b class="text-indigo-700">+${formatCompactMoneyPlain(cm.extraBillSum)}</b>` : ''}</div>
                        <div class="text-[10.5px] font-mono font-black text-emerald-700">TỔNG CTP: ${formatCompactMoneyPlain(cm.grossCtp)}</div>
                      ` : `
                        <div class="text-[10px] font-bold text-amber-800">Không tính tiền</div>
                        <div class="text-[10.5px] font-mono font-black text-slate-500">0đ</div>
                      `}
                    </div>
                  </div>

                  ${holdBillingBarHtml}

                  ${expanded ? `
                    <div class="pt-2.5 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-3">
                      <div class="space-y-1.5">
                        <span class="text-[10px] font-black text-slate-500 uppercase block">CHỦ SHOW (${escapeHtml(owner.name.toUpperCase())}) THANH TOÁN:</span>
                        <div class="flex items-center gap-1.5 flex-wrap">
                          ${CREW_CTP_STATUS_OPTIONS.map(s => `<button type="button" onclick="ownerActions.setCrewCtpStatus('${sh.id}', '${s.id}')" class="px-2.5 py-1 rounded-full text-[10px] font-bold border ${cm.meta.ctpStatus === s.id ? s.badgeCls : 'bg-white/90 text-slate-600'}">${s.label}</button>`).join('')}
                        </div>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start">
                        <!-- CỘT TRÁI: NHIỆM VỤ CTP -->
                        <div class="space-y-2 min-w-0">
                          <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-black text-slate-500 uppercase">🎬 NHIỆM VỤ CTP:</span>
                            <span class="font-mono font-bold text-[10px] text-slate-500">${cm.taskSum.toLocaleString('vi-VN')}đ</span>
                          </div>
                          <div class="grid grid-cols-3 gap-1.5">
                            ${taskKeys.map(tk => {
                              const active = linkedTasks[tk] !== undefined && linkedTasks[tk] !== null;
                              const tVal = active ? linkedTasks[tk] : getDefaultRateForTask(tk, sh);
                              return `
                                <div class="flex flex-col min-w-0">
                                  <button type="button" onclick="ownerActions.toggleSyncedCtpTask('${sh.id}', '${tk}')" class="w-full py-1.5 px-1.5 rounded-lg text-[10px] font-bold border leading-tight transition text-center ${active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white/90 text-slate-700 border-slate-200'}">
                                    ${taskLabels[tk]}
                                  </button>
                                  ${active ? `<input type="tel" inputmode="numeric" value="${Number(tVal).toLocaleString('vi-VN')}" oninput="ownerActions.handleSyncedCtpTaskInput('${sh.id}', '${tk}', this)" class="mt-1 w-full px-1.5 py-1 bg-indigo-50 border border-indigo-300 rounded-md text-[10px] font-mono font-bold text-right" />` : ''}
                                </div>
                              `;
                            }).join('')}
                          </div>
                        </div>

                        <!-- CỘT PHẢI: CHI PHÍ PHÁT SINH ĐỒNG BỘ -->
                        <div class="space-y-2 min-w-0 md:border-l md:pl-3.5 ${sh.isHold ? 'border-amber-200/80' : 'border-slate-200/80'}">
                          <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2">
                              <span class="text-[10px] font-black text-slate-500 uppercase">🧾 PHÁT SINH (ĐỒNG BỘ CTP):</span>
                              ${myExtras.length > 0 ? `
                                <span id="ctp-show-extra-sum-${sh.id}" class="px-2 py-0.5 rounded-lg bg-emerald-50 border border-emerald-200 font-mono font-black text-[10px] text-emerald-700">
                                  ${myExtrasSum.toLocaleString('vi-VN')}đ
                                </span>
                              ` : ''}
                            </div>
                            <button type="button" onclick="ctpActions.addExtraItem('${sh.id}')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-xl text-[10px] font-black transition">+ Thêm phí</button>
                          </div>

                          ${myExtras.length === 0 ? `
                            <div class="text-[11px] text-slate-400 py-1.5 px-3 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200">• Chưa có khoản phát sinh nào.</div>
                          ` : `
                            <ul class="space-y-1.5 rounded-2xl bg-slate-50/90 border border-slate-200/80 px-3 py-2">
                              ${myExtras.map((ex, exIdx) => {
                                const rowKey = `${sh.id}_${ex.id || exIdx}`;
                                const isEditingRow = state.ctpEditingExtraKey === rowKey;
                                if (isEditingRow) {
                                  return `
                                    <li class="flex flex-wrap items-center justify-between gap-1.5 py-1 border-b last:border-b-0 border-slate-200/60">
                                      <div class="flex items-center gap-1.5 flex-1 min-w-[140px]">
                                        <span class="text-slate-400 font-black select-none">•</span>
                                        <input
                                          id="ctp-extra-name-${escapeHtml(rowKey)}"
                                          type="text"
                                          value="${escapeHtml(ex.name || '')}"
                                          oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                          onkeydown="if(event.key==='Enter'){event.preventDefault();ctpActions.finishEditExtra();}"
                                          placeholder="Tên khoản chi..."
                                          class="flex-1 min-w-0 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
                                        />
                                      </div>
                                      <div class="flex items-center gap-1.5 shrink-0">
                                        <input
                                          type="tel"
                                          inputmode="numeric"
                                          value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}"
                                          oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'amount', this, '${escapeHtml(ex.id || '')}')"
                                          onkeydown="if(event.key==='Enter'){event.preventDefault();ctpActions.finishEditExtra();}"
                                          placeholder="Số tiền"
                                          class="w-28 px-2.5 py-1 bg-emerald-50/80 border border-emerald-300 rounded-lg text-xs font-mono font-black text-emerald-800 text-right focus:outline-none focus:border-emerald-600"
                                        />
                                        <button
                                          type="button"
                                          onclick="ctpActions.finishEditExtra()"
                                          class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10.5px] transition"
                                        >Xong</button>
                                        <button
                                          type="button"
                                          onclick="ctpActions.removeExtraItem('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                          title="Xóa khoản chi"
                                          class="w-7 h-7 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 font-bold text-xs flex items-center justify-center transition"
                                        >✕</button>
                                      </div>
                                    </li>
                                  `;
                                }

                                return `
                                  <li class="flex items-center justify-between gap-2 py-1 border-b last:border-b-0 border-slate-200/60">
                                    <div class="flex items-center gap-1.5 min-w-0 flex-1 text-xs">
                                      <span class="text-slate-400 font-black select-none">•</span>
                                      <span class="font-semibold text-slate-800 truncate">${escapeHtml(ex.name || 'Khoản phát sinh')}</span>
                                      <span class="text-slate-300">—</span>
                                      <span class="font-mono font-black text-emerald-700 shrink-0">${Number(ex.amount || 0).toLocaleString('vi-VN')}đ</span>
                                    </div>
                                    <div class="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onclick="ctpActions.startEditExtra('${escapeHtml(rowKey)}')"
                                        class="px-2 py-0.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-[10.5px] font-bold text-slate-700 transition"
                                      >Sửa</button>
                                      <button
                                        type="button"
                                        onclick="ctpActions.removeExtraItem('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                        title="Xóa khoản chi"
                                        class="w-6 h-6 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 font-bold text-[10.5px] flex items-center justify-center transition"
                                      >✕</button>
                                    </div>
                                  </li>
                                `;
                              }).join('')}
                            </ul>
                          `}
                        </div>
                      </div>

                      <div class="pt-2 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} flex items-center justify-between text-xs font-mono">
                        <div>
                          <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">NHIỆM VỤ + PHÁT SINH:</span>
                          <span class="font-black text-slate-900">${cm.taskSum.toLocaleString('vi-VN')}đ + ${cm.extraBillSum.toLocaleString('vi-VN')}đ</span>
                        </div>
                        <div class="text-right">
                          <span class="text-[10px] font-sans font-bold text-slate-400 uppercase block">💎 TỔNG BILL CTP NHẬN:</span>
                          <span class="font-black text-emerald-700">${cm.grossCtp.toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        <button type="button" onclick="ownerActions.toggleExpandShow('${sh.id}')" class="px-3.5 py-2.5 rounded-2xl bg-white/90 border border-slate-200 text-slate-700 font-bold text-xs">Thu gọn ▲</button>
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
    </div>
  `;
}
