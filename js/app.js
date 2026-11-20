import { state, registerRenderer, triggerRender } from './state/store.js';
import { initAuthListener, loginMemberWithPin, loginAdminWithEmail, changeMyPin, logoutCurrentUser } from './services/auth.service.js';
import { attachShowListeners, detachShowListeners, syncShowsToCloud, saveMyProfileToCloud, canEditShow, isYearMonthLocked, getVisiblePartnerText } from './services/show.service.js';
import { attachFinanceListeners, detachFinanceListeners, saveCtpState, saveOwnerFinanceState, getDefaultRateForTask, findAnyCtpShow, getCombinedCtpShows, ensureOwnerFinRecord } from './services/finance.service.js';
import { pushAdminConfigToCloud, logStudioActivity, exportFullJsonBackup, saveOfficialLegalName } from './services/admin.service.js';
import { getTodayISO, getMember, resolveDynamicLocationColor, playStudioSound, showToast, formatDayMonth, formatCompactMoneyPlain } from './utils/helpers.js';
import { exportShowToAppleCalendar, captureElementToPreview, shareOrDownloadPreviewImage } from './utils/export.js';
import { initPullToRefresh } from './utils/pullToRefresh.js';

import { renderHeaderHtml, renderBottomNavHtml } from './ui/header.ui.js';
import { renderShowsTabHtml, renderDetailModalHtml } from './ui/shows.ui.js';
import { renderMatrixTabHtml } from './ui/matrix.ui.js';
import { renderCrewBoardTabHtml } from './ui/crewBoard.ui.js';
import { renderCtpTabHtml, renderCtpBillModalHtml } from './ui/ctp.ui.js';
import { renderDebtTabHtml } from './ui/debt.ui.js';
import { renderPinModalHtml, renderCrewPassModalHtml, renderFormModalHtml, renderToastHtml } from './ui/modals.ui.js';
import { renderAdminPortalHtml } from './ui/admin.ui.js';

function applyCustomLogoToDom() {
  const customLogo = state.customLogoDataUrl || localStorage.getItem('as_custom_logo_2026') || '';
  if (!customLogo) return;
  state.customLogoDataUrl = customLogo;
  document.querySelectorAll('img[src*="logo.png"]').forEach(img => {
    img.src = customLogo;
  });
}

function syncAvatarsAcrossDom() {
  const savedAvatars = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');
  (state.members || []).forEach(m => {
    const url = state.memberProfiles?.[m.id]?.avatarUrl || savedAvatars[m.id];
    if (!url) return;
    document.querySelectorAll(`[data-member-avatar="${m.id}"]`).forEach(el => {
      if (el.tagName === 'IMG') {
        el.src = url;
      } else {
        el.innerHTML = `<img src="${url}" alt="${m.name}" class="w-full h-full object-cover" />`;
      }
    });
  });
}

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!state.authReady) {
    root.innerHTML = `<div class="h-[100dvh] flex items-center justify-center bg-slate-950 text-white text-xs font-bold">⏳ Đang kết nối Action &amp; Say Cloud...</div>`;
    return;
  }

  if (state.isBackendPortal) {
    root.innerHTML = `${renderAdminPortalHtml()}${renderToastHtml()}`;
    applyCustomLogoToDom();
    return;
  }

  if (!state.currentUserId) {
    root.innerHTML = `${renderPinModalHtml()}${renderToastHtml()}`;
    applyCustomLogoToDom();
    return;
  }

  let main = '';
  if (state.activeTab === 'shows') main = renderShowsTabHtml();
  else if (state.activeTab === 'matrix') main = renderMatrixTabHtml();
  else if (state.activeTab === 'free_finder') main = renderCrewBoardTabHtml();
  else if (state.activeTab === 'ctp') main = renderCtpTabHtml();
  else if (state.activeTab === 'owner_stats') main = renderDebtTabHtml();

  root.innerHTML = `
    ${renderHeaderHtml(0)}
    ${main}
    ${renderBottomNavHtml()}
    ${renderDetailModalHtml()}
    ${renderFormModalHtml()}
    ${renderCrewPassModalHtml()}
    ${renderCtpBillModalHtml()}
    ${renderToastHtml()}
  `;
  applyCustomLogoToDom();
}

registerRenderer(renderApp);

// Gắn các hành động ra window để HTML gọi mượt mà
window.state = state;
window.appActions = {
triggerVipAvatarUpload() {
    document.getElementById('vip-avatar-file-input')?.click();
  },
  async handleVipAvatarUpload(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;
    try {
      // Nén ảnh về 256x256px để lưu Firestore siêu nhẹ & không bao giờ bị lỗi dung lượng
      const cleanUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            const size = 256;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            const minSide = Math.min(img.width, img.height);
            const sx = (img.width - minSide) / 2;
            const sy = (img.height - minSide) / 2;
            ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
            resolve(canvas.toDataURL('image/jpeg', 0.82));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });

      const savedAvatars = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');
      savedAvatars[state.currentUserId] = cleanUrl;
      localStorage.setItem('as_member_avatars_2026', JSON.stringify(savedAvatars));

      const cur = state.memberProfiles?.[state.currentUserId] || {};
      await saveMyProfileToCloud(state.currentUserId, {
        ...cur,
        avatar: cleanUrl,
        avatarUrl: cleanUrl
      });
      renderApp();
      showToast('📷 Đã cập nhật & đồng bộ ảnh đại diện!');
    } catch (err) {
      showToast('Lỗi tải ảnh avatar: ' + err.message, 'error');
    } finally {
      inputEl.value = '';
    }
  },
  copyVipInfoText() {
    const prof = state.memberProfiles?.[state.currentUserId] || {};
    const m = getMember(state.currentUserId);
    const name = (prof.fullName || m.name || '').toUpperCase();
    const lines = [
      `${name} (${m.name})`,
      `CCCD: ${prof.cccd || '-'}`,
      `Ngày sinh: ${prof.dob || '-'}`,
      `SĐT: ${prof.phone || '-'}`,
      `STK: ${prof.bankAcc || '-'}`
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    showToast('📋 Đã copy thông tin thẻ VIP!');
  },
  async switchMemberFromVipCard() {
    state.crewPassModal = false;
    await logoutCurrentUser();
    state.pinModal = { step: 'select', selectedId: null, pinInput: '', error: '', loading: false };
    renderApp();
  },
  setTab(tab) { state.activeTab = tab; renderApp(); },
  setYear(y) {
    state.selectedYear = Number(y);
    const m = Number(y) === 2026 ? new Date().getMonth() + 1 : 1;
    state.selectedMonth = state.ctpMonth = state.ownerMonth = m;
    renderApp();
  },
  setMonth(m) { state.selectedMonth = state.ctpMonth = state.ownerMonth = Number(m); state.filterAllMonthsInList = false; renderApp(); },
  toggleAllMonths() { state.filterAllMonthsInList = !state.filterAllMonthsInList; renderApp(); },
  toggleZenFullscreen() { state.zenFullscreen = !state.zenFullscreen; renderApp(); },
  toggleCompactMatrix() { state.compactMatrix = !state.compactMatrix; renderApp(); },
  toggleHideMoneyMode() { state.hideMoneyMode = !state.hideMoneyMode; localStorage.setItem('as_hide_money_2026', String(state.hideMoneyMode)); renderApp(); },
  setFilterMember(id) { state.filterMemberId = state.filterMemberId === id ? 'all' : id; renderApp(); },
  onSearchInput(v) { state.searchQuery = v; renderApp(); },
  setCheckDate(f, v) { state[f] = v; if (f === 'checkStart' && state.checkEnd < v) state.checkEnd = v; renderApp(); },

  openShowDetail(id) { state.detailShowId = id; renderApp(); },
  closeShowDetail() { state.detailShowId = null; renderApp(); },
  openAddModal(date = null, memId = null) {
    if (state.readonlyMaintenanceMode && !state.isAdminMode) return showToast('🛡️ Hệ thống đang khóa bảo trì!', 'error');
    const d = date || getTodayISO();
    state.formModal = { mode: 'add', showId: null, location: '', partner: '', hidePartner: false, startDate: d, endDate: d, memberIds: [memId || state.currentUserId], roles: {}, externalCrew: [], ownerId: state.currentUserId, creatorId: state.currentUserId, error: '' };
    renderApp();
  },
  openEditModal(id) {
    const sh = state.shows.find(s => s.id === id);
    if (!sh || !canEditShow(sh)) return showToast('Không có quyền sửa show này!', 'error');
    state.detailShowId = null;
    state.formModal = { mode: 'edit', showId: sh.id, stt: sh.stt, location: sh.location, partner: sh.partner || '', hidePartner: !!sh.hidePartner, startDate: sh.startDate, endDate: sh.endDate, memberIds: [...(sh.memberIds || [])], roles: JSON.parse(JSON.stringify(sh.roles || {})), externalCrew: JSON.parse(JSON.stringify(sh.externalCrew || [])), ownerId: sh.ownerId, creatorId: sh.creatorId || sh.ownerId, error: '' };
    renderApp();
  },
  closeFormModal() { state.formModal = null; renderApp(); },
  updateFormField(k, v) { if (state.formModal) { state.formModal[k] = v; if (k === 'startDate' && state.formModal.endDate < v) state.formModal.endDate = v; } },
  toggleFormMember(mid) {
    const f = state.formModal; if (!f) return;
    const i = f.memberIds.indexOf(mid);
    if (i >= 0) f.memberIds.splice(i, 1); else f.memberIds.push(mid);
    renderApp();
  },
  toggleMemberRole(mid, roleId) {
    const f = state.formModal; if (!f) return;
    const arr = Array.isArray(f.roles[mid]) ? f.roles[mid] : [];
    const i = arr.indexOf(roleId);
    if (i >= 0) arr.splice(i, 1); else arr.push(roleId);
    f.roles[mid] = arr;
    renderApp();
  },
  addExternalCrewDraft() { if (state.formModal) { state.formModal.externalCrew.push({ name: '', roles: ['Quay'] }); renderApp(); } },
  updateExternalCrewName(idx, val) { if (state.formModal?.externalCrew[idx]) state.formModal.externalCrew[idx].name = val; },
  removeExternalCrewDraft(idx) { if (state.formModal) { state.formModal.externalCrew.splice(idx, 1); renderApp(); } },
  async saveShowForm() {
    const f = state.formModal; if (!f) return;
    if (!f.location.trim()) { f.error = 'Vui lòng nhập địa điểm!'; return renderApp(); }
    const [y, m] = f.startDate.split('-').map(Number);
    if (isYearMonthLocked(y, m)) return showToast(`🔒 Tháng ${m}/${y} đã khóa sổ!`, 'error');

    const cleanExt = (f.externalCrew || []).filter(p => p.name.trim());
    if (f.mode === 'edit') {
      state.shows = state.shows.map(s => s.id === f.showId ? { ...s, ...f, externalCrew: cleanExt, color: resolveDynamicLocationColor(f.location, f.partner), updatedAt: Date.now() } : s);
      await logStudioActivity(`Sửa show: ${f.location}`);
    } else {
      const nextStt = Math.max(300, ...state.shows.map(s => Number(s.stt) || 0)) + 1;
      state.shows.push({ id: 'sh_' + Date.now(), stt: nextStt, ...f, externalCrew: cleanExt, postStatus: 'pending', color: resolveDynamicLocationColor(f.location, f.partner), createdAt: Date.now(), updatedAt: Date.now() });
      playStudioSound('noshow');
      await logStudioActivity(`Nổ show mới: ${f.location}`);
    }
    state.formModal = null;
    await syncShowsToCloud();
    renderApp();
    showToast('✅ Đã lưu & đồng bộ Cloud!');
  },
  async updatePostStatus(id, stVal) {
    const sh = state.shows.find(s => s.id === id);
    if (!sh || !canEditShow(sh)) return;
    sh.postStatus = stVal;
    await syncShowsToCloud();
    renderApp();
  },
  async toggleCancelShow(id) {
    const sh = state.shows.find(s => s.id === id);
    if (!sh || !canEditShow(sh)) return;
    sh.isCancelled = !sh.isCancelled;
    if (sh.isCancelled) sh.cancelReason = prompt('Lý do hủy show:', 'Khách báo hủy') || 'Đã hủy';
    state.detailShowId = null;
    await syncShowsToCloud();
    renderApp();
  },
  async deleteShow(id) {
    const sh = state.shows.find(s => s.id === id);
    if (!sh || !canEditShow(sh) || !confirm(`Xóa vĩnh viễn show "${sh.location}"?`)) return;
    state.deletedShowsTrash.unshift({ ...sh, deletedAt: Date.now() });
    state.shows = state.shows.filter(s => s.id !== id);
    state.detailShowId = null;
    await syncShowsToCloud();
    await logStudioActivity(`Xóa show: ${sh.location}`);
    renderApp();
  },

  // Auth & VIP Card
  chooseMemberForPin(mid) { state.pinModal = { step: 'pin', selectedId: mid, pinInput: '', error: '', loading: false }; renderApp(); },
  backToSelectMemberPin() { state.pinModal = { step: 'select', selectedId: null, pinInput: '', error: '', loading: false }; renderApp(); },
  async handleNativePinInput(val) {
    const clean = String(val).replace(/\D/g, '').slice(0, 4);
    state.pinModal.pinInput = clean;
    if (clean.length === 4) {
      state.pinModal.loading = true; renderApp();
      try {
        await loginMemberWithPin(state.pinModal.selectedId, clean);
        showToast(`Xin chào ${getMember(state.pinModal.selectedId).name}!`);
      } catch (err) {
        state.pinModal.pinInput = ''; state.pinModal.loading = false; state.pinModal.error = err.message; renderApp();
      }
    }
  },
  async logoutMember() { state.crewPassModal = false; await logoutCurrentUser(); showToast('🔒 Đã đăng xuất!'); },
  openCrewPassModal() { state.crewPassModal = true; state.isEditingCrewProfile = false; renderApp(); },
  closeCrewPassModal() { state.crewPassModal = false; renderApp(); },
  toggleEditCrewProfile(v) { state.isEditingCrewProfile = v; renderApp(); },
  toggleVipInfoHidden() { state.vipInfoHidden = !state.vipInfoHidden; localStorage.setItem('as_vip_info_hidden', state.vipInfoHidden ? '1' : '0'); renderApp(); },
  async saveMyMemberProfile() {
    await saveMyProfileToCloud(state.currentUserId, {
      ...state.memberProfiles[state.currentUserId],
      fullName: document.getElementById('prof-fullname')?.value.trim() || '',
      cccd: document.getElementById('prof-cccd')?.value.trim() || '',
      dob: document.getElementById('prof-dob')?.value.trim() || '',
      phone: document.getElementById('prof-phone')?.value.trim() || '',
      title: document.getElementById('prof-title')?.value.trim() || '',
      bankBin: document.getElementById('prof-bank-bin')?.value || '970436',
      bankAcc: (document.getElementById('prof-bank-acc')?.value || '').replace(/\s+/g, '')
    });
    state.isEditingCrewProfile = false;
    renderApp();
    showToast('✅ Đã lưu Hồ sơ & VietQR lên Cloud!');
  },
  async openSelfChangePinModal() {
    const oldP = prompt('Nhập mã PIN 4 số hiện tại:'); if (!oldP) return;
    const newP = prompt('Nhập mã PIN 4 số mới:'); if (!newP) return;
    try { await changeMyPin(oldP, newP); showToast('✅ Đã đổi mã PIN thành công!'); }
    catch (e) { showToast(e.message, 'error'); }
  },
  exportShowToAppleCalendar(id) { exportShowToAppleCalendar(id, getVisiblePartnerText); },
  openCrewManifestModal(id) {
    const sh = state.shows.find(s => s.id === id); if (!sh) return;
    const lines = (sh.memberIds || []).map((mid, i) => {
      const p = state.memberProfiles?.[mid] || {};
      const name = (state.officialLegalNames?.[mid] || p.fullName || getMember(mid).name).toUpperCase();
      return `${i + 1}. ${name} | CCCD: ${p.cccd || 'Chưa cập nhật'} | SĐT: ${p.phone || '-'}`;
    });
    navigator.clipboard?.writeText(lines.join('\n'));
    showToast('📋 Đã copy Danh sách nhân sự!');
  },
  tapLogoSecret() {
    window._logoTaps = (window._logoTaps || 0) + 1;
    if (window._logoTaps >= 5) { window._logoTaps = 0; this.enterBackendPortal(); }
  },
  enterBackendPortal() { state.isBackendPortal = true; window.location.hash = 'admin'; renderApp(); },
  exitBackendPortal() { state.isBackendPortal = false; window.location.hash = ''; renderApp(); },
  async submitBackendAdminLogin() {
    try {
      await loginAdminWithEmail(state.adminLoginInput.email, state.adminLoginInput.password);
      showToast('✅ Đăng nhập Admin thành công!');
    } catch (e) { state.adminLoginInput.error = e.message; renderApp(); }
  }
};

window.ctpActions = {
  setMonth(m) { state.ctpMonth = Number(m); renderApp(); },
  setOwner(o) { state.ctpOwnerId = o; renderApp(); },
  toggleTask(id, k) {
    if (!state.ctpItems[id]) state.ctpItems[id] = { tasks: {}, extras: [] };
    if (state.ctpItems[id].tasks[k] !== undefined) delete state.ctpItems[id].tasks[k];
    else state.ctpItems[id].tasks[k] = getDefaultRateForTask(k, findAnyCtpShow(id));
    saveCtpState(); renderApp();
  },
  handleTaskPriceInput(id, k, el) {
    const num = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0;
    state.ctpItems[id].tasks[k] = num;
    el.value = num ? num.toLocaleString('vi-VN') : '';
    saveCtpState();
  },
  addExtraItem(id) {
    if (!state.ctpItems[id]) state.ctpItems[id] = { tasks: {}, extras: [] };
    state.ctpItems[id].extras.push({ name: '', amount: 0 });
    saveCtpState(); renderApp();
  },
  saveExtraField(id, idx, f, el) {
    const val = f === 'amount' ? (parseInt(String(el.value).replace(/\D/g, ''), 10) || 0) : el.value;
    state.ctpItems[id].extras[idx][f] = val;
    if (f === 'amount') el.value = val ? val.toLocaleString('vi-VN') : '';
    saveCtpState();
  },
  removeExtraItem(id, idx) { state.ctpItems[id].extras.splice(idx, 1); saveCtpState(); renderApp(); },
  saveNow() { saveCtpState(true); showToast('💾 Đã lưu CTP lên Cloud!'); },
  generateBill() {
    playStudioSound('lum');
    const shows = getCombinedCtpShows();
    let total = 0;
    const rows = shows.map((sh, i) => {
      const it = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
      const taskBulletsCompact = Object.entries(it.tasks || {}).map(([k, v]) => `- ${k}: ${formatCompactMoneyPlain(v)}`);
      const extraBulletsCompact = (it.extras || []).filter(e => e.amount > 0).map(e => `- ${e.name || 'Phí'}: ${formatCompactMoneyPlain(e.amount)}`);
      const showSum = Object.values(it.tasks || {}).reduce((s, v) => s + (Number(v) || 0), 0) + (it.extras || []).reduce((s, e) => s + (Number(e) || 0), 0);
      total += showSum;
      return { stt: i + 1, dateLabel: formatDayMonth(sh.startDate), location: sh.location, taskBulletsCompact, extraBulletsCompact, showSum };
    });
    state.ctpBillModal = { month: state.ctpMonth, memberName: getMember(state.currentUserId).name, ownerTitle: state.ctpOwnerId === 'all' ? 'Tất cả' : getMember(state.ctpOwnerId).name, rows, total };
    renderApp();
  },
  closeBillModal() { state.ctpBillModal = null; renderApp(); },
  captureBillImage() { captureElementToPreview('ctp-bill-capture-area', `CTP_T${state.ctpMonth}.png`, `Bảng CTP T${state.ctpMonth}`); }
};

window.ownerActions = {
  setMonth(m) { state.ownerMonth = Number(m); state.ownerAllMonths = false; renderApp(); },
  toggleAllMonths() { state.ownerAllMonths = !state.ownerAllMonths; renderApp(); },
  setFilterStatus(s) { state.ownerFilterStatus = s; renderApp(); },
  toggleExpandShow(id) { state.ownerExpandedShowId = state.ownerExpandedShowId === id ? null : id; renderApp(); },
  setStatus(id, s) { ensureOwnerFinRecord({ id }).status = s; saveOwnerFinanceState(); renderApp(); },
  setCrewCtpStatus(id, s) { const r = ensureOwnerFinRecord({ id }); r.crewMemberMeta[state.currentUserId].ctpStatus = s; saveOwnerFinanceState(); renderApp(); },
  handleMoneyInput(id, f, el) { const n = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0; ensureOwnerFinRecord({ id })[f] = n; el.value = n ? n.toLocaleString('vi-VN') : ''; saveOwnerFinanceState(); },
  handleCrewSelfExpenseInput(id, el) { const n = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0; ensureOwnerFinRecord({ id }).crewMemberMeta[state.currentUserId].selfExpense = n; el.value = n ? n.toLocaleString('vi-VN') : ''; saveOwnerFinanceState(); },
  saveShowFinanceNow() { saveOwnerFinanceState(true); state.ownerExpandedShowId = null; renderApp(); showToast('💾 Đã lưu Công nợ!'); }
};

window.adminProActions = {
  toggleAddMemberForm() {
    state.adminAddMemberOpen = !state.adminAddMemberOpen;
    renderApp();
  },
  async addNewMember() {
    const name = (document.getElementById('adm-add-name')?.value || '').trim();
    const legal = (document.getElementById('adm-add-legal')?.value || '').trim().toUpperCase();
    const bg = document.getElementById('adm-add-color')?.value || '#334155';
    const order = Number(document.getElementById('adm-add-order')?.value) || (state.members.length + 1);
    if (!name) return showToast('Vui lòng nhập tên nhân sự!', 'error');

    const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    const id = state.members.some(m => m.id === slug) ? `${slug}_${Date.now().toString().slice(-3)}` : (slug || `mem_${Date.now()}`);

    state.members.push({ id, name, shortLabel: name, bg, text: '#ffffff', order });
    if (legal) await saveOfficialLegalName(id, legal);
    state.adminAddMemberOpen = false;
    await pushAdminConfigToCloud();
    await logStudioActivity(`Thêm nhân sự mới: ${name}`);
    renderApp();
    showToast(`✅ Đã thêm nhân sự ${name}!`);
  },
  toggleEditMember(mid) {
    state.adminEditMemberId = state.adminEditMemberId === mid ? null : mid;
    renderApp();
  },
  async saveMemberAllInOne(mid) {
    const m = state.members.find(x => x.id === mid);
    if (!m) return;
    const name = (document.getElementById(`adm-ed-name-${mid}`)?.value || '').trim();
    const legal = (document.getElementById(`adm-ed-legal-${mid}`)?.value || '').trim().toUpperCase();
    const order = Number(document.getElementById(`adm-ed-ord-${mid}`)?.value) || m.order || 99;
    const bg = document.getElementById(`adm-ed-col-${mid}`)?.value || m.bg;
    const pin = (document.getElementById(`adm-ed-pin-${mid}`)?.value || '').replace(/\D/g, '').slice(0, 4);

    if (name) { m.name = name; m.shortLabel = name; }
    m.order = order;
    m.bg = bg;
    if (pin.length === 4) {
      state.memberPinHints = { ...(state.memberPinHints || {}), [mid]: pin };
      localStorage.setItem('as_member_pin_hints_2026', JSON.stringify(state.memberPinHints));
    }
    await saveOfficialLegalName(mid, legal);
    await pushAdminConfigToCloud();
    await logStudioActivity(`Cập nhật nhân sự: ${m.name}`);
    state.adminEditMemberId = null;
    renderApp();
    showToast(`💾 Đã lưu thông tin ${m.name}!`);
  },
  async deleteMemberFromAdmin(mid) {
    const m = state.members.find(x => x.id === mid);
    if (!m || !confirm(`Xóa nhân sự "${m.name}" khỏi danh sách ekip?`)) return;
    state.members = state.members.filter(x => x.id !== mid);
    if (state.adminEditMemberId === mid) state.adminEditMemberId = null;
    await pushAdminConfigToCloud();
    await logStudioActivity(`Xóa nhân sự: ${m.name}`);
    renderApp();
    showToast(`🗑️ Đã xóa ${m.name}!`);
  },
  setAdminTab(tab) { state.adminTab = tab; renderApp(); },
  pickNewColorSwatch(hex) {
    state.adminNewColorHex = hex;
    const inp = document.getElementById('adm-new-col-hex');
    if (inp) inp.value = hex;
    renderApp();
  },
  triggerLogoUpload() {
    document.getElementById('adm-logo-file-input')?.click();
  },
  async handleLogoUpload(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      state.customLogoDataUrl = String(dataUrl || '');
      localStorage.setItem('as_custom_logo_2026', state.customLogoDataUrl);
      await logStudioActivity('Cập nhật Logo Studio mới');
      renderApp();
      showToast('🖼️ Đã đổi Logo thành công!');
    } catch (err) {
      showToast('Lỗi tải ảnh logo: ' + err.message, 'error');
    } finally {
      inputEl.value = '';
    }
  },
  async resetLogoDefault() {
    state.customLogoDataUrl = '';
    localStorage.removeItem('as_custom_logo_2026');
    await logStudioActivity('Khôi phục Logo mặc định');
    renderApp();
    showToast('↩ Đã khôi phục Logo mặc định!');
  },
  async setMemberPin(mid) {
    const raw = (document.getElementById(`adm-ed-pin-${mid}`)?.value || '').replace(/\D/g, '').slice(0, 4);
    if (raw.length !== 4) return showToast('Mã PIN phải đủ 4 chữ số!', 'error');
    state.memberPinHints = { ...(state.memberPinHints || {}), [mid]: raw };
    localStorage.setItem('as_member_pin_hints_2026', JSON.stringify(state.memberPinHints));
    await logStudioActivity(`Cập nhật mã PIN cho ${getMember(mid).name} -> ${raw} (Pass Auth: AS2026#${raw})`);
    renderApp();
    showToast(`🔐 Đã lưu PIN ${raw} cho ${getMember(mid).name}! Nhớ đổi pass AS2026#${raw} trên Firebase Auth.`);
  },
  async resetMemberPinDefault(mid) {
    const inp = document.getElementById(`adm-ed-pin-${mid}`);
    if (inp) inp.value = '1234';
    state.memberPinHints = { ...(state.memberPinHints || {}), [mid]: '1234' };
    localStorage.setItem('as_member_pin_hints_2026', JSON.stringify(state.memberPinHints));
    await logStudioActivity(`Reset PIN mặc định 1234 cho ${getMember(mid).name}`);
    renderApp();
    showToast(`🔄 Đã đặt lại PIN 1234 cho ${getMember(mid).name}`);
  },
  copyAuthPassForMember(mid) {
    const pin = (document.getElementById(`adm-ed-pin-${mid}`)?.value || state.memberPinHints?.[mid] || '1234').replace(/\D/g, '').slice(0, 4) || '1234';
    const passStr = `AS2026#${pin}`;
    navigator.clipboard?.writeText(passStr);
    showToast(`📋 Đã copy mật khẩu Auth: ${passStr}`);
  },
  triggerRestoreJsonFile() {
    document.getElementById('adm-restore-json-input')?.click();
  },
  async handleRestoreJsonFile(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.shows)) return showToast('File JSON thiếu mảng shows!', 'error');
      if (!confirm(`Khôi phục ${data.shows.length} shows và cấu hình từ file "${file.name}"?`)) return;
      state.shows = data.shows;
      if (Array.isArray(data.visibleYears) && data.visibleYears.length) state.visibleYears = data.visibleYears;
      if (data.lockedMonths && typeof data.lockedMonths === 'object') state.lockedMonths = data.lockedMonths;
      if (data.ctpRatesConfig && typeof data.ctpRatesConfig === 'object') state.ctpRatesConfig = { ...state.ctpRatesConfig, ...data.ctpRatesConfig };
      if (Array.isArray(data.customColorRules)) state.customColorRules = data.customColorRules;
      if (data.memberProfiles && typeof data.memberProfiles === 'object') state.memberProfiles = { ...state.memberProfiles, ...data.memberProfiles };
      if (data.officialLegalNames && typeof data.officialLegalNames === 'object') state.officialLegalNames = { ...state.officialLegalNames, ...data.officialLegalNames };
      await syncShowsToCloud();
      await pushAdminConfigToCloud();
      await logStudioActivity(`Khôi phục dữ liệu từ file JSON (${data.shows.length} shows)`);
      renderApp();
      showToast('✅ Đã khôi phục dữ liệu từ file .JSON!');
    } catch (err) {
      showToast('Lỗi đọc file JSON: ' + err.message, 'error');
    } finally {
      inputEl.value = '';
    }
  },
  copyFullJsonToClipboard() {
    const payload = JSON.stringify({
      exportedAt: new Date().toISOString(),
      shows: state.shows,
      visibleYears: state.visibleYears,
      lockedMonths: state.lockedMonths,
      ctpRatesConfig: state.ctpRatesConfig,
      customColorRules: state.customColorRules,
      officialLegalNames: state.officialLegalNames
    }, null, 2);
    navigator.clipboard?.writeText(payload);
    showToast('📋 Đã copy toàn bộ JSON ra clipboard!');
  },
  async toggleMaintenanceMode() {
    state.readonlyMaintenanceMode = !state.readonlyMaintenanceMode;
    await pushAdminConfigToCloud();
    await logStudioActivity(state.readonlyMaintenanceMode ? 'Bật Khóa bảo trì' : 'Tắt Khóa bảo trì');
    renderApp();
  },
  async toggleYear(y) {
    const i = state.visibleYears.indexOf(y);
    if (i >= 0 && state.visibleYears.length > 1) state.visibleYears.splice(i, 1);
    else if (i < 0) state.visibleYears.push(y);
    state.visibleYears.sort((a, b) => a - b);
    await pushAdminConfigToCloud();
    renderApp();
  },
  setLockViewYear(y) {
    state.adminLockViewYear = Number(y);
    renderApp();
  },
  async toggleLockMonthAdmin(m) {
    const y = Number(state.adminLockViewYear) || 2026;
    const key = `${y}-${Number(m)}`;
    const cur = isYearMonthLocked(y, m);
    state.lockedMonths[key] = !cur;
    localStorage.setItem('as_locked_months_2026', JSON.stringify(state.lockedMonths));
    await pushAdminConfigToCloud();
    await logStudioActivity(`${!cur ? 'Khóa sổ' : 'Mở khóa'} Tháng ${m}/${y}`);
    renderApp();
  },
  async publishBroadcast() {
    const txt = (document.getElementById('adm-broadcast-inp')?.value || '').trim();
    if (!txt) return showToast('Vui lòng nhập nội dung thông báo!', 'error');
    state.studioBroadcast = { enabled: true, text: txt, updatedAt: Date.now() };
    localStorage.setItem('as_studio_broadcast_2026', JSON.stringify(state.studioBroadcast));
    await pushAdminConfigToCloud();
    await logStudioActivity(`Phát thông báo đầu app: "${txt}"`);
    renderApp();
    showToast('📢 Đã phát thông báo!');
  },
  async disableBroadcast() {
    state.studioBroadcast = { enabled: false, text: state.studioBroadcast?.text || '', updatedAt: Date.now() };
    localStorage.setItem('as_studio_broadcast_2026', JSON.stringify(state.studioBroadcast));
    await pushAdminConfigToCloud();
    renderApp();
  },
  async saveCtpRates() {
    const num = (id, def) => parseInt(String(document.getElementById(id)?.value || '').replace(/\D/g, ''), 10) || def;
    state.ctpRatesConfig = {
      quay1Day: num('adm-r-quay1', 1500000),
      quayMultiDay: num('adm-r-quayN', 1200000),
      chup1Day: num('adm-r-chup1', 1500000),
      chupMultiDay: num('adm-r-chupN', 1200000),
      dung: num('adm-r-dung', 1000000),
      flycam: num('adm-r-flycam', 1000000),
      lamhinh: num('adm-r-lamhinh', 300000),
      gimbal: num('adm-r-gimbal', 200000)
    };
    localStorage.setItem('as_ctp_rates_config_2026', JSON.stringify(state.ctpRatesConfig));
    await pushAdminConfigToCloud();
    await logStudioActivity('Cập nhật Đơn giá CTP mặc định');
    showToast('💰 Đã lưu Đơn giá CTP!');
  },
  async updateMemberColor(mid, hex) {
    const m = state.members.find(x => x.id === mid);
    if (!m) return;
    m.bg = hex;
    await pushAdminConfigToCloud();
    renderApp();
  },
  async updateMemberOrder(mid, ord) {
    const m = state.members.find(x => x.id === mid);
    if (!m) return;
    m.order = Number(ord) || 99;
    await pushAdminConfigToCloud();
    renderApp();
  },
  async addColorRule() {
    const kw = (document.getElementById('adm-new-col-kw')?.value || '').trim();
    const color = document.getElementById('adm-new-col-hex')?.value || state.adminNewColorHex || '#a7f3d0';
    if (!kw) return showToast('Vui lòng nhập từ khóa địa điểm!', 'error');
    state.customColorRules.unshift({ id: 'cr_' + Date.now(), keyword: kw, color });
    await this.saveAndApplyColors();
  },
  updateColorRule(id, field, val) {
    const r = state.customColorRules.find(x => x.id === id);
    if (r) r[field] = val;
  },
  async removeColorRule(id) {
    state.customColorRules = state.customColorRules.filter(x => x.id !== id);
    await this.saveAndApplyColors();
  },
  async saveAndApplyColors() {
    localStorage.setItem('as_custom_color_rules_2026', JSON.stringify(state.customColorRules));
    state.shows.forEach(sh => {
      if (sh) sh.color = resolveDynamicLocationColor(sh.location, sh.partner);
    });
    await syncShowsToCloud();
    await pushAdminConfigToCloud();
    renderApp();
    showToast('🎨 Đã lưu & áp dụng màu địa điểm!');
  },
  setAdminSearch(v) { state.adminSearch = v; renderApp(); },
  openInspectShow(id) { state.adminInspectShowId = id; renderApp(); },
  closeInspectShow() { state.adminInspectShowId = null; renderApp(); },
  async deleteShowFromAdmin(id) {
    const sh = state.shows.find(s => s && s.id === id);
    if (!sh || !confirm(`Xóa show "${sh.location}"?`)) return;
    state.deletedShowsTrash.unshift({ ...sh, deletedAt: Date.now() });
    state.shows = state.shows.filter(s => s && s.id !== id);
    state.adminInspectShowId = null;
    await syncShowsToCloud();
    await pushAdminConfigToCloud();
    await logStudioActivity(`Admin xóa show: ${sh.location}`);
    renderApp();
    showToast('🗑️ Đã xóa show!');
  },
  async restoreDeletedShow(id) {
    const idx = state.deletedShowsTrash.findIndex(s => s && s.id === id);
    if (idx < 0) return;
    const [restored] = state.deletedShowsTrash.splice(idx, 1);
    delete restored.deletedAt;
    state.shows.push(restored);
    await syncShowsToCloud();
    await pushAdminConfigToCloud();
    await logStudioActivity(`Khôi phục show: ${restored.location}`);
    renderApp();
    showToast('♻️ Đã khôi phục show!');
  },
  async saveLegalNameFromInput(mid) {
    const val = document.getElementById(`adm-legal-${mid}`)?.value || '';
    await saveOfficialLegalName(mid, val);
  },
  exportFullJsonBackup
};

window.holdBellActions = {
  openBellDrawer() { showToast('🔔 Danh sách giữ lịch đang được đồng bộ!'); },
  openQuickHoldSheet(dateStr) { appActions.openAddModal(dateStr); }
};

// Khởi chạy hệ thống
initPullToRefresh();
initAuthListener(
  () => {
    attachShowListeners();
    attachFinanceListeners(state.currentUserId);
  },
  () => {
    detachShowListeners();
    detachFinanceListeners();
  }
);
