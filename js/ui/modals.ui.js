import { state } from '../state/store.js';
import { ROLE_OPTIONS, BANK_LIST } from '../config/constants.js';
import { escapeHtml, getMember, renderPillHtml, normalizeRoleName, buildVietQrUrl, getBankName } from '../utils/helpers.js';
import { getBusyMembersMap } from '../services/show.service.js';

export function renderPinModalHtml() {
  const pm = state.pinModal;
  if (!pm) return '';
  const selMem = pm.selectedId ? getMember(pm.selectedId) : null;
  const logoSrc = state.customLogoUrl || './assets/logo.png';

  return `
    <div class="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl border">
        <div class="flex flex-col items-center text-center space-y-2 pb-2 border-b">
          <div onclick="appActions.tapLogoSecret()" class="w-14 h-14 rounded-2xl bg-black overflow-hidden shadow-md cursor-pointer">
            <img src="${logoSrc}" alt="Action x Say" class="w-full h-full object-cover" />
          </div>
          <h2 class="font-black text-sm text-slate-900 uppercase">LỊCH SHOW ACTION &amp; SAY</h2>
          <p class="text-[11px] text-slate-500">${pm.step === 'select' ? 'Chọn tên của bạn để đăng nhập' : `Nhập mã PIN của ${escapeHtml(selMem?.name || '')}`}</p>
        </div>

        ${pm.step === 'select' ? `
          <div class="grid grid-cols-2 gap-1.5 max-h-[55dvh] overflow-y-auto custom-scroll">
            ${state.members.map(m => `<button onclick="appActions.chooseMemberForPin('${m.id}')" class="p-2.5 rounded-xl border hover:border-slate-900 flex justify-between items-center bg-slate-50">${renderPillHtml(m.id, 'sm')}<i class="fa-solid fa-chevron-right text-slate-300 text-[10px]"></i></button>`).join('')}
          </div>
        ` : `
          <div class="flex flex-col items-center space-y-3 py-2">
            ${renderPillHtml(pm.selectedId, 'md')}
            <input id="native-pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autofocus
              value="${escapeHtml(pm.pinInput)}" oninput="appActions.handleNativePinInput(this.value)" placeholder="••••"
              class="w-40 text-center text-xl tracking-widest font-mono py-2 px-3 border-2 border-indigo-500 rounded-2xl bg-slate-50 focus:outline-none" />
            <div class="min-h-[18px] text-xs font-bold text-rose-600 text-center">${escapeHtml(pm.error || (pm.loading ? '⏳ Đang xác thực...' : ''))}</div>
            <button onclick="appActions.backToSelectMemberPin()" class="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">← Chọn tên khác</button>
          </div>
        `}
      </div>
    </div>
  `;
}

export function renderCrewPassModalHtml() {
  if (!state.crewPassModal || !state.currentUserId) return '';
  const me = getMember(state.currentUserId);
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const displayFullName = (prof.fullName || me.name).trim();
  const qrUrl = prof.bankAcc ? buildVietQrUrl(prof.bankBin, prof.bankAcc) : '';
  const hidden = state.vipInfoHidden;

  return `
    <div onclick="appActions.closeCrewPassModal()" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3.5">
      <div onclick="event.stopPropagation()" class="w-full max-w-sm bg-[#0c0c0f] text-white border border-white/15 rounded-[28px] p-4 space-y-3.5 shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div style="background: linear-gradient(140deg, ${me.bg} 0%, #111827 55%, #09090b 100%);" class="rounded-3xl p-4 border border-white/20 space-y-3">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-1 rounded-full bg-black/45 text-[9px] font-black uppercase text-amber-300">⚡ ACTION x SAY • VIP PASS</span>
            <button onclick="appActions.closeCrewPassModal()" class="w-7 h-7 rounded-full bg-black/50 text-white text-xs font-black">✕</button>
          </div>
          <div class="flex items-center gap-3">
            <div onclick="appActions.triggerAvatarUpload()" class="relative w-16 h-16 rounded-2xl bg-black/50 border-2 border-amber-300 overflow-hidden shrink-0 cursor-pointer flex items-center justify-center">
              ${prof.avatar ? `<img src="${prof.avatar}" class="w-full h-full object-cover" />` : `<span class="font-black">${escapeHtml(me.shortLabel.slice(0,2))}</span>`}
              <span class="absolute bottom-0.5 right-0.5 text-[10px]">📷</span>
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="font-black text-base uppercase truncate">${escapeHtml(displayFullName)}</h3>
              <div class="text-[11px] text-amber-300 font-bold">${escapeHtml(prof.title || 'Media Crew')}</div>
            </div>
          </div>
          ${qrUrl ? `
            <div class="pt-3 border-t border-white/15 flex items-center justify-between gap-2">
              <div class="text-[11px]">
                <div class="text-emerald-300 text-[9px] font-black">VIETQR NHẬN CTP</div>
                <div class="font-bold">${escapeHtml(getBankName(prof.bankBin))}</div>
                <div class="font-mono font-black text-amber-300">${escapeHtml(prof.bankAcc)}</div>
              </div>
              <img src="${qrUrl}" alt="VietQR" class="w-20 h-20 bg-white p-1 rounded-xl object-contain" />
            </div>
          ` : ''}
        </div>

        ${!state.isEditingCrewProfile ? `
          <div class="bg-[#16161d] rounded-3xl px-4 py-3 space-y-2 text-xs">
            <div class="flex items-center justify-between pb-2 border-b border-white/10">
              <div class="flex items-center gap-2">
                <span class="font-black text-amber-400">INFO</span>
                <button onclick="appActions.toggleVipInfoHidden()" class="w-6 h-6 rounded-full bg-white/10 text-[11px]">
                  <i class="fa-solid ${hidden ? 'fa-eye-slash text-amber-300' : 'fa-eye'}"></i>
                </button>
              </div>
              <div class="flex gap-1.5">
                <button onclick="appActions.toggleEditCrewProfile(true)" class="px-2.5 py-1 rounded-full bg-amber-400/20 text-amber-300 font-bold text-[10.5px]">✏️ Sửa</button>
                <button onclick="appActions.openSelfChangePinModal()" class="px-2.5 py-1 rounded-full bg-white/10 text-white font-bold text-[10.5px]">🔑 Đổi PIN</button>
              </div>
            </div>
            <div class="flex justify-between py-1"><span class="text-slate-400">CCCD</span><span class="font-mono font-bold">${hidden ? '••••••••••••' : escapeHtml(prof.cccd || '—')}</span></div>
            <div class="flex justify-between py-1"><span class="text-slate-400">Ngày sinh</span><span class="font-mono font-bold">${hidden ? '••••••••' : escapeHtml(prof.dob || '—')}</span></div>
            <div class="flex justify-between py-1"><span class="text-slate-400">Điện thoại</span><span class="font-mono font-bold text-emerald-400">${hidden ? '••••••••••' : escapeHtml(prof.phone || '—')}</span></div>
          </div>
        ` : `
          <div class="bg-[#16161d] rounded-3xl p-4 space-y-2 text-xs">
            <input id="prof-fullname" value="${escapeHtml(prof.fullName || '')}" placeholder="Họ và Tên đầy đủ" class="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white" />
            <div class="grid grid-cols-2 gap-2">
              <input id="prof-cccd" value="${escapeHtml(prof.cccd || '')}" placeholder="Số CCCD" class="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono" />
              <input id="prof-dob" value="${escapeHtml(prof.dob || '')}" placeholder="DD/MM/YYYY" class="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono" />
            </div>
            <div class="grid grid-cols-2 gap-2">
              <input id="prof-phone" value="${escapeHtml(prof.phone || '')}" placeholder="SĐT" class="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono" />
              <input id="prof-title" value="${escapeHtml(prof.title || '')}" placeholder="Chức danh" class="px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white" />
            </div>
            <div class="grid grid-cols-3 gap-2">
              <select id="prof-bank-bin" class="px-2 py-2 rounded-xl bg-black/60 border border-white/15 text-white text-[11px]">
                ${BANK_LIST.map(b => `<option value="${b.bin}" ${prof.bankBin === b.bin ? 'selected' : ''}>${b.name}</option>`).join('')}
              </select>
              <input id="prof-bank-acc" value="${escapeHtml(prof.bankAcc || '')}" placeholder="Số tài khoản" class="col-span-2 px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-white font-mono" />
            </div>
            <button onclick="appActions.saveMyMemberProfile()" class="w-full py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black">💾 Lưu Thay Đổi</button>
          </div>
        `}

        <button onclick="appActions.logoutMember()" style="background:#e11d48;" class="w-full py-3 rounded-2xl text-white font-black text-xs flex items-center justify-center gap-2">
          <i class="fa-solid fa-right-from-bracket"></i><span>Đăng xuất</span>
        </button>
      </div>
    </div>
  `;
}

export function renderFormModalHtml() {
  const f = state.formModal;
  if (!f) return '';
  const busyMap = getBusyMembersMap(f.startDate, f.endDate, f.showId);
  return `
    <div onclick="appActions.closeFormModal()" class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center">
      <div onclick="event.stopPropagation()" class="ios-sheet custom-scroll bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-4 space-y-3 max-h-[90dvh] overflow-y-auto text-xs">
        <div class="flex justify-between items-center border-b pb-2">
          <h3 class="font-black text-sm uppercase">${f.mode === 'edit' ? `Sửa Show #${f.stt || ''}` : '⚡ NỔ SHOW MỚI'}</h3>
          <button onclick="appActions.closeFormModal()" class="w-7 h-7 rounded-full bg-slate-100">✕</button>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <input type="text" value="${escapeHtml(f.location)}" oninput="appActions.updateFormField('location', this.value)" placeholder="Địa điểm..." class="px-3 py-2 border rounded-xl font-bold" />
          <input type="text" value="${escapeHtml(f.partner)}" oninput="appActions.updateFormField('partner', this.value)" placeholder="Đối tác..." class="px-3 py-2 border rounded-xl" />
        </div>
        <label class="flex items-center gap-2 font-bold text-slate-700"><input type="checkbox" ${f.hidePartner ? 'checked' : ''} onchange="appActions.updateFormField('hidePartner', this.checked)" /><span>Ẩn đối tác với lịch chung</span></label>
        <div class="grid grid-cols-2 gap-2">
          <input type="date" value="${f.startDate}" onchange="appActions.updateFormField('startDate', this.value)" class="px-2.5 py-1.5 border rounded-xl font-bold" />
          <input type="date" min="${f.startDate}" value="${f.endDate}" onchange="appActions.updateFormField('endDate', this.value)" class="px-2.5 py-1.5 border rounded-xl font-bold" />
        </div>
        <select onchange="appActions.updateFormField('ownerId', this.value)" class="w-full px-3 py-2 border rounded-xl font-bold bg-white">
          ${state.members.map(m => `<option value="${m.id}" ${f.ownerId === m.id ? 'selected' : ''}>Chủ show: ${escapeHtml(m.name)}</option>`).join('')}
        </select>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-slate-50 p-2 rounded-xl border">
          ${state.members.map(m => {
            const sel = f.memberIds.includes(m.id);
            const busy = busyMap[m.id];
            const roles = f.roles?.[m.id] || [];
            return `
              <div onclick="appActions.toggleFormMember('${m.id}')" class="p-1.5 rounded-lg border cursor-pointer ${sel ? 'bg-indigo-50 border-indigo-600' : busy ? 'bg-rose-50 border-rose-200' : 'bg-white'}">
                <div class="flex justify-between items-center">${renderPillHtml(m.id, 'xs')}<i class="fa-solid ${sel ? 'fa-circle-check text-indigo-600' : 'fa-circle text-slate-200'}"></i></div>
                ${busy ? `<div class="text-[9px] font-bold text-rose-600 truncate mt-0.5">⚠️ Bận: ${escapeHtml(busy[0])}</div>` : ''}
                ${sel ? `<div class="flex flex-wrap gap-1 mt-1" onclick="event.stopPropagation()">${ROLE_OPTIONS.map(r => `<button type="button" onclick="appActions.toggleMemberRole('${m.id}', '${r.id}')" class="px-1.5 py-0.5 rounded text-[9px] font-bold border ${(roles||[]).map(normalizeRoleName).includes(r.id) ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}">${r.label}</button>`).join('')}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        <!-- Nhân sự ngoài (Freelancer) -->
        <div class="p-3 rounded-2xl border border-dashed border-indigo-400 bg-indigo-50/60 space-y-2">
          <div class="flex items-center justify-between">
            <span class="font-black text-slate-900">🤝 Nhân sự ngoài (Freelancer)</span>
            <button type="button" onclick="appActions.addExternalCrewDraft()" class="px-3 py-1 rounded-full bg-indigo-600 text-white font-bold text-[10px]">+ Thêm người</button>
          </div>
          ${(f.externalCrew || []).map((p, idx) => `
            <div class="flex items-center gap-1.5">
              <input type="text" value="${escapeHtml(p.name)}" oninput="appActions.updateExternalCrewName(${idx}, this.value)" placeholder="Tên freelancer..." class="flex-1 px-2.5 py-1.5 bg-white border rounded-xl font-bold" />
              <button type="button" onclick="appActions.removeExternalCrewDraft(${idx})" class="w-7 h-7 rounded-xl bg-rose-100 text-rose-600">✕</button>
            </div>
          `).join('')}
        </div>

        ${f.error ? `<div class="text-rose-600 font-bold">${escapeHtml(f.error)}</div>` : ''}
        <button onclick="appActions.saveShowForm()" class="w-full bg-indigo-600 text-white font-black py-2.5 rounded-xl uppercase">${f.mode === 'edit' ? '💾 LƯU CHỈNH SỬA' : '⚡ NỔ SHOW'}</button>
      </div>
    </div>
  `;
}

export function renderToastHtml() {
  if (!state.toast) return '';
  return `<div class="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold text-white bg-slate-900">${escapeHtml(state.toast.message)}</div>`;
}