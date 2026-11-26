import { state } from '../state/store.js';
import { escapeHtml, formatDayMonth, getMember, getShowDays, buildVietQrUrl, getBankName } from '../utils/helpers.js';
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
      label: '💼 TỔNG BILL CTP',
      val: fmtMoney(grandTotal),
      wrapCls: 'bg-slate-900 border-slate-800 text-white',
      labelCls: 'text-slate-300',
      valCls: 'text-amber-300'
    },
    {
      id: 'ctp-extra-total-display',
      label: '🧾 CHI PHÍ PHÁT SINH',
      val: fmtMoney(totalExtraCost),
      wrapCls: 'bg-indigo-50 border-indigo-200 text-indigo-950',
      labelCls: 'text-indigo-700',
      valCls: 'text-indigo-800'
    },
    {
      id: 'ctp-unpaid-total-display',
      label: '⏳ CTP CHƯA NHẬN',
      val: fmtMoney(unpaidCtpSum),
      wrapCls: 'bg-amber-50 border-amber-200 text-amber-950',
      labelCls: 'text-amber-800',
      valCls: 'text-amber-700'
    },
    {
      id: 'ctp-settled-total-display',
      label: '✅ CTP ĐÃ NHẬN',
      val: fmtMoney(settledCtpSum),
      wrapCls: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      labelCls: 'text-emerald-700',
      valCls: 'text-emerald-700'
    }
  ];

  const firstMissingId = missingTaskShows[0]?.id || '';
  const jumpToFirstMissingJs = firstMissingId
    ? `const c=document.getElementById('ctp-shows-scroll-list');const t=document.getElementById('ctp-show-card-${escapeHtml(firstMissingId)}');if(c&&t){c.scrollTo({top:Math.max(0,t.offsetTop-c.offsetTop-84),behavior:'smooth'});}`
    : '';

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-slate-100 text-xs">
      <div class="bg-white px-3 py-2.5 border-b border-slate-200 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase truncate">💼 CTP (${escapeHtml(curMem.name)})</span>
          <div class="flex items-center gap-2 shrink-0">
            <button type="button" onclick="appActions.toggleHideMoneyMode()" class="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[10px] font-extrabold text-slate-700">
              ${hide ? '👁️ Hiện tiền' : '🙈 Ẩn tiền'}
            </button>
            <span class="text-[10px] font-bold text-slate-400">Năm ${state.selectedYear}</span>
          </div>
        </div>
        ${renderUnifiedDateBarHtml('ctp')}
        <div class="lg:hidden flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span class="text-[10px] font-bold text-slate-500 shrink-0">Chủ show:</span>
            <select onchange="ctpActions.setOwner(this.value)" class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">
              <option value="all">Tất cả Chủ Show</option>
              ${state.members.filter(m => m.id !== uid).map(m => `<option value="${m.id}" ${state.ctpOwnerId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
          <div onclick="appActions.toggleHideMoneyMode()" class="text-right bg-emerald-50 px-3 py-1 rounded-2xl border border-emerald-200 shrink-0 cursor-pointer">
            <span class="text-[8.5px] text-emerald-700 font-bold uppercase block">Tổng T${state.ctpMonth}</span>
            <span class="text-xs font-black text-emerald-700 font-mono">${fmtMoney(grandTotal)}</span>
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside class="hidden lg:flex flex-col gap-3 p-3 bg-slate-50/95 border-r border-slate-200 overflow-y-auto custom-scroll">
          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-black text-slate-500 uppercase">Lọc theo Chủ show</label>
              <span class="text-[10px] font-mono font-bold text-slate-400">${filteredShows.length} show</span>
            </div>
            <select onchange="ctpActions.setOwner(this.value)" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-slate-900">
              <option value="all">Tất cả Chủ Show</option>
              ${state.members.filter(m => m.id !== uid).map(m => `<option value="${m.id}" ${state.ctpOwnerId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="text-[10px] font-black text-slate-500 uppercase">Thao tác nhanh</div>
            <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50 text-slate-800 font-extrabold text-[11px] text-left transition">
              + Tự note thêm show ngoài lịch
            </button>
            ${filteredShows.length > 0 ? `
              <button type="button" onclick="ctpActions.autoFillFromRoles()" class="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-extrabold text-[11px] text-left transition">
                ⚡ Tự điền CTP theo vai trò đã gắn
              </button>
            ` : ''}
          </div>

          <div class="p-3.5 rounded-2xl bg-white border border-slate-200/90 space-y-2">
            <div class="text-[10px] font-black text-slate-500 uppercase">🔍 Soi nhanh tháng T${state.ctpMonth}</div>
            <div class="space-y-1.5 text-[11px]">
              <div class="flex items-center justify-between px-2.5 py-2 rounded-xl ${missingTaskShows.length > 0 ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50/70 border border-emerald-200/70 text-emerald-800'}">
                <span class="font-bold">Show chưa nhập nhiệm vụ</span>
                ${missingTaskShows.length > 0 ? `
                  <button type="button" onclick="${jumpToFirstMissingJs}" class="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-mono font-black text-[10px]">
                    ${missingTaskShows.length} show →
                  </button>
                ` : `<span class="font-mono font-black text-[10.5px]">0 ✓</span>`}
              </div>
              <div class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-700">
                <span class="font-bold">Lịch giữ chỗ trong tháng</span>
                <span class="font-mono font-black text-[10.5px] text-amber-700">${holdShowsCount} show</span>
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

        <div id="ctp-shows-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3">
          <div class="max-w-5xl mx-auto space-y-3">
            <!-- 4 Ô THỐNG KÊ STICKY -->
            <div onclick="appActions.toggleHideMoneyMode()" class="sticky top-0 z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-100/95 backdrop-blur-xs pb-1.5 cursor-pointer">
              ${ctpStatCards.map(c => `
                <div class="px-3 py-2 rounded-2xl border shadow-2xs transition ${c.wrapCls}">
                  <span class="text-[9px] font-extrabold uppercase block truncate ${c.labelCls}">${c.label}</span>
                  <span id="${c.id}" class="font-black font-mono text-xs sm:text-sm mt-0.5 block ${c.valCls}">${c.val}</span>
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
              <div class="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                ${filteredShows.map((sh, idx) => {
                  const item = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
                  const myExtras = sh.ownerId === uid ? [] : getMemberExtrasForShow(sh.id, uid);
                  const days = getShowDays(sh);
                  const owner = getMember(sh.ownerId);
                  const rawTotal = getShowRawTotal(sh, item, myExtras);
                  const isCounted = shouldCountShowMoney(sh);
                  const subTotal = isCounted ? rawTotal : 0;
                  const isPrivateShow = Boolean(sh.hidePartner || sh.isPrivate);
                  const partnerText = getVisiblePartnerText(sh);
                  const displayLocation = sh.isHold ? cleanHoldTitle(sh.location) : sh.location;
                  const myExtrasSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);

                  const taskList = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'].map(k => ({
                    key: k,
                    label: { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Làm hình', flycam: 'Flycam', gimbal: 'Gimbal' }[k],
                    def: getDefaultRateForTask(k, sh)
                  }));
                  const activeTasks = taskList.filter(t => item.tasks?.[t.key] !== undefined && item.tasks?.[t.key] !== null);
                  const hasEditingRow = myExtras.some((ex, exIdx) => state.ctpEditingExtraKey === `${sh.id}_${ex.id || exIdx}`);

                  return `
                    <div id="ctp-show-card-${escapeHtml(sh.id)}" ${sh.isHold ? 'style="background: repeating-linear-gradient(-45deg, #fffbeb, #fffbeb 10px, #fef3c7 10px, #fef3c7 20px); border: 1.5px dashed #f59e0b;"' : ''} class="${sh.isHold ? '' : 'bg-white border-slate-200 border'} ${hasEditingRow ? 'xl:col-span-2' : ''} rounded-3xl p-4 space-y-3 shadow-2xs">
                      <div class="flex items-start justify-between gap-2.5 ${isCounted ? `border-b ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} pb-2.5` : ''}">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-1.5 flex-wrap text-[10.5px]">
                            <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">#${idx + 1}</span>
                            <span class="font-mono font-bold text-indigo-600">${formatDayMonth(sh.startDate)} (${days}n)</span>
                            <span class="text-slate-300">•</span>
                            <span class="text-slate-600 font-semibold">Chủ: <b class="text-slate-800">${escapeHtml(owner.name)}</b></span>
                            ${sh.isHold ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-extrabold">⏳ Giữ lịch</span>` : ''}
                            ${isPrivateShow ? `<span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9.5px] font-extrabold">🔒 Riêng tư</span>` : ''}
                          </div>
                          <h4 class="font-black text-slate-900 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                            <span>${escapeHtml(displayLocation)}</span>${partnerText ? `<span class="text-slate-500 font-bold text-xs">(${escapeHtml(partnerText)})</span>` : ''}
                          </h4>
                        </div>
                        <div class="text-right shrink-0 ${isCounted ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-white/90 border-slate-200 text-slate-500'} px-3 py-1.5 rounded-2xl border">
                          <span class="text-[8.5px] font-bold uppercase block">${sh.isHold && !sh.countHoldForBilling ? 'Không tính' : 'Tổng Show'}</span>
                          <span id="ctp-show-total-${sh.id}" class="text-xs font-black font-mono">${subTotal.toLocaleString('vi-VN')}đ</span>
                        </div>
                      </div>

                      ${sh.isHold ? `
                        <div onclick="ctpActions.toggleHoldBilling('${sh.id}')" class="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl border cursor-pointer transition select-none ${
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
                      ` : ''}

                      ${isCounted ? `
                        <div class="space-y-3">
                          <!-- NHIỆM VỤ -->
                          <div class="space-y-2">
                            <div class="flex items-center justify-between">
                              <span class="text-[10px] font-black text-slate-400 uppercase">Nhiệm vụ</span>
                              <span class="font-mono font-bold text-[10.5px] text-slate-500">${getShowTaskSum(item).toLocaleString('vi-VN')}đ</span>
                            </div>
                            <div class="flex flex-wrap gap-1.5">
                              ${taskList.map(t => {
                                const checked = item.tasks?.[t.key] !== undefined && item.tasks?.[t.key] !== null;
                                return `
                                  <button type="button" onclick="ctpActions.toggleTask('${sh.id}', '${t.key}')" class="px-2.5 py-1 rounded-lg text-[10.5px] font-bold border leading-tight transition ${checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}">
                                    ${t.label}
                                  </button>
                                `;
                              }).join('')}
                            </div>

                            ${activeTasks.length > 0 ? `
                              <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                ${activeTasks.map(t => {
                                  const val = item.tasks[t.key];
                                  return `
                                    <label class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 focus-within:border-indigo-400 focus-within:bg-indigo-50/40 transition">
                                      <span class="text-[11px] font-extrabold text-slate-800 shrink-0">${t.label}</span>
                                      <input
                                        type="tel"
                                        inputmode="numeric"
                                        value="${Number(val).toLocaleString('vi-VN')}"
                                        oninput="ctpActions.handleTaskPriceInput('${sh.id}', '${t.key}', this)"
                                        class="w-28 bg-transparent text-right font-mono font-black text-xs text-indigo-700 focus:outline-none"
                                      />
                                    </label>
                                  `;
                                }).join('')}
                              </div>
                            ` : ''}
                          </div>

                          <!-- PHÁT SINH: DANH SÁCH GẠCH ĐẦU DÒNG TEXT THUẦN -->
                          <div class="pt-2.5 border-t ${sh.isHold ? 'border-amber-200/80' : 'border-slate-100'} space-y-1.5">
                            <div class="flex items-center justify-between gap-2">
                              <div class="flex items-center gap-2">
                                <span class="text-[10px] font-black text-slate-400 uppercase">Phát sinh</span>
                                ${myExtras.length > 0 ? `
                                  <span id="ctp-show-extra-sum-${sh.id}" class="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-mono font-black text-[10px] text-emerald-700">
                                    ${myExtrasSum.toLocaleString('vi-VN')}đ
                                  </span>
                                ` : ''}
                              </div>
                              <button type="button" onclick="ctpActions.addExtraItem('${sh.id}')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 rounded-lg text-[10px] font-black transition">+ Thêm phí</button>
                            </div>

                            ${myExtras.length === 0 ? `
                              <div class="text-[11px] text-slate-400">• Không có phát sinh</div>
                            ` : `
                              <ul class="divide-y divide-slate-100">
                                ${myExtras.map((ex, exIdx) => {
                                  const rowKey = `${sh.id}_${ex.id || exIdx}`;
                                  const isEditingRow = state.ctpEditingExtraKey === rowKey;
                                  if (isEditingRow) {
                                    return `
                                      <li class="flex flex-wrap items-center justify-between gap-1.5 py-1.5">
                                        <div class="flex items-center gap-1.5 flex-1 min-w-[150px]">
                                          <span class="text-slate-400 font-black select-none">•</span>
                                          <input
                                            id="ctp-extra-name-${escapeHtml(rowKey)}"
                                            type="text"
                                            value="${escapeHtml(ex.name || '')}"
                                            oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'name', this, '${escapeHtml(ex.id || '')}')"
                                            onkeydown="if(event.key==='Enter'){event.preventDefault();ctpActions.finishEditExtra();}"
                                            placeholder="Tên khoản chi..."
                                            class="flex-1 min-w-0 px-2.5 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-slate-900"
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
                                            class="w-32 px-2.5 py-1 bg-emerald-50 border border-emerald-300 rounded-lg text-xs font-mono font-black text-emerald-800 text-right focus:outline-none focus:border-emerald-600"
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
                                            class="w-7 h-7 rounded-lg bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-500 hover:text-rose-600 font-bold text-xs flex items-center justify-center transition"
                                          >✕</button>
                                        </div>
                                      </li>
                                    `;
                                  }

                                  return `
                                    <li class="flex items-center justify-between gap-2 py-1.5">
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
                                          class="px-2 py-0.5 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-600 transition"
                                        >Sửa</button>
                                        <button
                                          type="button"
                                          onclick="ctpActions.removeExtraItem('${sh.id}', ${exIdx}, '${escapeHtml(ex.id || '')}')"
                                          title="Xóa khoản chi"
                                          class="w-6 h-6 rounded-md bg-slate-50 hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 font-bold text-[10px] flex items-center justify-center transition"
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

      <div class="lg:hidden p-3 bg-white border-t border-slate-200 shrink-0 flex items-center gap-2">
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

  return `
    <div onclick="ctpActions.closeBillModal()" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2.5 sm:p-4">
      <div onclick="event.stopPropagation()" id="ctp-bill-capture-area" class="bg-white w-full max-w-2xl rounded-3xl p-3 sm:p-5 space-y-2.5 text-xs shadow-2xl flex flex-col max-h-[90dvh]">
        <div class="flex justify-between items-center border-b pb-2 shrink-0">
          <div>
            <h3 class="font-black text-sm text-slate-900">BẢNG CTP THÁNG ${bm.month}/${state.selectedYear}</h3>
            <p class="text-[11px] text-slate-500">Nhân sự: <b>${escapeHtml(memberNickname)}</b> • Chủ show: <b class="text-emerald-700">${escapeHtml(bm.ownerTitle)}</b></p>
          </div>
          <button type="button" data-html2canvas-ignore="true" onclick="ctpActions.closeBillModal()" class="w-8 h-8 rounded-full bg-slate-100">✕</button>
        </div>

        <div class="flex-1 min-h-0 overflow-auto border border-slate-300 rounded-2xl">
          <table class="w-full border-collapse text-[11px]">
            <thead class="sticky top-0 bg-[#107c41] text-white font-extrabold text-[10px] uppercase">
              <tr>
                <th class="py-2 px-1 border">STT</th><th class="py-2 px-1 border">NGÀY</th><th class="py-2 px-1.5 border text-left">SHOW</th>
                <th class="py-2 px-1.5 border text-left">NHIỆM VỤ</th><th class="py-2 px-1 border text-left">PHÁT SINH</th><th class="py-2 px-1.5 border text-right">TỔNG</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${bm.rows.map(r => `
                <tr>
                  <td class="py-1.5 px-1 border text-center">${r.stt}</td>
                  <td class="py-1.5 px-1 border text-center font-mono">${escapeHtml(r.dateLabel)}</td>
                  <td class="py-1.5 px-1.5 border font-bold">${escapeHtml(r.location)}</td>
                  <td class="py-1.5 px-1.5 border">${r.taskBulletsCompact.map(escapeHtml).join('<br/>') || '-'}</td>
                  <td class="py-1.5 px-1 border">${r.extraBulletsCompact.map(escapeHtml).join('<br/>') || '-'}</td>
                  <td class="py-1.5 px-1.5 border text-right font-mono font-black text-emerald-700">${r.showSum.toLocaleString('vi-VN')}đ</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-slate-900 text-white font-mono font-black">
                <td colspan="5" class="py-2 px-2 text-right text-amber-300">TỔNG CỘNG:</td>
                <td class="py-2 px-1.5 text-right text-emerald-400">${bm.total.toLocaleString('vi-VN')}đ</td>
              </tr>
            </tfoot>
          </table>
        </div>

        ${qrUrl ? `
          <div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 shrink-0">
            <div class="text-[11px] space-y-0.5">
              <div class="font-black text-slate-900 uppercase">💳 QUÉT MÃ VIETQR THANH TOÁN CTP</div>
              <div>Ngân hàng: <b>${escapeHtml(getBankName(prof.bankBin))}</b></div>
              <div>Chủ TK: <b class="uppercase">${escapeHtml(bankHolderName)}</b></div>
              <div>Số TK: <b class="font-mono text-indigo-700">${escapeHtml(prof.bankAcc)}</b></div>
            </div>
            <img src="${qrUrl}" alt="VietQR" class="vietqr-img-el w-24 h-24 object-contain bg-white p-1 rounded-xl border border-slate-200" />
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
