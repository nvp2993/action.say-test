import { state } from '../state/store.js';
import { ALL_YEARS, ADMIN_SWATCH_COLORS_30 } from '../config/constants.js';
import { escapeHtml, getMember, getSortedMembers, formatDayMonth } from '../utils/helpers.js';
import { isYearMonthLocked } from '../services/show.service.js';

const DEFAULT_STUDIO_LOGO = './assets/logo.png';
const FALLBACK_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-weight='900' font-size='22' fill='%23fbbf24'%3EA%C3%97S%3C/text%3E%3C/svg%3E";

function getAdminLogoSrc() {
  const custom =
    state.customLogoDataUrl ||
    state.customLogoUrl ||
    state.studioLogoUrl ||
    (() => {
      try {
        return localStorage.getItem('as_custom_logo_2026') || '';
      } catch {
        return '';
      }
    })();

  if (
    custom &&
    (custom.startsWith('data:image/') ||
      custom.startsWith('http://') ||
      custom.startsWith('https://') ||
      custom.startsWith('./') ||
      custom.startsWith('/'))
  ) {
    return custom;
  }
  return DEFAULT_STUDIO_LOGO;
}

function getShowCreatedTimestamp(sh) {
  const raw = sh?.createdAt ?? sh?.updatedAt ?? 0;
  if (typeof raw === 'number') return raw;
  if (raw && typeof raw.toMillis === 'function') return raw.toMillis();
  if (raw && typeof raw.seconds === 'number') return raw.seconds * 1000;
  const parsed = Date.parse(String(raw || ''));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getLocalDateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCreatedDayKey(ts) {
  const d = ts ? new Date(ts) : new Date();
  if (Number.isNaN(d.getTime())) return 'unknown';
  return getLocalDateKey(d);
}

function formatCreatedDayHeader(dayKey) {
  if (!dayKey || dayKey === 'unknown') return { label: 'KHÔNG RÕ NGÀY NHẬP', isToday: false };
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const [y, m, d] = dayKey.split('-');
  if (dayKey === todayKey) {
    return { label: `HÔM NAY • ${Number(d)}/${Number(m)}`, isToday: true };
  }
  return { label: `${d}/${m}/${y}`, isToday: false };
}

function formatCreatedTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getFilteredAdminShows() {
  const q = String(state.adminSearch || '').trim().toLowerCase();
  const list = [...(state.shows || [])].sort((a, b) => {
    const ta = getShowCreatedTimestamp(a);
    const tb = getShowCreatedTimestamp(b);
    if (tb !== ta) return tb - ta;
    return String(b?.id || '').localeCompare(String(a?.id || ''));
  });

  if (!q) return list;
  return list.filter(sh => {
    if (!sh) return false;
    const crew = (sh.memberIds || []).map(id => getMember(id).name).join(' ');
    const ext = (sh.externalCrew || []).map(p => p?.name || '').join(' ');
    const owner = sh.ownerId ? getMember(sh.ownerId).name : '';
    const creator = (sh.creatorId || sh.createdBy) ? getMember(sh.creatorId || sh.createdBy).name : '';
    const hay = `${sh.location || ''} ${sh.partner || ''} ${owner} ${creator} ${crew} ${ext} ${sh.startDate || ''}`.toLowerCase();
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
  }).join('');

  const extList = (sh.externalCrew || []).map((ext, idx) => {
    const label = String(ext?.name || '').trim() || `NS ${idx + 1}`;
    const r = Array.isArray(ext?.roles) && ext.roles.length ? ext.roles.join(', ') : 'Freelancer';
    return `<div class="py-2 flex items-center justify-between text-xs"><span class="font-bold text-indigo-900">🤝 ${escapeHtml(label)}</span><span class="text-indigo-700 font-semibold">${escapeHtml(r)}</span></div>`;
  }).join('');

  const combinedCrewHtml = (crewList + extList) || '<div class="py-2 text-slate-400">Chưa gán nhân sự</div>';
  const totalCrewCount = (sh.memberIds || []).length + (sh.externalCrew || []).length;

  return `
    <div onclick="adminProActions.closeInspectShow()" class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-md bg-white rounded-3xl p-5 space-y-3 text-xs shadow-2xl max-h-[88dvh] overflow-y-auto">
        <div class="flex items-start justify-between border-b border-slate-100 pb-2.5">
          <div>
            <div class="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Chi Tiết Show</div>
            <h3 class="text-base font-black text-slate-900 mt-0.5">${escapeHtml(sh.location || '')} ${sh.partner ? `<span class="text-slate-400 font-semibold">(${escapeHtml(sh.partner)})</span>` : ''}</h3>
          </div>
          <button type="button" onclick="adminProActions.closeInspectShow()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">✕</button>
        </div>

        <div class="divide-y divide-slate-100">
          <div class="py-2 flex justify-between"><span class="text-slate-400">Thời gian</span><span class="font-mono font-bold text-slate-900">${escapeHtml(formatDayMonth(sh.startDate))}${sh.endDate && sh.endDate !== sh.startDate ? ' → ' + escapeHtml(formatDayMonth(sh.endDate)) : ''}</span></div>
          <div class="py-2 flex justify-between"><span class="text-slate-400">Chủ show</span><span class="font-bold text-slate-900">${escapeHtml(ownerName)}</span></div>
          <div class="py-2 flex justify-between"><span class="text-slate-400">Người tạo</span><span class="font-bold text-slate-900">${escapeHtml(creatorName)}</span></div>
        </div>

        <div>
          <div class="text-[10px] font-bold text-slate-400 uppercase mb-1">Ekip (${totalCrewCount} người)</div>
          <div class="divide-y divide-slate-100">${combinedCrewHtml}</div>
        </div>

        ${sh.note ? `<div class="p-3 rounded-2xl bg-slate-50 text-slate-700"><b>Ghi chú:</b> ${escapeHtml(sh.note)}</div>` : ''}

        <div class="grid grid-cols-2 gap-2 pt-2">
          <button type="button" onclick="adminProActions.deleteShowFromAdmin('${escapeHtml(sh.id)}')" class="py-2.5 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold">🗑️ Xóa Show</button>
          <button type="button" onclick="adminProActions.closeInspectShow()" class="py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold">Đóng</button>
        </div>
      </div>
    </div>
  `;
}

function renderGroupedShowsByCreatedDayHtml(filteredShows) {
  if (!filteredShows.length) {
    return `<div class="py-7 text-center text-slate-400">Chưa có dữ liệu show phù hợp</div>`;
  }

  const groups = [];
  const groupMap = new Map();

  filteredShows.forEach((sh) => {
    const ts = getShowCreatedTimestamp(sh);
    const dayKey = getCreatedDayKey(ts);
    if (!groupMap.has(dayKey)) {
      const grp = { dayKey, items: [] };
      groupMap.set(dayKey, grp);
      groups.push(grp);
    }
    groupMap.get(dayKey).items.push(sh);
  });

  let runningIdx = 0;

  return groups.map((grp) => {
    const hdr = formatCreatedDayHeader(grp.dayKey);
    const headerCls = hdr.isToday
      ? 'bg-emerald-50/90 text-emerald-700 border border-emerald-200/70'
      : 'bg-slate-100/90 text-slate-600 border border-slate-200/60';

    const rowsHtml = grp.items.map((sh) => {
      runningIdx += 1;
      const ts = getShowCreatedTimestamp(sh);
      const timeStr = formatCreatedTime(ts);
      const creatorId = sh.creatorId || sh.createdBy || sh.ownerId;
      const creatorName = creatorId ? getMember(creatorId).name : 'Hệ thống';

      const internalCrew = (sh.memberIds || []).map(id => getMember(id).name);
      const externalCrew = (sh.externalCrew || []).map((p, idx) => String(p?.name || '').trim() || `NS ${idx + 1}`);
      const crewStr = [...internalCrew, ...externalCrew].join(', ') || 'Trống';

      const startFmt = formatDayMonth(sh.startDate);
      const endFmt = sh.endDate && sh.endDate !== sh.startDate ? formatDayMonth(sh.endDate) : '';
      const dateRangeHtml = endFmt
        ? `<span class="font-mono font-bold text-emerald-700 shrink-0">${escapeHtml(startFmt)}→${escapeHtml(endFmt)}</span>`
        : `<span class="font-mono font-bold text-emerald-700 shrink-0">${escapeHtml(startFmt)}</span>`;

      return `
        <div onclick="adminProActions.openInspectShow('${escapeHtml(sh.id)}')" class="py-2.5 px-2.5 flex items-center justify-between gap-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-[10.5px] font-mono text-slate-400 shrink-0">#${runningIdx}</span>
              ${dateRangeHtml}
              <span class="font-extrabold text-slate-900 truncate ${sh.isCancelled ? 'line-through text-rose-600' : ''}">${escapeHtml(sh.location || '')}</span>
              ${sh.partner ? `<span class="text-slate-400 font-semibold text-[11px] truncate">(${escapeHtml(sh.partner)})</span>` : ''}
            </div>
            <div class="text-[11px] text-slate-500 truncate mt-0.5 pl-4">
              ${timeStr ? `<span class="font-mono text-slate-400">${escapeHtml(timeStr)}</span> • ` : ''}Nhập: <b class="text-emerald-700 font-bold">${escapeHtml(creatorName)}</b> • Ekip: <span class="text-slate-700 font-medium">${escapeHtml(crewStr)}</span>
            </div>
          </div>
          <span class="text-slate-400 font-bold text-sm shrink-0">›</span>
        </div>
      `;
    }).join('');

    return `
      <div class="space-y-1 pt-1">
        <div class="px-3 py-1.5 rounded-xl flex items-center justify-between text-[11px] font-black uppercase tracking-wide ${headerCls}">
          <span class="inline-flex items-center gap-1.5">
            ${hdr.isToday ? `<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>` : ''}
            <span>${escapeHtml(hdr.label)}</span>
          </span>
          <span class="font-mono font-bold text-slate-500">${grp.items.length}</span>
        </div>
        <div class="divide-y divide-slate-100">
          ${rowsHtml}
        </div>
      </div>
    `;
  }).join('');
}

function renderOverviewTabHtml(membersSorted, filteredShows) {
  const validShows = (state.shows || []).filter(s => s && !s.isCancelled && !s.isHold);
  const totalShowsCount = validShows.length;

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const monthPrefix = `${curYear}-${String(curMonth).padStart(2, '0')}-`;

  const addedTodayCount = validShows.filter(s => getCreatedDayKey(getShowCreatedTimestamp(s)) === todayKey).length;

  const completedThisMonthCount = validShows.filter(s => {
    const start = String(s.startDate || '');
    const end = String(s.endDate || s.startDate || '');
    const inCurMonth = start.startsWith(monthPrefix) || end.startsWith(monthPrefix);
    return inCurMonth && end && end < todayKey;
  }).length;

  const runningThisMonthCount = validShows.filter(s => {
    const start = String(s.startDate || '');
    const end = String(s.endDate || s.startDate || '');
    const inCurMonth = start.startsWith(monthPrefix) || end.startsWith(monthPrefix);
    return inCurMonth && end && end >= todayKey;
  }).length;

  return `
    <div class="space-y-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">TỔNG SHOW</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-slate-900 mt-1">${totalShowsCount}</div>
        </div>
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">ĐÃ NHẬP HÔM NAY</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-indigo-600 mt-1">${addedTodayCount}</div>
        </div>
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">ĐÃ CHẠY THÁNG NÀY</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-amber-600 mt-1">${completedThisMonthCount}</div>
        </div>
        <div class="bg-white rounded-2xl p-3.5 border border-slate-200/80">
          <div class="text-[10px] font-bold text-slate-400 uppercase">ĐANG CHẠY THÁNG NÀY</div>
          <div class="text-xl sm:text-2xl font-black font-mono text-emerald-600 mt-1">${runningThisMonthCount}</div>
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
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">SHOW MỚI NHẬP <span class="text-emerald-600 font-mono">(${filteredShows.length})</span></div>
            <div class="text-[10.5px] text-slate-400">Phân nhóm theo ngày • Bấm vào show để xem chi tiết</div>
          </div>
          <input type="text" value="${escapeHtml(state.adminSearch)}" oninput="adminProActions.setAdminSearch(this.value)"
            placeholder="Tìm địa điểm, chủ show, ekip..." class="w-full sm:w-64 px-3.5 py-2 rounded-2xl bg-slate-100 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
        </div>
        <div class="max-h-96 overflow-y-auto custom-scroll space-y-2 pr-0.5">
          ${renderGroupedShowsByCreatedDayHtml(filteredShows)}
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
          <button type="button" onclick="adminProActions.toggleAddMemberForm()" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 font-black text-xs shrink-0">
            ${isAdding ? '✕ Đóng' : 'Thêm Nhân Sự'}
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
                <button type="button" onclick="adminProActions.addNewMember()" class="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs">Lưu Mới</button>
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
                    <button type="button" onclick="adminProActions.toggleEditMember('${escapeHtml(m.id)}')" class="px-3 py-1.5 rounded-xl font-bold text-[11px] ${isEd ? 'bg-slate-900 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
                      ${isEd ? 'Đóng' : '✏️ Sửa'}
                    </button>
                    <button type="button" onclick="adminProActions.deleteMemberFromAdmin('${escapeHtml(m.id)}')" title="Xóa nhân sự" class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold flex items-center justify-center">🗑️</button>
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
  const allRules = Array.isArray(state.customColorRules) ? state.customColorRules : [];
  const customRules = allRules
    .map((r, idx) => ({ ...r, _idx: idx }))
    .filter(r => !String(r?.id || '').startsWith('def_'));
  const pickedNewHex = state.adminNewColorHex || '#f4c29f';

  const defaultGroups = [
    { id: 'def_muine',   keyword: 'Mũi Né, Nha Trang, Tây Ninh', color: '#f4c29f' },
    { id: 'def_hotram',  keyword: 'Hồ Tràm, Vũng Tàu',           color: '#c9b8df' },
    { id: 'def_ninhchu', keyword: 'Ninh Chữ, Cam Ranh, Cưới, LK', color: '#9ec999' },
    { id: 'def_saigon',  keyword: 'Sài Gòn, SG, Củ Chi, TSN',    color: '#9ad0f0' },
    { id: 'def_hcm',     keyword: 'HCM, Cần Giờ, Nhà Bè',        color: '#bce3cf' },
    { id: 'def_cantho',  keyword: 'Cần Thơ, Bận',                color: '#f5dc82' },
    { id: 'def_dalat',   keyword: 'Đà Lạt, ĐL',                  color: '#d2e391' },
    { id: 'def_kega',    keyword: 'Kê Gà, Phú Quốc',             color: '#faeec7' },
    { id: 'def_longan',  keyword: 'Long An, Hà Nội, Đồng Nai',   color: '#cfd6dc' },
    { id: 'def_other',   keyword: 'Các địa điểm khác (Mặc định)', color: '#dce9fa', isOther: true }
  ];

  return `
    <div class="space-y-4">
      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">💰 Đơn Giá CTP Mặc Định</div>
            <div class="text-[10.5px] text-slate-400">Áp dụng khi bật nhiệm vụ ở tab Tính CTP</div>
          </div>
          <button type="button" onclick="adminProActions.saveCtpRates()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">💾 Lưu Giá</button>
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

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3.5">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">🎨 Màu Địa Điểm Trên Bảng Công Tác</div>
            <div class="text-[10.5px] text-slate-400">Chỉnh xong bấm "Lưu & Áp Dụng" để cập nhật toàn bộ bảng lịch.</div>
          </div>
          <button type="button" onclick="adminProActions.saveAndApplyColors()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black">💾 Lưu &amp; Áp Dụng</button>
        </div>

        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2.5">
          <div class="flex gap-2">
            <input id="adm-new-col-kw" type="text" placeholder="Thêm địa điểm mới (VD: Đi ăn đám cưới, Măng Đen...)" class="flex-1 px-3 py-2 border rounded-xl font-bold bg-white text-xs" />
            <input id="adm-new-col-hex" type="color" value="${pickedNewHex}" onchange="adminProActions.pickNewColorSwatch(this.value)" class="w-9 h-9 rounded-xl border cursor-pointer shrink-0 bg-white p-0.5" />
            <button type="button" onclick="adminProActions.addColorRule()" class="px-3.5 py-2 rounded-xl bg-slate-900 text-amber-400 font-black text-xs shrink-0">Thêm</button>
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

        <div class="space-y-1.5">
          <div class="text-[10.5px] font-black text-slate-500 uppercase tracking-wide">✨ Địa điểm tùy chỉnh riêng (${customRules.length})</div>
          ${customRules.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              ${customRules.map(r => `
                <div style="background:${r.color}" class="px-2.5 py-1.5 rounded-2xl border border-black/10 flex items-center gap-2">
                  <input type="color" value="${r.color}" onchange="adminProActions.updateColorRule(${r._idx}, 'color', this.value)" class="w-6 h-6 rounded-full border cursor-pointer shrink-0 bg-transparent" />
                  <input type="text" value="${escapeHtml(r.keyword || '')}" oninput="adminProActions.updateColorRule(${r._idx}, 'keyword', this.value)" class="flex-1 min-w-0 px-2 py-1 rounded-xl bg-white/85 font-bold text-slate-900 text-[11px]" />
                  <button type="button" onclick="adminProActions.removeColorRule(${r._idx})" class="w-6 h-6 rounded-full bg-white/85 hover:bg-white text-rose-600 font-black text-[10px] shrink-0">✕</button>
                </div>
              `).join('')}
            </div>
          ` : `<div class="text-[11px] text-slate-400 italic px-1">Chưa có địa điểm tùy chỉnh riêng.</div>`}
        </div>

        <div class="pt-2 border-t border-slate-100 space-y-2">
          <div class="text-[10.5px] font-black text-slate-500 uppercase tracking-wide">📌 Bảng màu mặc định (chạm để đổi màu hoặc sửa tên)</div>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            ${defaultGroups.map(g => {
              const edited = allRules.find(r => r?.id === g.id);
              const curColor = edited ? edited.color : g.color;
              const curKw = edited ? edited.keyword : g.keyword;
              return `
                <div style="background:${curColor}" class="px-2.5 py-1.5 rounded-2xl border border-black/10 flex items-center gap-2">
                  <input type="color" value="${curColor}" onchange="adminProActions.updateDefaultColorGroup('${g.id}', 'color', this.value, '${escapeHtml(g.keyword)}', '${g.color}')" class="w-6 h-6 rounded-full border cursor-pointer shrink-0 bg-transparent" />
                  ${g.isOther
                    ? `<span class="flex-1 px-2 py-1 rounded-xl bg-white/80 font-bold text-slate-700 text-[11px] truncate">${escapeHtml(g.keyword)}</span>`
                    : `<input type="text" value="${escapeHtml(curKw)}" oninput="adminProActions.updateDefaultColorGroup('${g.id}', 'keyword', this.value, '${escapeHtml(g.keyword)}', '${g.color}')" class="flex-1 min-w-0 px-2 py-1 rounded-xl bg-white/85 font-bold text-slate-900 text-[11px]" />`
                  }
                  ${edited ? `<button type="button" title="Khôi phục màu gốc" onclick="adminProActions.resetDefaultColorGroup('${g.id}')" class="w-6 h-6 rounded-full bg-white/85 hover:bg-white text-slate-700 font-black text-[11px] shrink-0">↩</button>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderSystemTabHtml() {
  const lockYear = Number(state.adminLockViewYear) || 2026;
  const trash = state.deletedShowsTrash || [];
  const bc = state.studioBroadcast || { enabled: false, text: '' };
  const curLogo = getAdminLogoSrc();

  return `
    <div class="space-y-4">
      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div>
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">🖼️ Đổi Logo Studio</div>
          <div class="text-[10.5px] text-slate-400 mt-0.5">Chọn ảnh logo mới từ máy để cập nhật ngay trên Header &amp; ứng dụng</div>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div class="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
            <img src="${escapeHtml(curLogo)}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_SVG}'" alt="Logo" class="w-full h-full object-contain" />
          </div>
          <button type="button" onclick="adminProActions.triggerLogoUpload()" class="px-3.5 py-2 rounded-xl bg-slate-900 text-amber-400 font-black text-xs">📤 Chọn Ảnh Logo Mới</button>
          ${state.customLogoDataUrl ? `<button type="button" onclick="adminProActions.resetLogoDefault()" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">↩ Dùng Logo Mặc Định</button>` : ''}
          <input id="adm-logo-file-input" type="file" accept="image/*" onchange="adminProActions.handleLogoUpload(this)" class="hidden" />
        </div>
      </div>

      <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
        <div>
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">💾 Sao Lưu &amp; Backup Dữ Liệu (.JSON)</div>
          <div class="text-[10.5px] text-slate-400 mt-0.5">Tải file backup toàn bộ shows, cấu hình, PIN &amp; màu sắc về máy hoặc nạp lại từ file .JSON</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" onclick="adminProActions.exportFullJsonBackup()" class="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs">⬇️ Tải File Backup (.JSON)</button>
          <button type="button" onclick="adminProActions.triggerRestoreJsonFile()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs">⬆️ Khôi Phục Từ File (.JSON)</button>
          <button type="button" onclick="adminProActions.copyFullJsonToClipboard()" class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs">Copy JSON</button>
          <input id="adm-restore-json-input" type="file" accept=".json,application/json" onchange="adminProActions.handleRestoreJsonFile(this)" class="hidden" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">🛡️ Khóa Bảo Trì (Maintenance Mode)</div>
          <p class="text-[11px] text-slate-500">Bật khi cần khóa tạm quyền Nổ Show / sửa / xóa của thành viên để đối soát.</p>
          <button type="button" onclick="adminProActions.toggleMaintenanceMode()" class="px-4 py-2 rounded-xl font-black text-white ${state.readonlyMaintenanceMode ? 'bg-emerald-600' : 'bg-rose-600'}">
            ${state.readonlyMaintenanceMode ? '🔓 Tắt Khóa Bảo Trì' : '🛡️ Bật Khóa Bảo Trì'}
          </button>
        </div>

        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="font-black text-xs uppercase tracking-wide text-slate-900">📅 Bật / Ẩn Năm Hiển Thị</div>
          <p class="text-[11px] text-slate-500">Chọn các năm xuất hiện trên thanh chọn đầu ứng dụng.</p>
          <div class="flex flex-wrap gap-1.5">
            ${ALL_YEARS.map(yr => `<button type="button" onclick="adminProActions.toggleYear(${yr})" class="px-3 py-1 rounded-full font-black border ${state.visibleYears.includes(yr) ? 'bg-slate-900 text-amber-400' : 'bg-slate-50 text-slate-500'}">${yr}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-2.5">
          <div class="flex items-center justify-between gap-2 flex-wrap">
            <div class="font-black text-xs uppercase tracking-wide text-slate-900">🔒 Khóa Sổ Tháng (${lockYear})</div>
            <div class="flex gap-1 bg-slate-100 p-0.5 rounded-full">
              ${ALL_YEARS.map(yr => `<button type="button" onclick="adminProActions.setLockViewYear(${yr})" class="px-2.5 py-0.5 rounded-full text-[10px] font-black ${lockYear === yr ? 'bg-slate-900 text-amber-400' : 'text-slate-600'}">${yr}</button>`).join('')}
            </div>
          </div>
          <div class="grid grid-cols-6 gap-1.5">
            ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
              const locked = isYearMonthLocked(lockYear, m);
              return `<button type="button" onclick="adminProActions.toggleLockMonthAdmin(${m})" class="py-1.5 rounded-xl font-extrabold text-[10.5px] border ${locked ? 'bg-rose-50 text-rose-600 border-rose-300' : 'bg-slate-50 text-slate-700 border-slate-200'}">${locked ? '🔒' : '🔓'} T${m}</button>`;
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
            <button type="button" onclick="adminProActions.publishBroadcast()" class="flex-1 py-2 rounded-xl bg-rose-600 text-white font-black">📢 Lưu &amp; Phát Ngay</button>
            ${bc.enabled ? `<button type="button" onclick="adminProActions.disableBroadcast()" class="px-3 py-2 rounded-xl bg-slate-200 text-slate-800 font-bold">🔕 Tắt</button>` : ''}
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
                  <button type="button" onclick="adminProActions.restoreDeletedShow('${escapeHtml(sh.id)}')" class="px-3 py-1 rounded-lg bg-emerald-600 text-white font-black text-[10.5px] shrink-0">↩ Khôi phục</button>
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
      <div style="padding-top: max(18px, env(safe-area-inset-top));" class="w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center p-4">
        <div class="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-4">
          <h2 class="font-black text-sm text-amber-400 uppercase">Đăng Nhập Studio Control (Admin)</h2>
          ${state.adminLoginInput.error ? `<div class="text-rose-400 text-xs font-bold">${escapeHtml(state.adminLoginInput.error)}</div>` : ''}
          <input type="email" value="${escapeHtml(state.adminLoginInput.email)}" placeholder="Email Admin" oninput="state.adminLoginInput.email = this.value" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white" />
          <input type="password" value="${escapeHtml(state.adminLoginInput.password)}" placeholder="Mật khẩu Firebase Auth" oninput="state.adminLoginInput.password = this.value" class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white" />
          <button type="button" onclick="appActions.submitBackendAdminLogin()" class="w-full bg-amber-400 text-slate-950 font-black py-2.5 rounded-xl text-xs">Đăng Nhập Quản Trị</button>
          <button type="button" onclick="appActions.exitBackendPortal()" class="w-full text-slate-400 text-xs py-1">← Quay lại Lịch Show</button>
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
      <header style="padding-top: max(18px, env(safe-area-inset-top));" class="bg-white border-b border-slate-200 px-3 sm:px-4 pb-2.5 shrink-0 space-y-2">
        <div class="max-w-5xl w-full mx-auto flex items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="font-black text-sm uppercase tracking-tight text-slate-900">Studio Control</div>
            <div class="text-[10.5px] text-slate-400 font-medium truncate">${state.shows.length} Shows • Action Media x Say Studios</div>
          </div>
          <div class="flex gap-1.5 shrink-0 flex-wrap justify-end">
            <button type="button" onclick="adminProActions.exportFullJsonBackup()" class="px-2.5 py-1.5 rounded-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-[10.5px]">Backup</button>
            <button type="button" onclick="appActions.logoutAdminToNormalUser()" class="px-2.5 py-1.5 rounded-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-extrabold text-[10.5px]">Đăng xuất Admin</button>
            <button type="button" onclick="appActions.exitBackendPortal()" class="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10.5px]">← Về App</button>
          </div>
        </div>

        <div class="max-w-5xl w-full mx-auto bg-slate-100 p-1 rounded-2xl grid grid-cols-4 gap-1 text-[10.5px] sm:text-xs">
          ${tabs.map(t => `
            <button type="button" onclick="adminProActions.setAdminTab('${t.id}')" class="py-2 px-1.5 rounded-xl font-extrabold leading-tight text-center transition-all ${curAdminTab === t.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">${t.label}</button>
          `).join('')}
        </div>
      </header>
      <div class="flex-1 overflow-y-auto custom-scroll p-3 sm:p-4 max-w-5xl w-full mx-auto text-xs pb-16">
        ${bodyHtml}
      </div>

      ${renderAdminInspectModalHtml()}
    </div>
  `;
}
