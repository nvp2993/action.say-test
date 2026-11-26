import { state } from '../state/store.js';
import { escapeHtml, getMember, getShowDays, buildVietQrUrl, getBankName, formatCompactMoneyPlain } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import { getCombinedCtpShows, getDefaultRateForTask, getMemberExtrasForShow, ensureOwnerFinRecord } from '../services/finance.service.js';
import { renderUnifiedDateBarHtml } from './header.ui.js';

function shouldCountShowMoney(sh) {
  return !sh?.isHold || Boolean(sh?.countHoldForBilling);
}

function getShowTaskSum(item) {
  return Object.entries(item?.tasks || {}).reduce(
    (s, [, v]) => (v !== null && v !== undefined) ? s + (Number(v) || 0) : s,
    0
  );
}

function getShowRawTotal(sh, item, myExtras) {
  const activeTaskSum = getShowTaskSum(item);
  const extraSum = (myExtras || []).reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
  return activeTaskSum + extraSum;
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

export function renderCtpTabHtml() {
  const uid = state.currentUserId;
  const curMem = getMember(uid);
  const filteredShows = getCombinedCtpShows();

  let grandTotal = 0;
  let totalExtraCost = 0;
  let unpaidCtpSum = 0;
  let settledCtpSum = 0;
  let missingTaskShows = [];
  let holdShowsCount = 0;

  filteredShows.forEach(sh => {
    if (sh.isHold) holdShowsCount++;
    const it = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
    const myExtras = sh.ownerId === uid ? [] : getMemberExtrasForShow(sh.id, uid);
    const activeTasksCount = Object.values(it.tasks || {}).filter(v => v !== null && v !== undefined).length;
    if (shouldCountShowMoney(sh) && activeTasksCount === 0 && myExtras.length === 0) {
      missingTaskShows.push(sh);
    }

    if (!shouldCountShowMoney(sh)) return;
    const extraSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
    const rawTotal = getShowTaskSum(it) + extraSum;
    grandTotal += rawTotal;
    totalExtraCost += extraSum;

    const rec = ensureOwnerFinRecord(sh);
    const isSettled = rec?.crewMemberMeta?.[uid]?.ctpStatus === 'settled';
    if (isSettled) settledCtpSum += rawTotal;
    else unpaidCtpSum += rawTotal;
  });

  const hide = Boolean(state.hideMoneyMode);
  const fmtMoney = (n) => (hide ? '••••••đ' : `${Number(n || 0).toLocaleString('vi-VN')}đ`);

  const ctpStatCards = [
    {
      id: 'ctp-grand-total-display',
      label: 'TỔNG BILL CTP',
      val: fmtMoney(grandTotal),
      wrapCls: 'bg-slate-900 border-slate-900 text-white',
      labelCls: 'text-slate-300',
      valCls: 'text-amber-300'
    },
    {
      id: 'ctp-extra-total-display',
      label: 'CHI PHÍ PHÁT SINH',
      val: fmtMoney(totalExtraCost),
      wrapCls: 'bg-white border-slate-200/90 text-slate-900',
      labelCls: 'text-slate-400',
      valCls: 'text-indigo-700'
    },
    {
      id: 'ctp-unpaid-total-display',
      label: 'CTP CHƯA NHẬN',
      val: fmtMoney(unpaidCtpSum),
      wrapCls: 'bg-white border-slate-200/90 text-slate-900',
      labelCls: 'text-slate-400',
      valCls: 'text-amber-700'
    },
    {
      id: 'ctp-settled-total-display',
      label: 'CTP ĐÃ NHẬN',
      val: fmtMoney(settledCtpSum),
      wrapCls: 'bg-white border-slate-200/90 text-slate-900',
      labelCls: 'text-slate-400',
      valCls: 'text-emerald-700'
    }
  ];

  const firstMissingId = missingTaskShows[0]?.id || '';
  const jumpToFirstMissingJs = firstMissingId
    ? `const c=document.getElementById('ctp-shows-scroll-list');const t=document.getElementById('ctp-show-card-${escapeHtml(firstMissingId)}');if(c&&t){c.scrollTo({top:Math.max(0,t.offsetTop-c.offsetTop-84),behavior:'smooth'});}`
    : '';

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-[#f1f5f9] text-xs">
      <div class="bg-[#f8fafc] px-3 py-2 sm:py-2.5 border-b border-slate-200/90 shrink-0 space-y-1.5 sm:space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase tracking-tight truncate">💼 CTP (${escapeHtml(curMem.name)})</span>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="appActions.toggleHideMoneyMode()" class="px-2.5 py-1 rounded-full bg-slate-200/70 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700 transition">
              ${hide ? '👁️ Hiện tiền' : '🙈 Ẩn tiền'}
            </button>
            <span class="text-[10px] font-bold text-slate-400">Năm ${state.selectedYear}</span>
          </div>
        </div>
        ${renderUnifiedDateBarHtml('ctp')}
        <div class="lg:hidden flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span class="text-[10px] font-bold text-slate-500 shrink-0">Sếp:</span>
            <select onchange="ctpActions.setOwner(this.value)" class="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold">
              <option value="all">Tất cả Sếp</option>
              ${state.members.filter(m => m.id !== uid).map(m => `<option value="${m.id}" ${state.ctpOwnerId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
          <div onclick="appActions.toggleHideMoneyMode()" class="text-right bg-emerald-50 px-3 py-1 rounded-2xl border border-emerald-200 shrink-0 cursor-pointer">
            <span class="text-[8.5px] text-emerald-700 font-bold uppercase block">Tổng T${state.ctpMonth}</span>
            <span class="text-xs font-black text-emerald-700 font-mono tabular-nums">${fmtMoney(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[336px_minmax(0,1fr)]">
        <aside class="hidden lg:flex flex-col gap-3 p-3.5 bg-[#f8fafc] border-r border-slate-200/90 overflow-y-auto custom-scroll">
          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sếp</label>
              <span class="text-[10px] font-mono font-bold text-slate-400 tabular-nums">${filteredShows.length} show</span>
            </div>
            <select onchange="ctpActions.setOwner(this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900">
              <option value="all">Tất cả Sếp</option>
              ${state.members.filter(m => m.id !== uid).map(m => `<option value="${m.id}" ${state.ctpOwnerId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Thao tác</div>
            <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 text-slate-800 font-extrabold text-[11px] text-left transition">
              + Tự note thêm show ngoài lịch
            </button>
            ${filteredShows.length > 0 ? `
              <button type="button" onclick="ctpActions.autoFillFromRoles()" class="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 font-extrabold text-[11px] text-left transition">
                ⚡ Tự điền CTP theo vai trò đã gắn
              </button>
            ` : ''}
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Kiểm tra tháng T${state.ctpMonth}</div>
            <div class="space-y-1.5 text-[11px]">
              <div class="flex items-center justify-between px-2.5 py-2 rounded-xl ${missingTaskShows.length > 0 ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-slate-50 border border-slate-200/70 text-slate-700'}">
                <span class="font-bold">Chưa nhập nhiệm vụ</span>
                ${missingTaskShows.length > 0 ? `
                  <button type="button" onclick="${jumpToFirstMissingJs}" class="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-mono font-black text-[10px]">
                    ${missingTaskShows.length} show →
                  </button>
                ` : `<span class="font-mono font-black text-[10.5px] text-emerald-700">0 ✓</span>`}
              </div>
              <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-slate-700">
                <span class="font-bold">Lịch giữ chỗ</span>
                <span class="font-mono font-black text-[10.5px] text-amber-700 tabular-nums">${holdShowsCount} show</span>
              </div>
            </div>
          </div>

          <div class="space-y-2 pt-0.5">
            <button type="button" onclick="ctpActions.saveNow()" class="w-full py-3 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition">
              💾 LƯU CTP LÊN CLOUD
            </button>
            <button type="button" onclick="ctpActions.generateBill()" class="w-full py-3.5 px-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase shadow-xs transition">
              🔥 LỤM (TỔNG HỢP BILL)
            </button>
          </div>
        </aside>

        <div id="ctp-shows-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll px-2.5 sm:px-4 pb-4">
          <div class="max-w-6xl mx-auto space-y-2 sm:space-y-3">
            <div onclick="appActions.toggleHideMoneyMode()" class="sm:sticky sm:top-0 z-20 grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 bg-[#f1f5f9] sm:-mx-4 sm:px-4 pt-2 sm:pt-3 pb-1.5 sm:pb-2.5 sm:border-b sm:border-slate-200/80 cursor-pointer">
              ${ctpStatCards.map(c => `
                <div class="px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border shadow-2xs transition ${c.wrapCls}">
                  <span class="text-[8.5px] sm:text-[9px] font-extrabold uppercase tracking-wider block truncate ${c.labelCls}">${c.label}</span>
                  <span id="${c.id}" class="font-black font-mono tabular-nums text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
                </div>
              `).join('')}
            </div>

            ${filteredShows.length === 0 ? `
              <div class="text-center py-12 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-3 p-4">
                <div class="text-3xl">📭</div>
                <div class="text-slate-800 font-bold text-xs">Chưa có show nào trong tháng T${state.ctpMonth}</div>
                <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="px-4 py-2.5 bg-indigo-600 text-white rounded-full text-xs font-extrabold">Tự note thêm show ngoài</button>
              </div>
            ` : `
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 items-stretch">
                ${filteredShows.map((sh) => {
                  const item = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
                  const myExtras = sh.ownerId === uid ? [] : getMemberExtrasForShow(sh.id, uid);
                  const days = Math.max(1, Number(getShowDays(sh) || 1));
                  const dateLabel = formatShowDateRange(sh, days);
                  const owner = getMember(sh.ownerId);
                  const rawTotal = getShowRawTotal(sh, item, myExtras);
                  const isCounted = shouldCountShowMoney(sh);
                  const subTotal = isCounted ? rawTotal : 0;
                  const partnerText = getVisiblePartnerText(sh);
                  const displayLocation = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
                  const myExtrasSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

                  const taskList = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'].map(k => ({
                    key: k,
                    label: { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Hình', flycam: 'Flycam', gimbal: 'Gimbal' }[k],
                    def: getDefaultRateForTask(k, sh)
                  }));
                  const hasEditingRow = myExtras.some((ex, exIdx) => state.ctpEditingExtraKey === `${sh.id}_${ex.id || exIdx}`);

                  return `
                    <article id="ctp-show-card-${escapeHtml(sh.id)}" ${sh.isHold ? 'style="background: repeating-linear-gradient(-45deg, #fffbeb, #fffbeb 10px, #fef3c7 10px, #fef3c7 20px); border: 1.5px dashed #f59e0b;"' : ''} class="${sh.isHold ? '' : 'bg-white border border-slate-200/90 hover:border-slate-300'} rounded-2xl sm:rounded-3xl p-3 sm:p-4 shadow-2xs flex flex-col justify-between gap-2.5 sm:gap-3 min-w-0 transition-colors">
                      <div class="space-y-2 sm:space-y-3">
                        <div class="flex items-start justify-between gap-2 min-h-[48px] sm:min-h-[54px] -mx-1 -mt-1 sm:-mx-1.5 sm:-mt-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl ${sh.isHold ? 'bg-white/65 border-b border-amber-200/80' : 'bg-[#f8fafc] border-b border-slate-200/70'}">
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
                            <span class="text-[9px] font-black uppercase tracking-wider text-slate-500 block">${sh.isHold && !sh.countHoldForBilling ? 'Tạm giữ' : 'TỔNG SHOW'}</span>
                            <span id="ctp-show-total-${sh.id}" class="text-[15px] font-black font-mono tabular-nums tracking-tight ${isCounted ? 'text-slate-950' : 'text-slate-400'}">${subTotal.toLocaleString('vi-VN')}đ</span>
                          </div>
                        </div>

                        ${sh.isHold ? `
                          <div onclick="ctpActions.toggleHoldBilling('${sh.id}')" class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl border cursor-pointer transition select-none ${
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
                        ` : ''}

                        ${isCounted ? `
                          <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nhiệm vụ</span>
                              <span class="font-mono font-bold tabular-nums text-[10.5px] text-slate-500">${getShowTaskSum(item).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div class="grid grid-cols-3 gap-1">
                              ${taskList.map(t => {
                                const checked = item.tasks?.[t.key] !== undefined && item.tasks?.[t.key] !== null;
                                const val = checked ? item.tasks[t.key] : t.def;
                                return `
                                  <div class="h-6 rounded-md border px-1 flex items-center justify-between gap-0.5 transition min-w-0 ${
                                    checked
                                      ? 'bg-slate-100 border-slate-300/90 text-slate-900'
                                      : 'bg-slate-50/70 hover:bg-slate-100/80 border-slate-200/75 text-slate-600'
                                  }">
                                    <button
                                      type="button"
                                      onclick="ctpActions.toggleTask('${sh.id}', '${t.key}')"
                                      class="text-left text-[9.5px] sm:text-[10px] truncate ${checked ? 'text-slate-900 font-bold shrink-0' : 'text-slate-600 font-medium w-full'}"
                                    >${t.label}</button>
                                    ${checked ? `
                                      <input
                                        type="tel"
                                        inputmode="numeric"
                                        value="${Number(val).toLocaleString('vi-VN')}"
                                        oninput="ctpActions.handleTaskPriceInput('${sh.id}', '${t.key}', this)"
                                        class="flex-1 min-w-[34px] bg-transparent text-right font-mono font-extrabold tabular-nums text-[8.5px] sm:text-[9.5px] tracking-tighter text-slate-900 focus:outline-none"
                                      />
                                    ` : ''}
                                  </div>
                                `;
                              }).join('')}
                            </div>
                          </div>
                        ` : ''}
                      </div>

                      ${isCounted ? `
                        <div class="pt-2 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-1.5">
                          <div class="flex items-center justify-between gap-2">
                            <div class="flex items-center gap-2 min-w-0">
                              <span class="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Phát sinh</span>
                              ${myExtras.length > 0 ? `
                                <span id="ctp-show-extra-sum-${sh.id}" class="font-mono font-black tabular-nums text-[10.5px] text-emerald-700 shrink-0">
                                  ${myExtrasSum.toLocaleString('vi-VN')}đ
                                </span>
                              ` : ''}
                            </div>
                            <button type="button" onclick="ctpActions.addExtraItem('${sh.id}')" class="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-extrabold transition shrink-0">+ Thêm phát sinh</button>
                          </div>

                          <div class="${hasEditingRow ? 'max-h-44' : myExtras.length === 0 ? 'h-6' : 'max-h-[84px]'} overflow-y-auto custom-scroll pr-0.5">
                            ${myExtras.length === 0 ? `
                              <div class="h-full flex items-center text-[11px] text-slate-400">• Không có phát sinh</div>
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
                                            class="flex-1 min-w-0 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
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
                                            class="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-mono font-black tabular-nums text-slate-900 text-right focus:outline-none focus:border-slate-900"
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
                    </article>
                  `;
                }).join('')}
              </div>
            `}

            ${filteredShows.length > 0 ? `
              <div class="lg:hidden space-y-2 pb-2">
                <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="w-full py-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white text-slate-700 font-extrabold text-xs">Tự note thêm Show ngoài lịch</button>
                <button type="button" onclick="ctpActions.autoFillFromRoles()" class="w-full py-2.5 rounded-3xl bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs">⚡ Tự điền nhanh CTP theo vai trò đã gắn</button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="lg:hidden p-3 bg-[#f8fafc] border-t border-slate-200/90 shrink-0 flex items-center gap-2">
        <button type="button" onclick="ctpActions.saveNow()" class="px-4 py-3.5 rounded-2xl bg-slate-900 text-white font-black text-xs">💾 LƯU</button>
        <button type="button" onclick="ctpActions.generateBill()" class="flex-1 bg-emerald-600 text-white font-black py-3.5 rounded-2xl text-xs uppercase">🔥 LỤM (TỔNG HỢP BILL)</button>
      </div>
    </div>
  `;
}

export function renderCtpBillModalHtml() {
  const bm = state.ctpBillModal;
  if (!bm) return '';
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const memberNickname = (bm.memberName || prof.fullName || '').trim();
  const bankHolderName = (prof.fullName || bm.memberName || '').trim().toUpperCase();
  const qrUrl = prof.bankAcc ? buildVietQrUrl(prof.bankBin, prof.bankAcc) : '';

  const renderFullLines = (fullArr, compactArr) => {
    const rawList = Array.isArray(fullArr) && fullArr.length > 0
      ? fullArr
      : (Array.isArray(compactArr) ? compactArr : []);
    const items = rawList
      .flatMap(x => String(x || '').split(/\n+|,\s*(?=-\s*)/))
      .map(s => s.trim())
      .filter(Boolean);
    if (!items.length) return '<span class="text-slate-400">-</span>';
    return `<div class="space-y-0.5 leading-snug whitespace-nowrap">${items.map(line => `<div>${escapeHtml(line)}</div>`).join('')}</div>`;
  };

  return `
    <div onclick="ctpActions.closeBillModal()" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2.5 sm:p-4">
      <div onclick="event.stopPropagation()" id="ctp-bill-capture-area" class="bg-white w-full max-w-2xl rounded-3xl p-3 sm:p-5 space-y-2.5 text-xs shadow-2xl flex flex-col max-h-[90dvh]">
        <div class="flex justify-between items-center border-b border-slate-200 pb-2 shrink-0 gap-2">
          <div class="min-w-0">
            <h3 class="font-black text-sm text-slate-900 truncate">BẢNG CTP THÁNG ${bm.month}/${state.selectedYear}</h3>
            <p class="text-[11px] text-slate-500 truncate">Nhân sự: <b>${escapeHtml(memberNickname)}</b> • Sếp: <b class="text-emerald-700">${escapeHtml(bm.ownerTitle)}</b></p>
          </div>
          <button type="button" data-html2canvas-ignore="true" onclick="ctpActions.closeBillModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0">✕</button>
        </div>

        <div class="flex-1 min-h-0 overflow-auto custom-scroll border border-slate-300 rounded-2xl">
          <table class="ctp-bill-capture-table w-full min-w-[540px] border-collapse text-[11px]">
            <thead class="sticky top-0 bg-[#107c41] text-white font-extrabold text-[10px] uppercase">
              <tr>
                <th class="py-2 px-1.5 border border-slate-300 text-center whitespace-nowrap">STT</th>
                <th class="py-2 px-1.5 border border-slate-300 text-center whitespace-nowrap">NGÀY</th>
                <th class="py-2 px-2 border border-slate-300 text-left whitespace-nowrap">SHOW</th>
                <th class="py-2 px-2 border border-slate-300 text-left whitespace-nowrap">NHIỆM VỤ</th>
                <th class="py-2 px-2 border border-slate-300 text-left whitespace-nowrap">PHÁT SINH</th>
                <th class="py-2 px-2 border border-slate-300 text-right whitespace-nowrap">TỔNG</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              ${bm.rows.map(r => `
                <tr>
                  <td class="py-1.5 px-1.5 border border-slate-300 text-center align-top whitespace-nowrap">${r.stt}</td>
                  <td class="py-1.5 px-1.5 border border-slate-300 text-center font-mono align-top whitespace-nowrap">${escapeHtml(r.dateLabel)}</td>
                  <td class="py-1.5 px-2 border border-slate-300 font-bold text-slate-900 align-top">${escapeHtml(r.location)}</td>
                  <td class="py-1.5 px-2 border border-slate-300 text-slate-800 align-top">${renderFullLines(r.taskBullets, r.taskBulletsCompact)}</td>
                  <td class="py-1.5 px-2 border border-slate-300 text-slate-800 align-top">${renderFullLines(r.extraBullets, r.extraBulletsCompact)}</td>
                  <td class="py-1.5 px-2 border border-slate-300 text-right font-mono font-black text-emerald-700 align-top whitespace-nowrap">${Number(r.showSum || 0).toLocaleString('vi-VN')}đ</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-slate-900 text-white font-mono font-black">
                <td colspan="5" class="py-2 px-2 border border-slate-700 text-right text-amber-300 whitespace-nowrap">TỔNG CỘNG:</td>
                <td class="py-2 px-2 border border-slate-700 text-right text-emerald-400 whitespace-nowrap">${Number(bm.total || 0).toLocaleString('vi-VN')}đ</td>
              </tr>
            </tfoot>
          </table>
        </div>

        ${qrUrl ? `
          <div class="flex items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-2xl bg-slate-50 border border-slate-200 shrink-0">
            <div class="text-[10.5px] sm:text-[11px] space-y-0.5 min-w-0">
              <div class="font-black text-slate-900 uppercase whitespace-nowrap">💳 QUÉT MÃ VIETQR THANH TOÁN CTP</div>
              <div class="truncate">Ngân hàng: <b>${escapeHtml(getBankName(prof.bankBin))}</b></div>
              <div class="truncate">Chủ TK: <b class="uppercase">${escapeHtml(bankHolderName)}</b></div>
              <div class="truncate">Số TK: <b class="font-mono text-indigo-700">${escapeHtml(prof.bankAcc)}</b></div>
            </div>
            <img src="${qrUrl}" alt="VietQR" class="vietqr-img-el w-20 h-20 sm:w-24 sm:h-24 object-contain bg-white p-1 rounded-xl border border-slate-200 shrink-0" />
          </div>
        ` : ''}

        <div data-html2canvas-ignore="true" class="grid grid-cols-2 sm:grid-cols-4 gap-1.5 shrink-0">
          <button type="button" onclick="ctpActions.captureBillImage()" class="bg-amber-400 text-slate-950 font-black py-2.5 rounded-full text-[11px]">📸 Chụp Ảnh</button>
          <button type="button" onclick="ctpActions.copyBillText()" class="bg-emerald-600 text-white font-black py-2.5 rounded-full text-[11px]">Copy Zalo</button>
          <button type="button" onclick="ctpActions.copyExcelTable()" class="bg-indigo-600 text-white font-black py-2.5 rounded-full text-[11px]">Copy Bảng</button>
          <button type="button" onclick="ctpActions.exportBillExcelFile()" class="bg-slate-100 text-slate-800 border font-black py-2.5 rounded-full text-[11px]">Tải .XLSX</button>
        </div>
      </div>
    </div>
  `;
}
