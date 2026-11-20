import { state } from '../state/store.js';
import { ALL_YEARS, ADMIN_SWATCH_COLORS_30 } from '../config/constants.js';
import { escapeHtml, getMember, getSortedMembers, formatDayMonth } from '../utils/helpers.js';
import { isYearMonthLocked } from '../services/show.service.js';

function getFilteredAdminShows() {
  const q = String(state.adminSearch || '').trim().toLowerCase();
  const list = [...(state.shows || [])].sort((a, b) => {
    const ta = Number(a?.createdAt || a?.updatedAt || 0);
    const tb = Number(b?.createdAt || b?.updatedAt || 0);
    if (tb !== ta) return tb - ta;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });

  if (!q) return list;
  return list.filter(sh => {
    if (!sh) return false;
    const crew = (sh.memberIds || []).map(id => getMember(id).name).join(' ');
    const owner = sh.ownerId ? getMember(sh.ownerId).name : '';
    const hay = `${sh.location || ''} ${sh.partner || ''} ${owner} ${crew} ${sh.startDate || ''}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderAdminInspectModalHtml() {
  const showId = state.adminInspectShowId;
  if (!showId) return '';
  const sh = (state.shows || []).find(s => s && s.id === showId);
  if (!sh) return '';

  const ownerName = sh.ownerId ? getMember(sh.ownerId).name : 'Chưa gán';
  const creatorName = (sh.creatorId || sh.createdBy) ? getMember(sh.creatorId || sh.createdBy).name : 'Dữ liệu gốc';
  const crewList = (sh.memberIds || []).map(mid => {
    const m = getMember(mid);
    const r = Array.isArray(sh.roles?.[mid]) ? sh.roles[mid].join(', ') : (sh.roles?.[mid] || 'Tham gia');
    return `<div class="py-2 flex items-center justify-between text-xs"><span class="font-bold text-slate-900">${escapeHtml(m.name)}</span><span class="text-emerald-700 font-semibold">${escapeHtml(r)}</span></div>`;
  }).join('') || '<div class="py-2 text-slate-400">Chưa gán nhân sự</div>';

  return `
    <div onclick="adminProActions.closeInspectShow()" class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-md bg-white rounded-3xl p-5 space-y-3 text-xs shadow-2xl max-h-[88dvh] overflow-y-auto">
        <div class="flex items-start justify-between border-b border-slate-100 pb-2.5">
          <div>
            <div class="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Chi Tiết Show</div>
            <h3 class="text-base font-black text-slate-900 mt-0.5">${escapeHtml(sh.location || '')} ${sh.partner ? `<span class="text-slate-400 font-semibold">(${escapeHtml(sh.partner)})</span>` : ''}</h3>
          </div>
          <button onclick="adminProActions.closeInspectShow()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">✕</button>
        </div>

        <div class="divide-y divide-slate-100">
          <div class="py-2 flex justify-between"><span class="text-slate-400">Thời gian</span><span class="font-mono font-bold text-slate-900">${escapeHtml(formatDayMonth(sh.startDate))}${sh.endDate && sh.endDate !== sh.startDate ? ' → ' + escapeHtml(formatDayMonth(sh.endDate)) : ''}</span></div>
          <div class="py-2 flex justify-between"><span class="text-slate-400">Chủ show</span><span class="font-bold text-slate-900">${escapeHtml(ownerName)}</span></div>
          <div class="py-2 flex justify-between"><span class="text-slate-400">Người tạo</span><span class="font-bold text-slate-900">${escapeHtml(creatorName)}</span></div>
        </div>

        <div>
          <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">Ekip (${(sh.memberIds || []).length} người)</div>
          <div class="divide-y divide-slate-100">${crewList}</div>
        </div>

        ${sh.note ? `<div class="p-3 rounded-2xl bg-slate-50 text-slate-700"><b>Ghi chú:</b> ${escapeHtml(sh.note)}</div>` : ''}

        <div class="grid grid-cols-2 gap-2 pt-2">
          <button onclick="adminProActions.deleteShowFromAdmin('${escapeHtml(sh.id)}')" class="py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold">🗑️ Xóa Show</button>
          <button onclick="adminProActions.closeInspectShow()" class="py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold">Đóng</button>
        </div>
      </div>
    </div>
  `;
}

function renderOverviewTabHtml(membersSorted, filteredShows) {
  const activeShowsCount = (state.shows || []).filter(s => s && !s.isCancelled).length;
  const cancelledCount = (state.shows || []).filter(s => s && s.isCancelled).length;

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-3 gap-2.5">
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Tổng Show</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-1">${state.shows.length}</div>
        </div>
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Đang Chạy</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-emerald-600 mt-1">${activeShowsCount}</div>
        </div>
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">Đã Hủy</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-rose-600 mt-1">${cancelledCount}</div>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
        <div class="flex items-center justify-between">
          <span class="font-black text-xs uppercase tracking-wide text-slate-900">📊 Hiệu Suất Ekip (${membersSorted.length} người)</span>
          <span class="text-[10.5px] text-slate-400 font-semibold">Show đang chạy</span>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
          ${membersSorted.map(m => {
            const cnt = (state.shows || []).filter(s => s && !s.isCancelled && (s.memberIds || []).includes(m.id)).length;
            return `
              <div class="p-2.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-1">
                <span style="background:${m.bg};color:${m.text}" class="px-2 py-0.5 rounded-full text-[10px] font-black truncate">${escapeHtml(m.shortLabel)}</span>
                <span class="font-mono font-black text-slate-900 text-xs shrink-0">${cnt}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">📋 Danh Sách Show (${filteredShows.length})</div>
            <div class="text-[10.5px] text-slate-400">Bấm vào từng show để xem chi tiết hoặc xóa</div>
          </div>
          <input type="text" value="${escapeHtml(state.adminSearch)}" oninput="adminProActions.setAdminSearch(this.value)"
            placeholder="Tìm địa điểm, đối tác, ekip..." class="w-full sm:w-64 px-3.5 py-2 rounded-2xl bg-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <div class="max-h-72 overflow-y-auto custom-scroll divide-y divide-slate-100">
          ${filteredShows.length === 0
            ? `<div class="py-7 text-center text-slate-400">Chưa có dữ liệu show phù hợp</div>`
            : filteredShows.map((sh, i) => {
                const crew = (sh.memberIds || []).map(id => getMember(id).name).join(', ');
                return `
                  <div onclick="adminProActions.openInspectShow('${escapeHtml(sh.id)}')" class="py-2.5 px-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 truncate">
                        <span class="text-[10px] font-mono text-slate-400">#${i + 1}</span>
                        <span class="font-mono font-bold text-emerald-700">${escapeHtml(formatDayMonth(sh.startDate))}</span>
                        <span class="font-bold text-slate-900 truncate ${sh.isCancelled ? 'line-through text-rose-600' : ''}">${escapeHtml(sh.location || '')}</span>
                      </div>
                      <div class="text-[11px] text-slate-500 truncate mt-0.5">Ekip: ${escapeHtml(crew || 'Trống')}</div>
                    </div>
                    <span class="text-slate-400 font-bold text-sm">›</span>
                  </div>
                `;
              }).join('')}
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2">
        <div class="font-black text-xs uppercase tracking-wide text-slate-900">📜 Nhật Ký Hoạt Động (${state.activityLogs.length})</div>
        <div class="max-h-48 overflow-y-auto custom-scroll space-y-1.5">
          ${state.activityLogs.map(l => `
            <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-[11px]">
              <b class="font-mono text-slate-500">[${escapeHtml(l.time)}]</b>
              <b class="text-slate-900 ml-1">${escapeHtml(l.actor)}:</b>
              <span class="text-slate-700">${escapeHtml(l.text)}</span>
            </div>
          `).join('') || '<div class="text-slate-400 py-2">Chưa có nhật ký nào</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderCrewTabHtml(membersSorted) {
  const pinMap = state.memberPinHints || {};
  const editId = state.adminEditMemberId || null;
  const isAdding = !!state.adminAddMemberOpen;

  return `
    <div class="space-y-3.5">
      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div class="flex items-center justify-between gap-2">
          <div>
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">👥 Danh Sách Nhân Sự (${membersSorted.length})</div>
            <div class="text-[10.5px] text-slate-400">Bấm Sửa để chỉnh Tên, Màu, Cột, Mã PIN và Họ tên book vé</div>
          </div>
          <button onclick="adminProActions.toggleAddMemberForm()" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs shrink-0">
            ${isAdding ? '✕ Đóng' : '+ Thêm Nhân Sự'}
          </button>
        </div>

        ${isAdding ? `
          <div class="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2.5">
            <div class="font-black text-[11px] text-amber-900 uppercase">➕ Thêm Thành Viên Mới</div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input id="adm-add-name" type="text" placeholder="Tên gọi (VD: Minh, Huy...)" class="px-3 py-2 rounded-xl bg-white border text-xs font-bold" />
              <input id="adm-add-legal" type="text" placeholder="Họ tên CCCD / Book vé" class="px-3 py-2 rounded-xl bg-white border text-xs font-bold uppercase" />
              <div class="flex items-center gap-2">
                <input id="adm-add-color" type="color" value="#334155" class="w-9 h-9 rounded-xl border cursor-pointer shrink-0" />
                <input id="adm-add-order" type="number" min="1" max="50" value="${membersSorted.length + 1}" placeholder="Cột" class="w-16 px-2 py-2 rounded-xl bg-white border text-xs font-mono font-bold text-center" />
                <button onclick="adminProActions.addNewMember()" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs">Lưu Mới</button>
              </div>
            </div>
          </div>
        ` : ''}

        <div class="divide-y divide-slate-100">
          ${membersSorted.map((m, idx) => {
            const isEd = editId === m.id;
            const curPin = pinMap[m.id] || '1234';
            const legalVal = state.officialLegalNames?.[m.id] || '';
            const ord = m.order ?? (idx + 1);

            return `
              <div class="py-2.5">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    <span class="text-[10px] font-mono font-bold text-slate-400 w-5 text-center shrink-0">#${ord}</span>
                    <span style="background:${m.bg};color:${m.text || '#fff'}" class="px-2.5 py-1 rounded-xl text-[11px] font-black shrink-0">${escapeHtml(m.name)}</span>
                    <div class="min-w-0 flex-1">
                      <div class="text-[11px] font-bold text-slate-800 truncate">${escapeHtml(legalVal || 'Chưa nhập tên book vé')}</div>
                      <div class="text-[10px] font-mono text-slate-400 truncate">PIN: ${escapeHtml(curPin)} • ${escapeHtml(m.id)}@actionsay.local</div>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button onclick="adminProActions.toggleEditMember('${escapeHtml(m.id)}')" class="px-3 py-1.5 rounded-xl font-bold text-[11px] ${isEd ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
                      ${isEd ? 'Đóng' : '✏️ Sửa'}
                    </button>
                    <button onclick="adminProActions.deleteMemberFromAdmin('${escapeHtml(m.id)}')" title="Xóa nhân sự" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold flex items-center justify-center">🗑️</button>
                  </div>
                </div>

                ${isEd ? `
                  <div class="mt-2.5 p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase">Tên hiển thị</label>
                        <input id="adm-ed-name-${escapeHtml(m.id)}" type="text" value="${escapeHtml(m.name)}" class="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-white border text-xs font-bold" />
                      </div>
                      <div>
                        <label class="text-[10px] font-bold text-slate-500 uppercase">Họ tên book vé (CCCD)</label>
                        <input id="adm-ed-legal-${escapeHtml(m.id)}" type="text" value="${escapeHtml(legalVal)}" placeholder="NGUYỄN VĂN A" class="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-white border text-xs font-bold uppercase" />
                      </div>
                      <div class="flex items-end gap-2">
                        <div class="flex-1">
                          <label class="text-[10px] font-bold text-slate-500 uppercase">Thứ tự cột</label>
                          <input id="adm-ed-ord-${escapeHtml(m.id)}" type="number" min="1" max="50" value="${ord}" class="w-full mt-1 px-2.5 py-1.5 rounded-xl bg-white border text-xs font-mono font-bold text-center" />
                        </div>
                        <div>
                          <label class="text-[10px] font-bold text-slate-500 uppercase block">Màu</label>
                          <input id="adm-ed-col-${escapeHtml(m.id)}" type="color" value="${m.bg || '#334155'}" class="w-9 h-8 mt-1 rounded-xl border cursor-pointer" />
                        </div>
                      </div>
                    </div>

                    <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70">
                      <div class="flex items-center gap-1.5">
                        <span class="text-[10px] font-bold text-slate-500 uppercase">Mã PIN:</span>
                        <input id="adm-ed-pin-${escapeHtml(m.id)}" type="text" inputmode="numeric" maxlength="4" value="${escapeHtml(curPin)}" class="w-16 px-2 py-1.5 rounded-xl bg-white border font-mono font-black text-center text-xs" />
                        <button type="button" onclick="adminProActions.resetMemberPinDefault('${escapeHtml(m.id)}')" class="px-2.5 py-1.5 rounded-xl bg-white border text-slate-600 font-bold text-[10.5px]">Reset 1234</button>
                        <button type="button" onclick="adminProActions.copyAuthPassForMember('${escapeHtml(m.id)}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10.5px]">Copy Pass</button>
                      </div>
                      <button type="button" onclick="adminProActions.saveMemberAllInOne('${escapeHtml(m.id)}')" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs">
                        💾 Lưu Thay Đổi
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderPricingAndColorsTabHtml() {
  const rates = state.ctpRatesConfig || {};
  const rules = state.customColorRules || [];
  const pickedNewHex = state.adminNewColorHex || '#bbf7d0';

  return `
    <div class="space-y-4">
      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">💰 Đơn Giá CTP Mặc Định</div>
            <div class="text-[10.5px] text-slate-400">Áp dụng khi bật nhiệm vụ ở tab Tính CTP</div>
          </div>
          <button onclick="adminProActions.saveCtpRates()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">💾 Lưu Giá</button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[11px]">
          <div><b>🎥 Quay 1n:</b><input id="adm-r-quay1" type="text" value="${Number(rates.quay1Day || 1500000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>🎥 Quay ≥2n:</b><input id="adm-r-quayN" type="text" value="${Number(rates.quayMultiDay || 1200000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>📸 Chụp 1n:</b><input id="adm-r-chup1" type="text" value="${Number(rates.chup1Day || 1500000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>📸 Chụp ≥2n:</b><input id="adm-r-chupN" type="text" value="${Number(rates.chupMultiDay || 1200000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>✂️ Dựng:</b><input id="adm-r-dung" type="text" value="${Number(rates.dung || 1000000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>🚁 Flycam:</b><input id="adm-r-flycam" type="text" value="${Number(rates.flycam || 1000000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>🖼️ Làm hình:</b><input id="adm-r-lamhinh" type="text" value="${Number(rates.lamhinh || 300000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
          <div><b>⚖️ Gimbal:</b><input id="adm-r-gimbal" type="text" value="${Number(rates.gimbal || 200000).toLocaleString('vi-VN')}" class="w-full mt-1 px-2.5 py-1.5 border rounded-xl font-mono font-bold bg-slate-50" /></div>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">🎨 Màu Địa Điểm (Tự Động 30 Màu Pastel)</div>
            <div class="text-[10.5px] text-slate-400">Mặc định hệ thống tự tô 30 màu pastel. Chỉ thêm bên dưới nếu muốn gán màu riêng cho địa điểm đặc biệt.</div>
          </div>
          <button onclick="adminProActions.saveAndApplyColors()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">💾 Lưu &amp; Áp Dụng Màu</button>
        </div>

        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2.5">
          <div class="flex gap-2">
            <input id="adm-new-col-kw" type="text" placeholder="Nhập địa điểm muốn đổi màu riêng (VD: Mũi Né, Phú Quốc...)" class="flex-1 px-3 py-2 border rounded-xl font-bold bg-white text-xs" />
            <input id="adm-new-col-hex" type="color" value="${pickedNewHex}" onchange="adminProActions.pickNewColorSwatch(this.value)" class="w-9 h-9 rounded-xl border cursor-pointer shrink-0 bg-white p-0.5" />
            <button onclick="adminProActions.addColorRule()" class="px-3.5 py-2 rounded-xl bg-slate-900 text-amber-400 font-black text-xs shrink-0">+ Thêm</button>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span class="text-[10px] font-bold text-slate-400 mr-1">Chọn nhanh:</span>
            ${ADMIN_SWATCH_COLORS_30.map(hex => `
              <button type="button" onclick="adminProActions.pickNewColorSwatch('${hex}')" title="${hex}"
                style="background:${hex}"
                class="w-5 h-5 rounded-full border ${pickedNewHex.toLowerCase() === hex.toLowerCase() ? 'ring-2 ring-slate-900 border-slate-900 scale-110' : 'border-black/15'} transition-transform cursor-pointer"></button>
            `).join('')}
          </div>
        </div>

        ${rules.length > 0 ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            ${rules.map((r, idx) => `
              <div style="background:${r.color}" class="px-2.5 py-1.5 rounded-2xl border border-black/10 flex items-center gap-2">
                <input type="color" value="${r.color}" onchange="adminProActions.updateColorRule(${idx}, 'color', this.value)" class="w-6 h-6 rounded-full border cursor-pointer shrink-0 bg-transparent" />
                <input type="text" value="${escapeHtml(r.keyword || '')}" oninput="adminProActions.updateColorRule(${idx}, 'keyword', this.value)" class="flex-1 min-w-0 px-2 py-1 rounded-xl bg-white/85 font-bold text-slate-900 text-[11px]" />
                <button onclick="adminProActions.removeColorRule(${idx})" class="w-6 h-6 rounded-full bg-white/85 hover:bg-white text-rose-600 font-black text-[10px] shrink-0">✕</button>
              </div>
            `).join('')}
          </div>
        ` : `<div class="text-[11px] text-slate-400 italic px-1">Chưa có địa điểm tùy chỉnh riêng — tất cả đang tự động dùng bảng 30 màu pastel.</div>`}
      </div>
    </div>
  `;
}

function renderSystemTabHtml() {
  const lockYear = Number(state.adminLockViewYear) || 2026;
  const trash = state.deletedShowsTrash || [];
  const bc = state.studioBroadcast || { enabled: false, text: '' };
  const curLogo = state.customLogoDataUrl || './assets/logo.png';

  return `
    <div class="space-y-4">
      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div>
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">🖼️ Đổi Logo Studio</div>
          <div class="text-[10.5px] text-slate-400 mt-0.5">Chọn ảnh logo mới từ máy để cập nhật ngay trên Header &amp; ứng dụng</div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            <img src="${escapeHtml(curLogo)}" alt="Logo" class="w-full h-full object-contain" />
          </div>
          <button onclick="adminProActions.triggerLogoUpload()" class="px-3.5 py-2 rounded-xl bg-slate-900 text-amber-400 font-black text-xs">📤 Chọn Ảnh Logo Mới</button>
          ${state.customLogoDataUrl ? `<button onclick="adminProActions.resetLogoDefault()" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">↩ Dùng Logo Mặc Định</button>` : ''}
          <input id="adm-logo-file-input" type="file" accept="image/*" onchange="adminProActions.handleLogoUpload(this)" class="hidden" />
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div>
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">💾 Sao Lưu &amp; Backup Dữ Liệu (.JSON)</div>
          <div class="text-[10.5px] text-slate-400 mt-0.5">Tải file backup toàn bộ shows, cấu hình, PIN &amp; màu sắc về máy hoặc nạp lại từ file .JSON</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button onclick="adminProActions.exportFullJsonBackup()" class="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs">⬇️ Tải File Backup (.JSON)</button>
          <button onclick="adminProActions.triggerRestoreJsonFile()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs">⬆️ Khôi Phục Từ File (.JSON)</button>
          <button onclick="adminProActions.copyFullJsonToClipboard()" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs">📋 Copy JSON</button>
          <input id="adm-restore-json-input" type="file" accept=".json,application/json" onchange="adminProActions.handleRestoreJsonFile(this)" class="hidden" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">🛡️ Khóa Bảo Trì (Maintenance Mode)</div>
          <p class="text-[11px] text-slate-500">Bật khi cần khóa tạm quyền Nổ Show / sửa / xóa của thành viên để đối soát.</p>
          <button onclick="adminProActions.toggleMaintenanceMode()" class="px-4 py-2 rounded-xl font-black text-white ${state.readonlyMaintenanceMode ? 'bg-emerald-600' : 'bg-rose-600'}">
            ${state.readonlyMaintenanceMode ? '🔓 Tắt Khóa Bảo Trì' : '🛡️ Bật Khóa Bảo Trì'}
          </button>
        </div>

        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">📅 Bật / Ẩn Năm Hiển Thị</div>
          <p class="text-[11px] text-slate-500">Chọn các năm xuất hiện trên thanh chọn đầu ứng dụng.</p>
          <div class="flex flex-wrap gap-1.5">
            ${ALL_YEARS.map(yr => `<button onclick="adminProActions.toggleYear(${yr})" class="px-3 py-1 rounded-full font-black border ${state.visibleYears.includes(yr) ? 'bg-slate-900 text-amber-400' : 'bg-slate-50 text-slate-500'}">${yr}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">🔒 Khóa Sổ Tháng (${lockYear})</div>
            <div class="flex gap-1 bg-slate-100 p-0.5 rounded-full">
              ${ALL_YEARS.map(yr => `<button onclick="adminProActions.setLockViewYear(${yr})" class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${lockYear === yr ? 'bg-slate-900 text-amber-400' : 'text-slate-600'}">${yr}</button>`).join('')}
            </div>
          </div>
          <div class="grid grid-cols-6 gap-1.5">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
              const locked = isYearMonthLocked(lockYear, m);
              return `<button onclick="adminProActions.toggleLockMonthAdmin(${m})" class="py-1.5 rounded-xl font-extrabold text-[10.5px] border ${locked ? 'bg-rose-50 text-rose-600 border-rose-300' : 'bg-slate-50 text-slate-700 border-slate-200'}">${locked ? '🔒' : '🔓'} T${m}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">📢 Thông Báo Ghim Đầu App</div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${bc.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}">${bc.enabled ? 'ĐANG PHÁT' : 'ĐANG TẮT'}</span>
          </div>
          <input id="adm-broadcast-inp" type="text" value="${escapeHtml(bc.text || '')}" placeholder="VD: Chốt bill CTP tháng trước ngày 03..." class="w-full px-3 py-2 rounded-xl bg-slate-50 border font-bold" />
          <div class="flex gap-2">
            <button onclick="adminProActions.publishBroadcast()" class="flex-1 py-2 rounded-xl bg-rose-600 text-white font-black">📢 Lưu &amp; Phát Ngay</button>
            ${bc.enabled ? `<button onclick="adminProActions.disableBroadcast()" class="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold">🔕 Tắt</button>` : ''}
          </div>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
        <div class="font-black text-xs uppercase tracking-wide text-slate-900">♻️ Thùng Rác Khôi Phục Show Đã Xóa (${trash.length})</div>
        <div class="space-y-1.5 max-h-44 overflow-y-auto custom-scroll">
          ${trash.length === 0
            ? `<div class="text-slate-400">Thùng rác trống.</div>`
            : trash.map(sh => `
                <div class="p-2.5 rounded-xl bg-slate-50 border flex items-center justify-between gap-2">
                  <span class="font-bold truncate">📍 ${escapeHtml(sh.location)} (${escapeHtml(formatDayMonth(sh.startDate))})</span>
                  <button onclick="adminProActions.restoreDeletedShow('${escapeHtml(sh.id)}')" class="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-[10.5px] shrink-0">↩ Khôi phục</button>
                </div>
              `).join('')}
        </div>
      </div>
    </div>
  `;
}

export function renderAdminPortalHtml() {
  if (!state.isAdminMode) {
    return `
      <div class="w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h2 class="font-black text-sm text-amber-400 uppercase">Đăng Nhập Studio Control (Admin)</h2>
          ${state.adminLoginInput.error ? `<div class="text-rose-400 text-xs font-bold">${escapeHtml(state.adminLoginInput.error)}</div>` : ''}
          <input type="email" value="${escapeHtml(state.adminLoginInput.email)}" placeholder="Email Admin" oninput="state.adminLoginInput.email = this.value" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white" />
          <input type="password" value="${escapeHtml(state.adminLoginInput.password)}" placeholder="Mật khẩu Firebase Auth" oninput="state.adminLoginInput.password = this.value" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white" />
          <button onclick="appActions.submitBackendAdminLogin()" class="w-full bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs">Đăng Nhập Quản Trị</button>
          <button onclick="appActions.exitBackendPortal()" class="w-full text-slate-400 text-xs py-1">← Quay lại Lịch Show</button>
        </div>
      </div>
    `;
  }

  const membersSorted = getSortedMembers();
  const filteredShows = getFilteredAdminShows();
  const curAdminTab = state.adminTab || 'overview';

  const tabs = [
    { id: 'overview', label: '📊 Tổng Quan' },
    { id: 'crew',     label: '👥 Nhân Sự' },
    { id: 'pricing',  label: '⚙️ Thiết Lập' },
    { id: 'system',   label: '🛡️ Hệ Thống' }
  ];

  let bodyHtml = '';
  if (curAdminTab === 'crew') bodyHtml = renderCrewTabHtml(membersSorted);
  else if (curAdminTab === 'pricing') bodyHtml = renderPricingAndColorsTabHtml();
  else if (curAdminTab === 'system') bodyHtml = renderSystemTabHtml();
  else bodyHtml = renderOverviewTabHtml(membersSorted, filteredShows);

  return `
    <div class="w-full h-[100dvh] bg-[#f4f5f7] text-slate-900 flex flex-col overflow-hidden">
      <header class="bg-white border-b border-slate-200 px-4 py-3 shrink-0 space-y-2.5">
        <div class="max-w-5xl w-full mx-auto flex items-center justify-between gap-2">
          <div>
            <div class="font-black text-sm uppercase tracking-tight text-slate-900">Studio Control</div>
            <div class="text-[11px] text-slate-400 font-medium">${state.shows.length} Shows • Action Media x Say Studios</div>
          </div>
          <div class="flex gap-2">
            <button onclick="adminProActions.exportFullJsonBackup()" class="px-3 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs">💾 Backup</button>
            <button onclick="appActions.exitBackendPortal()" class="px-3.5 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs">← Về App</button>
          </div>
        </div>

        <div class="max-w-5xl w-full mx-auto bg-slate-100 p-1 rounded-2xl grid grid-cols-4 gap-1 text-xs">
          ${tabs.map(t => `
            <button onclick="adminProActions.setAdminTab('${t.id}')" class="py-2 px-2 rounded-xl font-extrabold truncate transition-all ${curAdminTab === t.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">${t.label}</button>
          `).join('')}
        </div>
      </header>

      <div class="flex-1 overflow-y-auto custom-scroll p-4 max-w-5xl w-full mx-auto text-xs pb-16">
        ${bodyHtml}
      </div>

      ${renderAdminInspectModalHtml()}
    </div>
  `;
}
