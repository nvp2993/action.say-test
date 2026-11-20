import { state, registerRenderer, triggerRender } from './state/store.js';
import { initAuthListener, loginMemberWithPin, loginAdminWithEmail, changeMyPin, logoutCurrentUser } from './services/auth.service.js';
import { attachShowListeners, detachShowListeners, syncShowsToCloud, saveMyProfileToCloud, canEditShow, isYearMonthLocked, getVisiblePartnerText } from './services/show.service.js';
import { attachFinanceListeners, detachFinanceListeners, saveCtpState, saveOwnerFinanceState, getDefaultRateForTask, findAnyCtpShow, getCombinedCtpShows, ensureOwnerFinRecord } from './services/finance.service.js';
import { pushAdminConfigToCloud, logStudioActivity, exportFullJsonBackup } from './services/admin.service.js';
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

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  if (!state.authReady) {
    root.innerHTML = `<div class="h-[100dvh] flex items-center justify-center bg-slate-950 text-white text-xs font-bold">⏳ Đang kết nối Action &amp; Say Cloud...</div>`;
    return;
  }

  if (state.isBackendPortal) {
    root.innerHTML = `${renderAdminPortalHtml()}${renderToastHtml()}`;
    return;
  }

  if (!state.currentUserId) {
    root.innerHTML = `${renderPinModalHtml()}${renderToastHtml()}`;
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
}

registerRenderer(renderApp);

// Gắn các hành động ra window để HTML gọi mượt mà
window.state = state;
window.appActions = {
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
      const showSum = Object.values(it.tasks || {}).reduce((s, v) => s + (Number(v) || 0), 0) + (it.extras || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
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
  async toggleMaintenanceMode() { state.readonlyMaintenanceMode = !state.readonlyMaintenanceMode; await pushAdminConfigToCloud(); renderApp(); },
  async toggleYear(y) {
    const i = state.visibleYears.indexOf(y);
    if (i >= 0 && state.visibleYears.length > 1) state.visibleYears.splice(i, 1);
    else if (i < 0) state.visibleYears.push(y);
    state.visibleYears.sort((a, b) => a - b);
    await pushAdminConfigToCloud(); renderApp();
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