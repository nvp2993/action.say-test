import { state } from '../state/store.js';
import { escapeHtml, formatDayMonth, getMember, getShowDays, buildVietQrUrl, getBankName } from '../utils/helpers.js';
import { getVisiblePartnerText } from '../services/show.service.js';
import { getCombinedCtpShows, getDefaultRateForTask } from '../services/finance.service.js';
import { renderUnifiedDateBarHtml } from './header.ui.js';

export function renderCtpTabHtml() {
  const curMem = getMember(state.currentUserId);
  const filteredShows = getCombinedCtpShows();
  let grandTotal = 0;
  filteredShows.forEach(sh => {
    const it = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
    Object.entries(it.tasks || {}).forEach(([, v]) => {
      if (v !== null && v !== undefined) grandTotal += (Number(v) || 0);
    });
    (it.extras || []).forEach(ex => { grandTotal += (Number(ex.amount) || 0); });
  });

  return `
    <div class="flex-1 flex flex-col min-h-0 bg-slate-100 text-xs">
      <div class="bg-white px-3 py-2.5 border-b border-slate-200 shrink-0 space-y-2">
        <div class="flex items-center justify-between gap-2">
          <span class="font-black text-xs text-slate-900 uppercase truncate">💼 CTP (${escapeHtml(curMem.name)})</span>
          <span class="text-[10px] font-bold text-slate-400">Năm ${state.selectedYear}</span>
        </div>
        ${renderUnifiedDateBarHtml('ctp')}
        <div class="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
          <div class="flex items-center gap-1.5 flex-1 min-w-0">
            <span class="text-[10px] font-bold text-slate-500 shrink-0">Chủ show:</span>
            <select onchange="ctpActions.setOwner(this.value)" class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">
              <option value="all">Tất cả Chủ Show</option>
              ${state.members.filter(m => m.id !== state.currentUserId).map(m => `<option value="${m.id}" ${state.ctpOwnerId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
            </select>
          </div>
          <div onclick="appActions.toggleHideMoneyMode()" class="text-right bg-emerald-50 px-3 py-1 rounded-2xl border border-emerald-200 shrink-0 cursor-pointer">
            <span class="text-[8.5px] text-emerald-700 font-bold uppercase block">Tổng T${state.ctpMonth}</span>
            <span id="ctp-grand-total-display" class="text-xs font-black text-emerald-700 font-mono">${state.hideMoneyMode ? '••••••đ 👁️' : grandTotal.toLocaleString('vi-VN') + 'đ'}</span>
          </div>
        </div>
      </div>

      <div id="ctp-shows-scroll-list" class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 space-y-3">
        ${filteredShows.length === 0 ? `
          <div class="text-center py-12 bg-white rounded-3xl border border-slate-200 mx-auto max-w-sm space-y-3 p-4">
            <div class="text-3xl">📭</div>
            <div class="text-slate-800 font-bold text-xs">Chưa có show nào trong tháng T${state.ctpMonth}</div>
            <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="px-4 py-2.5 bg-indigo-600 text-white rounded-full text-xs font-extrabold">Tự note thêm show ngoài</button>
          </div>
        ` : filteredShows.map((sh, idx) => {
          const item = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
          const days = getShowDays(sh);
          const owner = getMember(sh.ownerId);
          const activeTaskSum = Object.entries(item.tasks || {}).reduce((s, [, v]) => (v !== null && v !== undefined) ? s + (Number(v) || 0) : s, 0);
          const extraSum = (item.extras || []).reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
          const subTotal = activeTaskSum + extraSum;
          const isPrivateShow = Boolean(sh.hidePartner || sh.isPrivate);
          const partnerText = getVisiblePartnerText(sh);

          const taskList = ['quay', 'dung', 'chup', 'lamhinh', 'flycam', 'gimbal'].map(k => ({
            key: k,
            label: { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Làm hình', flycam: 'Flycam', gimbal: 'Gimbal' }[k],
            def: getDefaultRateForTask(k, sh)
          }));

          return `
            <div class="bg-white rounded-3xl border border-slate-200 p-4 space-y-3">
              <div class="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                <div class="min-w-0 flex-1">
                  <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono font-bold text-[10px]">#${idx + 1}</span>
                  <span class="font-mono font-bold text-indigo-600 text-[10px] ml-1">${formatDayMonth(sh.startDate)} (${days}n)</span>
                  <h4 class="font-black text-slate-900 text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                    <span>📍 ${escapeHtml(sh.location)}</span>
                    ${partnerText ? `<span class="text-slate-600 font-bold">(${escapeHtml(partnerText)})</span>` : ''}
                    ${isPrivateShow ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold">🔒 Riêng tư</span>` : ''}
                    ${sh.isHold ? `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-extrabold">⏳ Giữ lịch</span>` : ''}
                  </h4>
                  <p class="text-[10px] text-slate-500 mt-0.5">Chủ show: <b class="text-slate-700">${escapeHtml(owner.name)}</b></p>
                </div>
                <div class="text-right shrink-0 bg-emerald-50 px-3 py-1.5 rounded-2xl border border-emerald-200">
                  <span class="text-[9px] text-emerald-700 font-bold block">Tổng Show</span>
                  <span id="ctp-show-total-${sh.id}" class="text-xs font-black text-emerald-700 font-mono">${subTotal.toLocaleString('vi-VN')}đ</span>
                </div>
              </div>

              <div class="flex flex-wrap gap-1.5">
                ${taskList.map(t => {
                  const checked = item.tasks?.[t.key] !== undefined && item.tasks?.[t.key] !== null;
                  const val = checked ? item.tasks[t.key] : t.def;
                  return `
                    <div class="inline-flex flex-col items-start">
                      <button type="button" onclick="ctpActions.toggleTask('${sh.id}', '${t.key}')" class="px-3 py-1.5 rounded-full text-[10.5px] font-extrabold border transition ${checked ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200'}">
                        ${t.label}
                      </button>
                      ${checked ? `<input type="tel" inputmode="numeric" value="${Number(val).toLocaleString('vi-VN')}" oninput="ctpActions.handleTaskPriceInput('${sh.id}', '${t.key}', this)" class="mt-1 w-24 px-2 py-0.5 bg-indigo-50 border border-indigo-300 rounded-lg text-[10px] font-mono font-black text-right" />` : ''}
                    </div>
                  `;
                }).join('')}
              </div>

              <div class="space-y-2 pt-1 border-t border-slate-100">
                <div class="flex items-center justify-between">
                  <span class="text-[10px] font-black text-slate-400 uppercase">Phát Sinh:</span>
                  <button type="button" onclick="ctpActions.addExtraItem('${sh.id}')" class="px-2.5 py-1 bg-slate-100 text-indigo-600 rounded-xl text-[10px] font-black">Thêm phí</button>
                </div>
                ${(item.extras || []).map((ex, exIdx) => `
                  <div class="flex items-center gap-1.5">
                    <input type="text" value="${escapeHtml(ex.name || '')}" oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'name', this)" placeholder="Tên phí..." class="flex-1 min-w-0 px-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs font-bold" />
                    <input type="tel" inputmode="numeric" value="${ex.amount ? Number(ex.amount).toLocaleString('vi-VN') : ''}" oninput="ctpActions.saveExtraField('${sh.id}', ${exIdx}, 'amount', this)" placeholder="Số tiền" class="w-28 sm:w-32 px-2.5 py-1.5 bg-slate-50 border rounded-xl text-xs font-mono font-black text-right shrink-0" />
                    <button type="button" onclick="ctpActions.removeExtraItem('${sh.id}', ${exIdx})" class="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 font-bold shrink-0">✕</button>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }).join('')}

        ${filteredShows.length > 0 ? `
          <div class="space-y-2 pb-2">
            <button type="button" onclick="ctpActions.openAddCustomShowModal()" class="w-full py-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white text-slate-700 font-extrabold text-xs">Tự note thêm Show ngoài lịch</button>
            <button type="button" onclick="ctpActions.autoFillFromRoles()" class="w-full py-2.5 rounded-3xl bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs">⚡ Tự điền nhanh CTP theo vai trò đã gắn</button>
          </div>
        ` : ''}
      </div>

      <div class="p-3 bg-white border-t border-slate-200 shrink-0 flex items-center gap-2">
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
  const fullLegalName = (prof.fullName || bm.memberName).trim();
  const qrUrl = prof.bankAcc ? buildVietQrUrl(prof.bankBin, prof.bankAcc) : '';

  return `
    <div onclick="ctpActions.closeBillModal()" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2.5 sm:p-4">
      <div onclick="event.stopPropagation()" id="ctp-bill-capture-area" class="bg-white w-full max-w-2xl rounded-3xl p-3 sm:p-5 space-y-2.5 text-xs shadow-2xl flex flex-col max-h-[90dvh]">
        <div class="flex justify-between items-center border-b pb-2 shrink-0">
          <div>
            <h3 class="font-black text-sm text-slate-900">BẢNG CTP THÁNG ${bm.month}/${state.selectedYear}</h3>
            <p class="text-[11px] text-slate-500">Nhân sự: <b>${escapeHtml(fullLegalName)}</b> • Chủ show: <b class="text-emerald-700">${escapeHtml(bm.ownerTitle)}</b></p>
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
          <div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 shrink-0">
            <div class="text-[11px] space-y-0.5">
              <div class="font-black text-emerald-900 uppercase">💳 QUÉT MÃ VIETQR THANH TOÁN CTP</div>
              <div>Ngân hàng: <b>${escapeHtml(getBankName(prof.bankBin))}</b></div>
              <div>Chủ TK: <b class="uppercase">${escapeHtml(fullLegalName)}</b></div>
              <div>Số TK: <b class="font-mono text-indigo-700">${escapeHtml(prof.bankAcc)}</b></div>
            </div>
            <img src="${qrUrl}" alt="VietQR" class="vietqr-img-el w-24 h-24 object-contain bg-white p-1 rounded-xl border" />
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
