import { state, registerRenderer } from './state/store.js';
import { initAuthListener, loginMemberWithPin, loginAdminWithEmail, changeMyPin, logoutCurrentUser } from './services/auth.service.js';
import { attachShowListeners, detachShowListeners, syncShowsToCloud, saveMyProfileToCloud, canEditShow, isYearMonthLocked, getVisiblePartnerText, cleanupMatchingHoldsForOfficialShow } from './services/show.service.js';
import { attachFinanceListeners, detachFinanceListeners, saveCtpState, saveOwnerFinanceState, getDefaultRateForTask, findAnyCtpShow, getCombinedCtpShows, ensureOwnerFinRecord, calculateOwnerShowMetrics, calculateCrewShowMetrics } from './services/finance.service.js';
import { pushAdminConfigToCloud, logStudioActivity, applyColorsToAllShows, saveOfficialLegalName, exportFullJsonBackup } from './services/admin.service.js';
import { getTodayISO, getMember, resolveDynamicLocationColor, playStudioSound, showToast, formatDayMonth, formatCompactMoneyPlain, buildVietQrUrl } from './utils/helpers.js';
import { exportShowToAppleCalendar } from './utils/export.js';
import { initPullToRefresh } from './utils/pullToRefresh.js';

import { renderHeaderHtml, renderBottomNavHtml } from './ui/header.ui.js';
import { renderShowsTabHtml, renderDetailModalHtml } from './ui/shows.ui.js';
import { renderMatrixTabHtml } from './ui/matrix.ui.js';
import { renderCrewBoardTabHtml } from './ui/crewBoard.ui.js';
import { renderCtpTabHtml, renderCtpBillModalHtml } from './ui/ctp.ui.js';
import { renderDebtTabHtml } from './ui/debt.ui.js';
import {
  renderPinModalHtml,
  renderCrewPassModalHtml,
  renderFormModalHtml,
  renderToastHtml,
  renderCtpCustomShowModalHtml,
  renderHoldComposerModalHtml,
  renderHoldBellModalHtml,
  renderCrewManifestModalHtml,
  renderClientDebtBillModalHtml
} from './ui/modals.ui.js';
import { renderAdminPortalHtml } from './ui/admin.ui.js';

function getBankName(bin) {
  const map = {
    '970436': 'Vietcombank',
    '970415': 'VietinBank',
    '970418': 'BIDV',
    '970407': 'Techcombank',
    '970422': 'MB Bank',
    '970416': 'ACB',
    '970432': 'VPBank',
    '970423': 'TPBank',
    '970403': 'Sacombank',
    '970441': 'VIB'
  };
  return map[String(bin || '').trim()] || (bin ? `BIN ${bin}` : 'Ngân hàng');
}

function applyCustomLogoToDom() {
  const customLogo = state.customLogoDataUrl || localStorage.getItem('as_custom_logo_2026') || '';
  if (!customLogo) return;
  state.customLogoDataUrl = customLogo;
  document.querySelectorAll('img[src*="logo.png"]').forEach(img => {
    img.src = customLogo;
  });
  const fav = document.getElementById('favicon-link');
  const appleIcon = document.getElementById('apple-touch-icon-link');
  if (fav) fav.href = customLogo;
  if (appleIcon) appleIcon.href = customLogo;
}

function scrollActiveMonthIntoView() {
  const activeBtn = document.querySelector('.as-month-scroller .as-month-btn.active');
  if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
    activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

function getBellAlertsCount() {
  const uid = state.currentUserId;
  if (!uid) return 0;
  return (state.shows || []).filter(s =>
    s && s.isHold && !s.isCancelled &&
    (s.ownerId === uid || (s.memberIds || []).includes(uid))
  ).length;
}

async function loadQrBitmapIfAvailable(prof, fullName) {
  if (!prof?.bankAcc) return null;
  const qrUrl = buildVietQrUrl(prof.bankBin, prof.bankAcc);
  if (!qrUrl) return null;
  try {
    const resp = await fetch(qrUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    const objUrl = URL.createObjectURL(blob);
    return await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objUrl);
        resolve({ img, bankLabel: getBankName(prof.bankBin), acc: prof.bankAcc, holder: (fullName || '').toUpperCase() });
      };
      img.onerror = () => {
        URL.revokeObjectURL(objUrl);
        resolve(null);
      };
      img.src = objUrl;
    });
  } catch {
    return null;
  }
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

  const prevCtpScroll = document.getElementById('ctp-shows-scroll-list')?.scrollTop || 0;
  const prevDebtScroll = document.getElementById('owner-debt-scroll-list')?.scrollTop || 0;

  root.innerHTML = `
    ${renderHeaderHtml(getBellAlertsCount())}
    ${main}
    ${renderBottomNavHtml()}
    ${renderDetailModalHtml()}
    ${renderFormModalHtml()}
    ${renderCrewPassModalHtml()}
    ${renderCtpBillModalHtml()}
    ${renderCtpCustomShowModalHtml()}
    ${renderHoldComposerModalHtml()}
    ${renderHoldBellModalHtml()}
    ${renderCrewManifestModalHtml()}
    ${renderClientDebtBillModalHtml()}
    ${renderToastHtml()}
  `;
  applyCustomLogoToDom();
  scrollActiveMonthIntoView();

  if (prevCtpScroll > 0) {
    const nextCtpScroll = document.getElementById('ctp-shows-scroll-list');
    if (nextCtpScroll) nextCtpScroll.scrollTop = prevCtpScroll;
  }
  if (prevDebtScroll > 0) {
    const nextDebtScroll = document.getElementById('owner-debt-scroll-list');
    if (nextDebtScroll) nextDebtScroll.scrollTop = prevDebtScroll;
  }
}

registerRenderer(renderApp);

window.state = state;
window.appActions = {
  triggerVipAvatarUpload() {
    document.getElementById('vip-avatar-file-input')?.click();
  },
  async handleVipAvatarUpload(inputEl) {
    const file = inputEl?.files?.[0];
    if (!file) return;
    try {
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
    let savedShow = null;

    if (f.mode === 'edit') {
      state.shows = state.shows.map(s => {
        if (s.id !== f.showId) return s;
        savedShow = {
          ...s,
          ...f,
          isHold: false,
          externalCrew: cleanExt,
          color: resolveDynamicLocationColor(f.location, f.partner),
          updatedAt: Date.now()
        };
        return savedShow;
      });
      await logStudioActivity(`Sửa show: ${f.location}`);
    } else {
      const nextStt = Math.max(300, ...state.shows.map(s => Number(s.stt) || 0)) + 1;
      savedShow = {
        id: 'sh_' + Date.now(),
        stt: nextStt,
        ...f,
        isHold: false,
        externalCrew: cleanExt,
        postStatus: 'pending',
        color: resolveDynamicLocationColor(f.location, f.partner),
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      state.shows.push(savedShow);
      playStudioSound('noshow');
      await logStudioActivity(`Nổ show mới: ${f.location}`);
    }

    const removedHolds = cleanupMatchingHoldsForOfficialShow(savedShow);
    state.formModal = null;
    await syncShowsToCloud();
    renderApp();
    showToast(removedHolds > 0
      ? `✅ Đã lưu show & tự dọn ${removedHolds} lịch giữ chỗ trùng ngày!`
      : '✅ Đã lưu & đồng bộ Cloud!');
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
    state.crewManifestShowId = id;
    renderApp();
  },
  closeCrewManifestModal() {
    state.crewManifestShowId = null;
    renderApp();
  },
  copyCrewManifestText(id) {
    const sh = state.shows.find(s => s.id === id); if (!sh) return;
    const lines = (sh.memberIds || []).map((mid, i) => {
      const p = state.memberProfiles?.[mid] || {};
      const name = (state.officialLegalNames?.[mid] || p.fullName || getMember(mid).name).toUpperCase();
      return `${i + 1}. ${name} | CCCD: ${p.cccd || 'Chưa cập nhật'} | NS: ${p.dob || '-'} | SĐT: ${p.phone || '-'}`;
    });
    (sh.externalCrew || []).forEach((ext, j) => {
      lines.push(`${(sh.memberIds || []).length + j + 1}. ${String(ext.name || '').toUpperCase()} (Freelancer)`);
    });
    navigator.clipboard?.writeText(lines.join('\n'));
    showToast('📋 Đã copy Danh sách nhân sự book vé!');
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
    if (!state.ctpItems[id].tasks) state.ctpItems[id].tasks = {};
    const cur = state.ctpItems[id].tasks[k];
    if (cur !== undefined && cur !== null) {
      state.ctpItems[id].tasks[k] = null;
    } else {
      state.ctpItems[id].tasks[k] = getDefaultRateForTask(k, findAnyCtpShow(id));
    }
    saveCtpState();
    renderApp();
  },
  handleTaskPriceInput(id, k, el) {
    const num = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0;
    if (!state.ctpItems[id]) state.ctpItems[id] = { tasks: {}, extras: [] };
    state.ctpItems[id].tasks[k] = num;
    el.value = num ? num.toLocaleString('vi-VN') : '';
    this._refreshLiveTotals(id);
    saveCtpState();
  },
  addExtraItem(id) {
    if (!state.ctpItems[id]) state.ctpItems[id] = { tasks: {}, extras: [] };
    if (!Array.isArray(state.ctpItems[id].extras)) state.ctpItems[id].extras = [];
    state.ctpItems[id].extras.push({ name: '', amount: 0 });
    saveCtpState();
    renderApp();
  },
  saveExtraField(id, idx, f, el) {
    const val = f === 'amount' ? (parseInt(String(el.value).replace(/\D/g, ''), 10) || 0) : el.value;
    state.ctpItems[id].extras[idx][f] = val;
    if (f === 'amount') {
      el.value = val ? val.toLocaleString('vi-VN') : '';
      this._refreshLiveTotals(id);
    }
    saveCtpState();
  },
  removeExtraItem(id, idx) {
    state.ctpItems[id].extras.splice(idx, 1);
    saveCtpState();
    renderApp();
  },
  _refreshLiveTotals(showId) {
    const it = state.ctpItems[showId] || { tasks: {}, extras: [] };
    const taskSum = Object.entries(it.tasks || {}).reduce((s, [, v]) => (v !== null && v !== undefined) ? s + (Number(v) || 0) : s, 0);
    const extraSum = (it.extras || []).reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
    const sub = taskSum + extraSum;
    const showEl = document.getElementById(`ctp-show-total-${showId}`);
    if (showEl) showEl.textContent = sub.toLocaleString('vi-VN') + 'đ';

    let grand = 0;
    getCombinedCtpShows().forEach(sh => {
      const x = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
      Object.entries(x.tasks || {}).forEach(([, v]) => {
        if (v !== null && v !== undefined) grand += (Number(v) || 0);
      });
      (x.extras || []).forEach(ex => { grand += (Number(ex.amount) || 0); });
    });
    const grandEl = document.getElementById('ctp-grand-total-display');
    if (grandEl && !state.hideMoneyMode) grandEl.textContent = grand.toLocaleString('vi-VN') + 'đ';
  },
  openAddCustomShowModal() {
    const defaultDate = `${state.selectedYear}-${String(state.ctpMonth).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
    state.ctpCustomShowModal = {
      location: '',
      partner: '',
      startDate: defaultDate,
      endDate: defaultDate,
      ownerId: state.ctpOwnerId !== 'all' ? state.ctpOwnerId : state.currentUserId
    };
    renderApp();
  },
  closeAddCustomShowModal() {
    state.ctpCustomShowModal = null;
    renderApp();
  },
  submitAddCustomShow() {
    const location = (document.getElementById('ctp-ext-loc')?.value || '').trim();
    const partner = (document.getElementById('ctp-ext-partner')?.value || '').trim();
    const startDate = document.getElementById('ctp-ext-start')?.value || `${state.selectedYear}-${String(state.ctpMonth).padStart(2, '0')}-01`;
    const endDate = document.getElementById('ctp-ext-end')?.value || startDate;
    const ownerId = document.getElementById('ctp-ext-owner')?.value || state.currentUserId;
    if (!location) return showToast('Vui lòng nhập Địa điểm / Tên Show!', 'error');

    if (!Array.isArray(state.ctpCustomShows)) state.ctpCustomShows = [];
    state.ctpCustomShows.push({
      id: 'ctp_ext_' + Date.now(),
      location,
      partner,
      hidePartner: Boolean(partner),
      startDate,
      endDate,
      ownerId,
      memberIds: [state.currentUserId],
      isCustomCtp: true
    });
    state.ctpCustomShowModal = null;
    saveCtpState(true);
    renderApp();
    showToast('✅ Đã thêm show ngoài lịch vào cuối danh sách!');
  },
  autoFillFromRoles() {
    const shows = getCombinedCtpShows();
    let count = 0;
    const detectTaskKey = (raw) => {
      const s = String(raw || '').toLowerCase().trim();
      if (!s) return null;
      if (s.includes('quay') || s.includes('cam') || s.includes('video')) return 'quay';
      if (s.includes('dựng') || s.includes('dung') || s.includes('edit')) return 'dung';
      if (s.includes('chụp') || s.includes('chup') || s.includes('photo') || s.includes('ảnh')) return 'chup';
      if (s.includes('làm hình') || s.includes('lam hinh') || s.includes('hậu kỳ') || s.includes('retouch')) return 'lamhinh';
      if (s.includes('flycam') || s.includes('drone')) return 'flycam';
      if (s.includes('gimbal') || s.includes('stabilizer')) return 'gimbal';
      return null;
    };

    shows.forEach(sh => {
      const rawRoles = sh.roles?.[state.currentUserId];
      const list = Array.isArray(rawRoles) ? rawRoles : (rawRoles ? [rawRoles] : []);
      if (!list.length) return;
      if (!state.ctpItems[sh.id]) state.ctpItems[sh.id] = { tasks: {}, extras: [] };
      if (!state.ctpItems[sh.id].tasks) state.ctpItems[sh.id].tasks = {};
      list.forEach(r => {
        const key = detectTaskKey(r);
        if (key && (state.ctpItems[sh.id].tasks[key] === undefined || state.ctpItems[sh.id].tasks[key] === null)) {
          state.ctpItems[sh.id].tasks[key] = getDefaultRateForTask(key, sh);
          count++;
        }
      });
    });
    saveCtpState(true);
    renderApp();
    showToast(count > 0 ? `⚡ Đã tự điền ${count} nhiệm vụ theo vai trò!` : 'ℹ️ Không có nhiệm vụ mới nào cần điền thêm.');
  },
  saveNow() { saveCtpState(true); showToast('💾 Đã lưu CTP lên Cloud!'); },
  generateBill() {
    playStudioSound('lum');
    const shows = getCombinedCtpShows();
    const labelMap = { quay: 'Quay', dung: 'Dựng', chup: 'Chụp', lamhinh: 'Làm hình', flycam: 'Flycam', gimbal: 'Gimbal' };
    let total = 0;
    const rows = shows.map((sh, i) => {
      const it = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
      const activeTasks = Object.entries(it.tasks || {}).filter(([, v]) => v !== null && v !== undefined);
      const taskBulletsCompact = activeTasks.map(([k, v]) => `- ${labelMap[k] || k}: ${formatCompactMoneyPlain(v)}`);
      const extraBulletsCompact = (it.extras || []).filter(e => Number(e.amount) > 0).map(e => `- ${e.name || 'Phí'}: ${formatCompactMoneyPlain(e.amount)}`);
      const showSum = activeTasks.reduce((s, [, v]) => s + (Number(v) || 0), 0)
        + (it.extras || []).reduce((s, e) => s + (Number(e.amount) || 0), 0);
      total += showSum;
      return { stt: i + 1, dateLabel: formatDayMonth(sh.startDate), location: sh.location, taskBulletsCompact, extraBulletsCompact, showSum };
    });
    state.ctpBillModal = {
      month: state.ctpMonth,
      memberName: getMember(state.currentUserId).name,
      ownerTitle: state.ctpOwnerId === 'all' ? 'Tất cả' : getMember(state.ctpOwnerId).name,
      rows,
      total
    };
    renderApp();
  },
  closeBillModal() { state.ctpBillModal = null; renderApp(); },
  async captureBillImage() {
    const bm = state.ctpBillModal;
    if (!bm) return showToast('Không có dữ liệu Bill để chụp!', 'error');
    const prof = state.memberProfiles?.[state.currentUserId] || {};
    const fullName = (prof.fullName || bm.memberName || '').trim();
    const qrData = await loadQrBitmapIfAvailable(prof, fullName);

    const canvas = document.createElement('canvas');
    const W = 900;
    const rowH = 44;
    const H = 190 + Math.max(1, bm.rows.length) * rowH + (qrData ? 140 : 24);
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(`BẢNG CTP THÁNG ${bm.month}/${state.selectedYear}`, 28, 42);
    ctx.fillStyle = '#475569';
    ctx.font = '13px sans-serif';
    ctx.fillText(`Nhân sự: ${fullName}   •   Chủ show: ${bm.ownerTitle}`, 28, 66);

    const tableX = 28, tableY = 86, tableW = W - 56;
    const cols = [52, 86, 190, 210, 140, tableW - 52 - 86 - 190 - 210 - 140];
    const headers = ['STT', 'NGÀY', 'SHOW', 'NHIỆM VỤ', 'PHÁT SINH', 'TỔNG'];

    ctx.fillStyle = '#107c41';
    ctx.fillRect(tableX, tableY, tableW, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    let cx = tableX;
    headers.forEach((h, idx) => {
      ctx.fillText(h, cx + 8, tableY + 21);
      cx += cols[idx];
    });

    let ry = tableY + 34;
    bm.rows.forEach((r, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, ry, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, ry, tableW, rowH);

      let xPos = tableX;
      const cells = [
        String(r.stt),
        String(r.dateLabel || ''),
        String(r.location || ''),
        (r.taskBulletsCompact || []).join(', ') || '-',
        (r.extraBulletsCompact || []).join(', ') || '-',
        Number(r.showSum || 0).toLocaleString('vi-VN') + 'đ'
      ];
      cells.forEach((txt, cIdx) => {
        ctx.fillStyle = cIdx === 5 ? '#047857' : '#0f172a';
        ctx.font = cIdx === 5 ? 'bold 12px monospace' : '12px sans-serif';
        const clipped = txt.length > 34 ? txt.slice(0, 32) + '…' : txt;
        ctx.fillText(clipped, xPos + 8, ry + 26);
        xPos += cols[cIdx];
      });
      ry += rowH;
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tableX, ry, tableW, 38);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('TỔNG CỘNG:', tableX + tableW - cols[5] - 110, ry + 24);
    ctx.fillStyle = '#34d399';
    ctx.fillText(Number(bm.total || 0).toLocaleString('vi-VN') + 'đ', tableX + tableW - cols[5] + 8, ry + 24);

    if (qrData) {
      ry += 52;
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(tableX, ry, tableW, 108);
      ctx.strokeStyle = '#a7f3d0';
      ctx.strokeRect(tableX, ry, tableW, 108);
      ctx.fillStyle = '#064e3b';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`QUÉT MÃ VIETQR THANH TOÁN CTP`, tableX + 14, ry + 24);
      ctx.font = '12px sans-serif';
      ctx.fillText(`Ngân hàng: ${qrData.bankLabel}   •   STK: ${qrData.acc}`, tableX + 14, ry + 48);
      ctx.fillText(`Chủ TK: ${qrData.holder}`, tableX + 14, ry + 72);
      ctx.drawImage(qrData.img, tableX + tableW - 102, ry + 9, 90, 90);
    }

    const link = document.createElement('a');
    link.download = `CTP_T${state.ctpMonth}_${state.selectedYear}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('✅ Đã xuất ảnh Bill CTP (.PNG) thành công!');
  },
  copyBillText() {
    const bm = state.ctpBillModal;
    if (!bm) return;
    const lines = [
      `BẢNG CTP THÁNG ${bm.month}/${state.selectedYear} - ${bm.memberName.toUpperCase()}`,
      `Chủ show: ${bm.ownerTitle}`,
      '-----------------------'
    ];
    bm.rows.forEach(r => {
      if (r.showSum <= 0 && !r.taskBulletsCompact.length) return;
      lines.push(`${r.stt}. [${r.dateLabel}] ${r.location}: ${r.showSum.toLocaleString('vi-VN')}đ`);
      r.taskBulletsCompact.forEach(t => lines.push(`   ${t}`));
      r.extraBulletsCompact.forEach(e => lines.push(`   ${e}`));
    });
    lines.push('-----------------------');
    lines.push(`TỔNG CỘNG: ${bm.total.toLocaleString('vi-VN')}đ`);
    navigator.clipboard?.writeText(lines.join('\n'))
      .then(() => showToast('📋 Đã copy nội dung gửi Zalo!'))
      .catch(() => showToast('Không thể copy, vui lòng thử lại!', 'error'));
  },
  copyExcelTable() {
    const bm = state.ctpBillModal;
    if (!bm) return;
    const header = ['STT', 'NGÀY', 'SHOW', 'NHIỆM VỤ', 'PHÁT SINH', 'TỔNG'].join('\t');
    const body = bm.rows.map(r => [
      r.stt,
      r.dateLabel,
      r.location,
      r.taskBulletsCompact.join('; '),
      r.extraBulletsCompact.join('; '),
      r.showSum
    ].join('\t'));
    const footer = ['', '', '', '', 'TỔNG CỘNG', bm.total].join('\t');
    navigator.clipboard?.writeText([header, ...body, footer].join('\n'))
      .then(() => showToast('📋 Đã copy bảng (dán thẳng vào Excel/Sheets)!'))
      .catch(() => showToast('Không thể copy bảng!', 'error'));
  },
  exportBillExcelFile() {
    const bm = state.ctpBillModal;
    if (!bm) return;
    const rowsHtml = bm.rows.map(r => `
      <tr>
        <td>${r.stt}</td>
        <td>${r.dateLabel}</td>
        <td>${r.location}</td>
        <td>${r.taskBulletsCompact.join('<br/>')}</td>
        <td>${r.extraBulletsCompact.join('<br/>')}</td>
        <td>${r.showSum}</td>
      </tr>
    `).join('');
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body>
        <table border="1">
          <tr><th colspan="6">BẢNG CTP THÁNG ${bm.month}/${state.selectedYear} - ${bm.memberName}</th></tr>
          <tr><th>STT</th><th>NGÀY</th><th>SHOW</th><th>NHIỆM VỤ</th><th>PHÁT SINH</th><th>TỔNG</th></tr>
          ${rowsHtml}
          <tr><td colspan="5"><b>TỔNG CỘNG</b></td><td><b>${bm.total}</b></td></tr>
        </table>
      </body></html>
    `;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CTP_T${bm.month}_${state.selectedYear}_${bm.memberName}.xls`;
    a.click();
    showToast('📊 Đã tải file Excel về máy!');
  }
};

window.ownerActions = {
  setMonth(m) { state.ownerMonth = Number(m); state.ownerAllMonths = false; renderApp(); },
  toggleAllMonths() { state.ownerAllMonths = !state.ownerAllMonths; renderApp(); },
  setFilterStatus(s) { state.ownerFilterStatus = s; renderApp(); },
  toggleExpandShow(id) { state.ownerExpandedShowId = state.ownerExpandedShowId === id ? null : id; renderApp(); },
  setStatus(id, s) { ensureOwnerFinRecord(id).status = s; saveOwnerFinanceState(); renderApp(); },
  setCrewCtpStatus(id, s) {
    const r = ensureOwnerFinRecord(id);
    if (!r.crewMemberMeta[state.currentUserId]) r.crewMemberMeta[state.currentUserId] = { ctpStatus: 'unpaid', selfExpense: 0, selfExpenseNote: '' };
    r.crewMemberMeta[state.currentUserId].ctpStatus = s;
    saveOwnerFinanceState();
    renderApp();
  },
  handleMoneyInput(id, f, el) {
    const n = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0;
    ensureOwnerFinRecord(id)[f] = n;
    el.value = n ? n.toLocaleString('vi-VN') : '';
    saveOwnerFinanceState();
  },
  handleCrewSelfExpenseInput(id, el) {
    const n = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0;
    const r = ensureOwnerFinRecord(id);
    if (!r.crewMemberMeta[state.currentUserId]) r.crewMemberMeta[state.currentUserId] = { ctpStatus: 'unpaid', selfExpense: 0, selfExpenseNote: '' };
    r.crewMemberMeta[state.currentUserId].selfExpense = n;
    el.value = n ? n.toLocaleString('vi-VN') : '';
    saveOwnerFinanceState();
  },
  handleCrewNoteInput(id, val) {
    const r = ensureOwnerFinRecord(id);
    if (!r.crewMemberMeta[state.currentUserId]) r.crewMemberMeta[state.currentUserId] = { ctpStatus: 'unpaid', selfExpense: 0, selfExpenseNote: '' };
    r.crewMemberMeta[state.currentUserId].selfExpenseNote = val;
    saveOwnerFinanceState();
  },
  _recalcMemberCost(shId, mid) {
    const rec = ensureOwnerFinRecord(shId);
    const tMap = rec.crewTasks[mid] || {};
    const sum = Object.entries(tMap).reduce((s, [, v]) => (v !== null && v !== undefined) ? s + (Number(v) || 0) : s, 0);
    rec.crewCosts[mid] = sum;
  },
  toggleOwnerCrewTask(shId, mid, taskKey) {
    const sh = state.shows.find(s => s.id === shId);
    const rec = ensureOwnerFinRecord(shId);
    if (!rec.crewTasks[mid]) rec.crewTasks[mid] = {};
    const cur = rec.crewTasks[mid][taskKey];
    if (cur !== undefined && cur !== null) {
      rec.crewTasks[mid][taskKey] = null;
    } else {
      rec.crewTasks[mid][taskKey] = getDefaultRateForTask(taskKey, sh);
    }
    this._recalcMemberCost(shId, mid);
    saveOwnerFinanceState();
    renderApp();
  },
  handleOwnerCrewTaskInput(shId, mid, taskKey, el) {
    const num = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0;
    const rec = ensureOwnerFinRecord(shId);
    if (!rec.crewTasks[mid]) rec.crewTasks[mid] = {};
    rec.crewTasks[mid][taskKey] = num;
    el.value = num ? num.toLocaleString('vi-VN') : '';
    this._recalcMemberCost(shId, mid);
    saveOwnerFinanceState();
  },
  toggleSyncedCtpTask(shId, taskKey) {
    const sh = findAnyCtpShow(shId);
    if (!state.ctpItems[shId]) state.ctpItems[shId] = { tasks: {}, extras: [] };
    if (!state.ctpItems[shId].tasks) state.ctpItems[shId].tasks = {};
    const cur = state.ctpItems[shId].tasks[taskKey];
    if (cur !== undefined && cur !== null) {
      state.ctpItems[shId].tasks[taskKey] = null;
    } else {
      state.ctpItems[shId].tasks[taskKey] = getDefaultRateForTask(taskKey, sh);
    }
    saveCtpState();
    renderApp();
  },
  handleSyncedCtpTaskInput(shId, taskKey, el) {
    const num = parseInt(String(el.value).replace(/\D/g, ''), 10) || 0;
    if (!state.ctpItems[shId]) state.ctpItems[shId] = { tasks: {}, extras: [] };
    if (!state.ctpItems[shId].tasks) state.ctpItems[shId].tasks = {};
    state.ctpItems[shId].tasks[taskKey] = num;
    el.value = num ? num.toLocaleString('vi-VN') : '';
    saveCtpState();
  },
  addOwnerExpense(shId) {
    const rec = ensureOwnerFinRecord(shId);
    rec.otherExpenses.push({ name: '', amount: 0 });
    saveOwnerFinanceState();
    renderApp();
  },
  saveOwnerExpenseField(shId, idx, field, el) {
    const rec = ensureOwnerFinRecord(shId);
    if (!rec.otherExpenses[idx]) return;
    const val = field === 'amount' ? (parseInt(String(el.value).replace(/\D/g, ''), 10) || 0) : el.value;
    rec.otherExpenses[idx][field] = val;
    if (field === 'amount') el.value = val ? val.toLocaleString('vi-VN') : '';
    saveOwnerFinanceState();
  },
  removeOwnerExpense(shId, idx) {
    const rec = ensureOwnerFinRecord(shId);
    rec.otherExpenses.splice(idx, 1);
    saveOwnerFinanceState();
    renderApp();
  },
  saveShowFinanceNow() {
    saveCtpState(true);
    saveOwnerFinanceState(true);
    state.ownerExpandedShowId = null;
    renderApp();
    showToast('💾 Đã lưu & đồng bộ thông tin Công nợ + CTP!');
  },
  openClientDebtBill() {
    const uid = state.currentUserId;
    const curMem = getMember(uid);
    const ownedShows = (state.shows || []).filter(sh => {
      if (!sh || sh.isCancelled || sh.isHold || !sh.startDate) return false;
      if (sh.ownerId !== uid) return false;
      const [y, m] = sh.startDate.split('-').map(Number);
      if (y !== state.selectedYear) return false;
      if (!state.ownerAllMonths && m !== state.ownerMonth) return false;
      return true;
    }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

    const clientCounts = {};
    const rows = ownedShows.map((sh, i) => {
      const m = calculateOwnerShowMetrics(sh);
      const rawPartner = String(sh.partner || '').trim();
      const clientKey = rawPartner ? rawPartner.toLowerCase() : `_show_${sh.id}`;
      const clientLabel = rawPartner || sh.location || `Show #${i + 1}`;
      clientCounts[clientKey] = clientCounts[clientKey] || { key: clientKey, label: clientLabel, count: 0 };
      clientCounts[clientKey].count++;

      return {
        stt: i + 1,
        dateLabel: formatDayMonth(sh.startDate),
        title: `${sh.location}${rawPartner ? ` (${rawPartner})` : ''}`,
        clientKey,
        clientPrice: m.clientPrice,
        depositPaid: m.depositPaid,
        remaining: m.remainingClientDebt
      };
    });

    state.clientDebtBillModal = {
      periodLabel: state.ownerAllMonths ? `Cả năm ${state.selectedYear}` : `Tháng ${state.ownerMonth}/${state.selectedYear}`,
      ownerName: curMem.name,
      clientFilter: 'all',
      clients: Object.values(clientCounts),
      rows
    };
    renderApp();
  },
  setClientDebtFilter(clientKey) {
    if (!state.clientDebtBillModal) return;
    state.clientDebtBillModal.clientFilter = clientKey || 'all';
    renderApp();
  },
  closeClientDebtBill() {
    state.clientDebtBillModal = null;
    renderApp();
  },
  copyClientDebtText() {
    const dbm = state.clientDebtBillModal;
    if (!dbm) return;
    const clientFilter = dbm.clientFilter || 'all';
    const visibleRows = clientFilter === 'all' ? dbm.rows : dbm.rows.filter(r => r.clientKey === clientFilter);
    const chosenObj = (dbm.clients || []).find(c => c.key === clientFilter);
    const headerClient = clientFilter === 'all' ? 'Tất cả khách' : (chosenObj?.label || clientFilter);

    const totalPrice = visibleRows.reduce((s, r) => s + (Number(r.clientPrice) || 0), 0);
    const totalPaid = visibleRows.reduce((s, r) => s + (Number(r.depositPaid) || 0), 0);
    const totalRemaining = visibleRows.reduce((s, r) => s + (Number(r.remaining) || 0), 0);

    const lines = [
      `BẢNG CÔNG NỢ KHÁCH HÀNG (${dbm.periodLabel}) - ${headerClient.toUpperCase()}`,
      `Chủ show: ${dbm.ownerName.toUpperCase()}`,
      '-----------------------'
    ];
    visibleRows.forEach((r, idx) => {
      lines.push(`${idx + 1}. [${r.dateLabel}] ${r.title}: Báo ${Number(r.clientPrice || 0).toLocaleString('vi-VN')}đ | Đã trả ${Number(r.depositPaid || 0).toLocaleString('vi-VN')}đ | Còn nợ ${Number(r.remaining || 0).toLocaleString('vi-VN')}đ`);
    });
    lines.push('-----------------------');
    lines.push(`TỔNG BÁO GIÁ: ${totalPrice.toLocaleString('vi-VN')}đ`);
    lines.push(`ĐÃ THU: ${totalPaid.toLocaleString('vi-VN')}đ`);
    lines.push(`CÒN NỢ: ${totalRemaining.toLocaleString('vi-VN')}đ`);
    navigator.clipboard?.writeText(lines.join('\n'))
      .then(() => showToast('📋 Đã copy bảng công nợ gửi khách!'))
      .catch(() => showToast('Không thể copy, vui lòng thử lại!', 'error'));
  },
  async captureClientDebtBill() {
    const dbm = state.clientDebtBillModal;
    if (!dbm) return;
    const clientFilter = dbm.clientFilter || 'all';
    const visibleRows = clientFilter === 'all' ? dbm.rows : dbm.rows.filter(r => r.clientKey === clientFilter);
    const chosenObj = (dbm.clients || []).find(c => c.key === clientFilter);
    const headerClient = clientFilter === 'all' ? 'Tất cả khách' : (chosenObj?.label || clientFilter);
    const totalRemaining = visibleRows.reduce((s, r) => s + (Number(r.remaining) || 0), 0);

    const prof = state.memberProfiles?.[state.currentUserId] || {};
    const ownerFullName = (prof.fullName || dbm.ownerName || '').trim();
    const qrData = await loadQrBitmapIfAvailable(prof, ownerFullName);

    const canvas = document.createElement('canvas');
    const W = 900;
    const rowH = 42;
    const H = 150 + Math.max(1, visibleRows.length) * rowH + (qrData ? 140 : 24);
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`BẢNG CÔNG NỢ KHÁCH HÀNG (${dbm.periodLabel})`, 24, 38);
    ctx.fillStyle = '#475569';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Khách: ${headerClient}   •   Chủ show: ${dbm.ownerName}   •   Còn nợ: ${totalRemaining.toLocaleString('vi-VN')}đ`, 24, 60);

    let ry = 82;
    visibleRows.forEach((r, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(24, ry, W - 48, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(24, ry, W - 48, rowH);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(`${i + 1}. [${r.dateLabel}] ${r.title}`, 32, ry + 25);
      ctx.fillStyle = '#dc2626';
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`Nợ: ${Number(r.remaining || 0).toLocaleString('vi-VN')}đ`, W - 165, ry + 25);
      ry += rowH;
    });

    if (qrData) {
      ry += 16;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(24, ry, W - 48, 108);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(24, ry, W - 48, 108);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText(`THÔNG TIN THANH TOÁN VIETQR`, 38, ry + 24);
      ctx.font = '12px sans-serif';
      ctx.fillText(`Ngân hàng: ${qrData.bankLabel}   •   STK: ${qrData.acc}`, 38, ry + 48);
      ctx.fillText(`Chủ TK: ${qrData.holder}`, 38, ry + 72);
      ctx.drawImage(qrData.img, W - 126, ry + 9, 90, 90);
    }

    const a = document.createElement('a');
    a.download = `CongNo_Khach_${state.selectedYear}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('✅ Đã xuất ảnh bảng công nợ thành công!');
  },
  exportOwnerExcel() {
    const uid = state.currentUserId;
    const curMem = getMember(uid);
    const list = (state.shows || []).filter(sh => {
      if (!sh || sh.isCancelled || sh.isHold || !sh.startDate) return false;
      if (sh.ownerId !== uid && !(sh.memberIds || []).includes(uid)) return false;
      const [y, m] = sh.startDate.split('-').map(Number);
      if (y !== state.selectedYear) return false;
      if (!state.ownerAllMonths && m !== state.ownerMonth) return false;
      return true;
    });
    const rowsHtml = list.map((sh, i) => {
      const isOwner = sh.ownerId === uid;
      if (isOwner) {
        const m = calculateOwnerShowMetrics(sh);
        return `<tr><td>${i + 1}</td><td>${sh.startDate}</td><td>${sh.location}</td><td>Chủ show</td><td>${m.clientPrice}</td><td>${m.totalExpense}</td><td>${m.netProfit}</td></tr>`;
      }
      const cm = calculateCrewShowMetrics(sh);
      return `<tr><td>${i + 1}</td><td>${sh.startDate}</td><td>${sh.location}</td><td>CTP</td><td>${cm.grossCtp}</td><td>${cm.selfExpense}</td><td>${cm.netPocket}</td></tr>`;
    }).join('');
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="utf-8" /></head>
      <body>
        <table border="1">
          <tr><th colspan="7">CÔNG NỢ ${curMem.name} - NĂM ${state.selectedYear}</th></tr>
          <tr><th>STT</th><th>NGÀY</th><th>SHOW</th><th>VAI TRÒ</th><th>THU / CTP</th><th>CHI / TỰ TÚC</th><th>RÒNG</th></tr>
          ${rowsHtml}
        </table>
      </body></html>
    `;
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CongNo_${curMem.name}_${state.selectedYear}.xls`;
    a.click();
    showToast('📊 Đã xuất file Excel Công nợ!');
  }
};

window.adminProActions = {
  updateDefaultColorGroup(defId, field, val, fallbackKw, fallbackColor) {
    if (!Array.isArray(state.customColorRules)) state.customColorRules = [];
    let item = state.customColorRules.find(r => r?.id === defId);
    if (!item) {
      item = { id: defId, keyword: fallbackKw, color: fallbackColor };
      state.customColorRules.push(item);
    }
    item[field] = val;
    if (field === 'color') renderApp();
  },
  async resetDefaultColorGroup(defId) {
    if (!Array.isArray(state.customColorRules)) return;
    state.customColorRules = state.customColorRules.filter(r => r?.id !== defId);
    await pushAdminConfigToCloud();
    renderApp();
    showToast('↩ Đã khôi phục màu mặc định!');
  },
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
    const kwEl = document.getElementById('adm-new-col-kw');
    const hexEl = document.getElementById('adm-new-col-hex');
    const keyword = (kwEl?.value || '').trim();
    const color = hexEl?.value || state.adminNewColorHex || '#f2d0c9';
    if (!keyword) return showToast('Vui lòng nhập tên địa điểm!', 'error');

    if (!Array.isArray(state.customColorRules)) state.customColorRules = [];
    state.customColorRules.push({
      id: 'col_' + Date.now(),
      keyword,
      color
    });
    if (kwEl) kwEl.value = '';
    await pushAdminConfigToCloud();
    renderApp();
    showToast(`🎨 Đã thêm màu cho "${keyword}"!`);
  },
  updateColorRule(idx, field, val) {
    if (!state.customColorRules?.[idx]) return;
    state.customColorRules[idx][field] = val;
    if (field === 'color') renderApp();
  },
  async removeColorRule(idx) {
    if (!state.customColorRules?.[idx]) return;
    const removed = state.customColorRules[idx].keyword || 'màu';
    state.customColorRules.splice(idx, 1);
    await pushAdminConfigToCloud();
    renderApp();
    showToast(`🗑️ Đã xóa "${removed}"!`);
  },
  async saveAndApplyColors() {
    try {
      localStorage.setItem('as_custom_color_rules_2026', JSON.stringify(state.customColorRules || []));
      await pushAdminConfigToCloud();
      const updated = await applyColorsToAllShows();
      renderApp();
      showToast(`🎨 Đã lưu màu & cập nhật ${updated} show!`);
    } catch (err) {
      showToast('Lỗi lưu màu: ' + err.message, 'error');
    }
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
  openBellDrawer() {
    state.holdBellModalOpen = true;
    renderApp();
  },
  closeBellDrawer() {
    state.holdBellModalOpen = false;
    renderApp();
  },
  createQuickHold() {
    const today = getTodayISO();
    state.holdBellModalOpen = false;
    state.holdComposerModal = {
      startDate: today,
      endDate: today,
      ownerId: state.currentUserId,
      memberIds: [state.currentUserId],
      note: ''
    };
    renderApp();
  },
  closeHoldComposer() {
    state.holdComposerModal = null;
    renderApp();
  },
  toggleHoldMember(mid) {
    if (!state.holdComposerModal) return;
    if (!Array.isArray(state.holdComposerModal.memberIds)) state.holdComposerModal.memberIds = [];
    const idx = state.holdComposerModal.memberIds.indexOf(mid);
    if (idx >= 0) state.holdComposerModal.memberIds.splice(idx, 1);
    else state.holdComposerModal.memberIds.push(mid);
    renderApp();
  },
  async submitQuickHold() {
    const hm = state.holdComposerModal;
    if (!hm) return;
    const startDate = document.getElementById('hold-start-date')?.value || getTodayISO();
    const endDate = document.getElementById('hold-end-date')?.value || startDate;
    const ownerId = document.getElementById('hold-owner-id')?.value || state.currentUserId;
    const note = (document.getElementById('hold-note-inp')?.value || '').trim();
    const memberIds = Array.isArray(hm.memberIds) && hm.memberIds.length ? hm.memberIds : [state.currentUserId];
    const location = note || `Giữ lịch (${startDate})`;

    const newHold = {
      id: 'hold_' + Date.now(),
      stt: Math.max(300, ...state.shows.map(s => Number(s.stt) || 0)) + 1,
      location,
      note,
      startDate,
      endDate,
      memberIds,
      ownerId,
      creatorId: state.currentUserId,
      isHold: true,
      color: resolveDynamicLocationColor(location, ''),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    state.shows.push(newHold);
    state.holdComposerModal = null;
    await syncShowsToCloud();
    await logStudioActivity(`Giữ lịch: ${location}`);
    renderApp();
    showToast('⏳ Đã lưu giữ lịch & gửi thông báo!');
  },
  async releaseHold(id) {
    const idx = state.shows.findIndex(s => s && s.id === id);
    if (idx < 0) return;
    if (!confirm('Gỡ lịch giữ chỗ này?')) return;
    state.shows.splice(idx, 1);
    await syncShowsToCloud();
    renderApp();
    showToast('🗑️ Đã gỡ lịch giữ chỗ!');
  },
  openQuickHoldSheet(dateStr) {
    const d = dateStr || getTodayISO();
    state.holdBellModalOpen = false;
    state.holdComposerModal = {
      startDate: d,
      endDate: d,
      ownerId: state.currentUserId,
      memberIds: [state.currentUserId],
      note: ''
    };
    renderApp();
  }
};

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
