import { state, registerRenderer } from './state/store.js';
import { initAuthListener, loginMemberWithPin, loginAdminWithEmail, changeMyPin, logoutCurrentUser } from './services/auth.service.js';
import { attachShowListeners, detachShowListeners, syncShowsToCloud, saveMyProfileToCloud, canEditShow, isYearMonthLocked, getVisiblePartnerText, cleanupMatchingHoldsForOfficialShow } from './services/show.service.js';
import { attachFinanceListeners, detachFinanceListeners, saveCtpState, saveOwnerFinanceState, getDefaultRateForTask, findAnyCtpShow, getCombinedCtpShows, ensureOwnerFinRecord, calculateOwnerShowMetrics, calculateCrewShowMetrics } from './services/finance.service.js';
import { pushAdminConfigToCloud, logStudioActivity, applyColorsToAllShows, saveOfficialLegalName, exportFullJsonBackup } from './services/admin.service.js';
import { getTodayISO, getMember, resolveDynamicLocationColor, playStudioSound, showToast, formatDayMonth, formatCompactMoneyPlain, buildVietQrUrl, escapeHtml } from './utils/helpers.js';
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

const DEFAULT_STUDIO_LOGO = './assets/logo.png';
const FALLBACK_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-weight='900' font-size='22' fill='%23fbbf24'%3EA%C3%97S%3C/text%3E%3C/svg%3E";

function getTomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getTomorrowShowsList() {
  const tomorrowIso = getTomorrowISO();
  return (state.shows || []).filter(s =>
    s && !s.isCancelled && !s.isHold &&
    s.startDate && s.startDate <= tomorrowIso && (s.endDate || s.startDate) >= tomorrowIso
  );
}

function buildZaloTomorrowText() {
  const tomorrowIso = getTomorrowISO();
  const activeShows = getTomorrowShowsList();

  const lines = [
    `📋 ĐIỂM DANH NGÀY MAI (${formatDayMonth(tomorrowIso)})`,
    '────────────────────'
  ];

  if (!activeShows.length) {
    lines.push('Chưa có show chính thức nào cho ngày mai.');
    return lines.join('\n');
  }

  activeShows.forEach((sh, idx) => {
    const partner = getVisiblePartnerText(sh);
    const owner = getMember(sh.ownerId);
    const crewText = (sh.memberIds || []).map(mid => {
      const m = getMember(mid);
      const roles = Array.isArray(sh.roles?.[mid]) ? sh.roles[mid].filter(Boolean).join(', ') : '';
      return roles ? `${m.name} (${roles})` : m.name;
    });
    (sh.externalCrew || []).forEach((p, eIdx) => {
      const label = String(p?.name || '').trim() || `NS ${eIdx + 1}`;
      const roles = Array.isArray(p?.roles) ? p.roles.filter(Boolean).join(', ') : '';
      crewText.push(roles ? `🤝 ${label} (${roles})` : `🤝 ${label}`);
    });

    lines.push(`${idx + 1}. 📍 ${sh.location}${partner ? ` (${partner})` : ''} • Chủ: ${owner.name}`);
    lines.push(`   • NS: ${crewText.length ? crewText.join(', ') : 'Chưa gán'}`);
  });

  return lines.join('\n');
}

function renderZaloTomorrowModalHtml() {
  if (!state.zaloTomorrowModal) return '';
  const tomorrowIso = getTomorrowISO();
  const activeShows = getTomorrowShowsList();

  return `
    <div onclick="appActions.closeZaloTomorrowModal()" class="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4">
      <div onclick="event.stopPropagation()" class="ios-sheet bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3.5 text-xs shadow-2xl max-h-[88dvh] flex flex-col">
        <div class="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100 shrink-0">
          <div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase">
              <span>📅 Ngày mai • ${escapeHtml(formatDayMonth(tomorrowIso))}</span>
            </div>
            <h3 class="font-black text-base text-slate-900 mt-1">📋 Điểm danh ngày mai</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">${activeShows.length} show chính thức đang chạy</p>
          </div>
          <button type="button" onclick="appActions.closeZaloTomorrowModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center shrink-0">✕</button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto custom-scroll space-y-2.5 pr-0.5">
          ${activeShows.length === 0 ? `
            <div class="py-10 px-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-200 space-y-1.5">
              <div class="text-2xl">🌤️</div>
              <div class="font-bold text-slate-700">Chưa có show chính thức nào cho ngày mai</div>
              <div class="text-[11px] text-slate-400">Các lịch giữ chỗ tạm thời không tính vào điểm danh chính thức</div>
            </div>
          ` : activeShows.map((sh, idx) => {
            const partner = getVisiblePartnerText(sh);
            const owner = getMember(sh.ownerId);
            const membersHtml = (sh.memberIds || []).map(mid => {
              const m = getMember(mid);
              const roles = Array.isArray(sh.roles?.[mid]) ? sh.roles[mid].filter(Boolean).join(', ') : '';
              return `
                <div class="flex items-center justify-between gap-2 py-1 px-2.5 rounded-xl bg-white border border-slate-200/80">
                  <span class="font-extrabold text-slate-800">${escapeHtml(m.name)}</span>
                  <span class="text-[10.5px] font-semibold text-indigo-700 text-right">${escapeHtml(roles || 'Chưa gắn vai trò')}</span>
                </div>
              `;
            }).join('');

            const extHtml = (sh.externalCrew || []).map((p, eIdx) => {
              const label = String(p?.name || '').trim() || `NS ${eIdx + 1}`;
              const roles = Array.isArray(p?.roles) ? p.roles.filter(Boolean).join(', ') : '';
              return `
                <div class="flex items-center justify-between gap-2 py-1 px-2.5 rounded-xl bg-indigo-50/70 border border-indigo-200/80">
                  <span class="font-extrabold text-indigo-900">🤝 ${escapeHtml(label)}</span>
                  <span class="text-[10.5px] font-semibold text-indigo-700 text-right">${escapeHtml(roles || 'Freelancer')}</span>
                </div>
              `;
            }).join('');

            return `
              <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2.5">
                <div class="flex items-start justify-between gap-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="px-2 py-0.5 rounded-full bg-slate-900 text-white font-mono font-black text-[10px]">#${idx + 1}</span>
                      <span class="text-[10.5px] font-bold text-slate-500">Chủ show: <b class="text-slate-800">${escapeHtml(owner.name)}</b></span>
                    </div>
                    <div class="font-black text-slate-900 text-sm mt-1">
                      ${escapeHtml(sh.location)}
                      ${partner ? `<span class="text-slate-500 font-bold text-xs">(${escapeHtml(partner)})</span>` : ''}
                    </div>
                  </div>
                </div>

                <div class="space-y-1.5">
                  ${membersHtml}${extHtml}
                  ${(!membersHtml && !extHtml) ? `<div class="text-[11px] text-slate-400 italic">Chưa phân công nhân sự</div>` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="grid grid-cols-2 gap-2 pt-1 shrink-0">
          <button type="button" onclick="appActions.copyZaloTomorrowText()" class="py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition">📋 Copy gửi Zalo</button>
          <button type="button" onclick="appActions.closeZaloTomorrowModal()" class="py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs transition">Đóng</button>
        </div>
      </div>
    </div>
  `;
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

async function getPreviewFonts() {
  try {
    if (document.fonts?.ready) await document.fonts.ready;
  } catch {}
  const ui = getComputedStyle(document.body).fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const mono = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  return { ui, mono };
}

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

function getEffectiveLogoSrc() {
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

function applyCustomLogoToDom() {
  const logoSrc = getEffectiveLogoSrc();
  document.querySelectorAll('img[data-brand-logo="true"], img[alt="Action x Say"], img[src*="logo.png"]').forEach(img => {
    img.onerror = () => {
      img.onerror = null;
      img.src = FALLBACK_LOGO_SVG;
    };
    if (img.getAttribute('src') !== logoSrc) {
      img.src = logoSrc;
    }
  });
  const fav = document.getElementById('favicon-link');
  const appleIcon = document.getElementById('apple-touch-icon-link');
  if (fav && fav.getAttribute('href') !== logoSrc) fav.href = logoSrc;
  if (appleIcon && appleIcon.getAttribute('href') !== logoSrc) appleIcon.href = logoSrc;
}

function scrollActiveMonthIntoView() {
  const activeBtn = document.querySelector('.as-month-scroller .as-month-btn.active');
  if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
    activeBtn.scrollIntoView({ behavior: 'instant', inline: 'center', block: 'nearest' });
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
  const bankLabel = getBankName(prof.bankBin);
  const acc = String(prof.bankAcc).trim();
  const holder = (fullName || '').toUpperCase();
  const baseQrUrl = buildVietQrUrl(prof.bankBin, acc);
  if (!baseQrUrl) return null;

  const candidateUrls = [
    `https://wsrv.nl/?url=${encodeURIComponent(baseQrUrl)}&output=png`,
    baseQrUrl
  ];

  for (const url of candidateUrls) {
    try {
      const resp = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!resp.ok) continue;
      const blob = await resp.blob();
      const objUrl = URL.createObjectURL(blob);

      const img = await new Promise((resolve) => {
        const el = new Image();
        el.onload = () => {
          URL.revokeObjectURL(objUrl);
          resolve(el);
        };
        el.onerror = () => {
          URL.revokeObjectURL(objUrl);
          resolve(null);
        };
        el.src = objUrl;
      });

      if (img) return { img, qrUrl: baseQrUrl, bankLabel, acc, holder };
    } catch {
      // Thử URL tiếp theo
    }
  }

  return { img: null, qrUrl: baseQrUrl, bankLabel, acc, holder };
}

function downloadCanvasWithVietQrFallback(canvas, filename) {
  try {
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = filename;
    a.href = dataUrl;
    a.click();
    return true;
  } catch {
    return false;
  }
}

function renderApp() {
  const root = document.getElementById('app');
  if (!root) return;

  state.welcomeSplashVisible = false;

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
  const prevModalScroll = document.querySelector('.ios-sheet')?.scrollTop || 0;

  root.innerHTML = `
    ${renderHeaderHtml(getBellAlertsCount())}
    ${main}
    ${renderBottomNavHtml()}
    ${renderDetailModalHtml()}
    ${renderFormModalHtml()}
    ${renderZaloTomorrowModalHtml()}
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
  if (prevModalScroll > 0) {
    const nextModalScroll = document.querySelector('.ios-sheet');
    if (nextModalScroll) nextModalScroll.scrollTop = prevModalScroll;
  }
}

registerRenderer(renderApp);

window.state = state;
window.appActions = {
  openZaloTomorrowModal() {
    state.zaloTomorrowModal = true;
    renderApp();
  },
  closeZaloTomorrowModal() {
    state.zaloTomorrowModal = false;
    renderApp();
  },
  async copyZaloTomorrowText() {
    const txt = buildZaloTomorrowText();
    if (!txt) return;
    try {
      await navigator.clipboard.writeText(txt);
      showToast('✅ Đã copy danh sách điểm danh ngày mai!', 'info');
    } catch {
      showToast('Không thể copy tự động, anh chọn tay giúp em nhé!', 'error');
    }
  },
  async mergeHoldGroup(idsCsv) {
    const ids = String(idsCsv || '').split(',').filter(Boolean);
    if (ids.length < 2) return;
    const targets = state.shows.filter(s => ids.includes(s.id));
    if (targets.length < 2) return;

    const primary = targets[0];
    const mergedMembers = Array.from(new Set(targets.flatMap(t => t.memberIds || [])));
    const minStart = targets.map(t => t.startDate).filter(Boolean).sort()[0] || primary.startDate;
    const maxEnd = targets.map(t => t.endDate || t.startDate).filter(Boolean).sort().pop() || primary.endDate;

    primary.memberIds = mergedMembers;
    primary.startDate = minStart;
    primary.endDate = maxEnd;
    primary.holdSplitConfirmed = false;

    const removeSet = new Set(ids.slice(1));
    state.shows = state.shows.filter(s => !removeSet.has(s.id));
    await syncShowsToCloud?.();
    renderApp();
    showToast('✅ Đã gộp chung thành 1 lịch giữ chỗ!', 'info');
  },
  async keepHoldGroupSeparate(idsCsv) {
    const ids = new Set(String(idsCsv || '').split(',').filter(Boolean));
    state.shows.forEach(s => {
      if (ids.has(s.id)) s.holdSplitConfirmed = true;
    });
    await syncShowsToCloud?.();
    renderApp();
    showToast('Đã giữ riêng các lịch giữ chỗ này.', 'info');
  },
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
      try {
        localStorage.setItem('as_member_avatars_2026', JSON.stringify(savedAvatars));
      } catch {}

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
    const name = (state.officialLegalNames?.[state.currentUserId] || prof.fullName || m.name || '').toUpperCase();
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
    state.welcomeSplashVisible = false;
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
    state.formModal = {
      mode: 'edit',
      showId: sh.id,
      stt: sh.stt,
      location: sh.location,
      partner: sh.partner || '',
      hidePartner: !!sh.hidePartner,
      startDate: sh.startDate,
      endDate: sh.endDate,
      memberIds: [...(sh.memberIds || [])],
      roles: JSON.parse(JSON.stringify(sh.roles || {})),
      externalCrew: (sh.externalCrew || []).map((p, i) => ({
        name: p?.name || `NS ${i + 1}`,
        roles: Array.isArray(p?.roles) ? [...p.roles] : []
      })),
      ownerId: sh.ownerId,
      creatorId: sh.creatorId || sh.ownerId,
      error: ''
    };
    renderApp();
  },
  closeFormModal() { state.formModal = null; renderApp(); },
  updateFormField(k, v) {
    const f = state.formModal;
    if (!f) return;
    f[k] = v;

    if (k === 'startDate' && v) {
      if (!f.endDate || f.endDate < v) {
        f.endDate = v;
      } else if (f._prevStartDate && f.endDate >= f._prevStartDate) {
        const prevStart = new Date(`${f._prevStartDate}T00:00:00`).getTime();
        const prevEnd = new Date(`${f.endDate}T00:00:00`).getTime();
        const nextStart = new Date(`${v}T00:00:00`).getTime();
        if (!Number.isNaN(prevStart) && !Number.isNaN(prevEnd) && !Number.isNaN(nextStart)) {
          const spanDays = Math.round((prevEnd - prevStart) / 86400000);
          const d = new Date(nextStart + spanDays * 86400000);
          f.endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
      }
      f._prevStartDate = v;
    } else if (k === 'endDate' && v) {
      if (f.startDate && v < f.startDate) {
        f.startDate = v;
        f._prevStartDate = v;
      }
    }

    if (k === 'startDate' || k === 'endDate' || k === 'ownerId') {
      renderApp();
    }
  },
  selectOnlyMeInForm() {
    const f = state.formModal;
    if (!f) return;
    f.memberIds = state.currentUserId ? [state.currentUserId] : [];
    renderApp();
  },
  selectAllMembersInForm() {
    const f = state.formModal;
    if (!f) return;
    f.memberIds = (state.members || []).map(m => m.id);
    renderApp();
  },
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
  addExternalCrewDraft() {
    if (state.formModal) {
      state.formModal.externalCrew.push({ name: '', roles: [] });
      renderApp();
    }
  },
  updateExternalCrewName(idx, val) { if (state.formModal?.externalCrew[idx]) state.formModal.externalCrew[idx].name = val; },
  removeExternalCrewDraft(idx) { if (state.formModal) { state.formModal.externalCrew.splice(idx, 1); renderApp(); } },
  toggleExternalCrewRole(idx, roleId) {
    const f = state.formModal;
    if (!f || !Array.isArray(f.externalCrew) || !f.externalCrew[idx]) return;
    const cur = Array.isArray(f.externalCrew[idx].roles) ? [...f.externalCrew[idx].roles] : [];
    const existsIdx = cur.indexOf(roleId);
    if (existsIdx >= 0) cur.splice(existsIdx, 1);
    else cur.push(roleId);
    f.externalCrew[idx].roles = cur;
    renderApp();
  },
  async saveShowForm() {
    const f = state.formModal; if (!f) return;
    const loc = String(f.location || '').trim();
    if (!loc) { f.error = 'Vui lòng nhập địa điểm!'; return renderApp(); }
    f.location = loc;
    f.error = '';

    const dateStr = String(f.startDate || '').trim();
    if (dateStr) {
      const [y, m] = dateStr.split('-').map(Number);
      if (y && m && isYearMonthLocked(y, m)) {
        return showToast(`🔒 Tháng ${m}/${y} đã khóa sổ!`, 'error');
      }
    }

    const cleanExt = (f.externalCrew || [])
      .filter(p => p && (String(p.name || '').trim() || (Array.isArray(p.roles) && p.roles.length > 0)))
      .map((p, i) => ({
        name: String(p.name || '').trim() || `NS ${i + 1}`,
        roles: Array.isArray(p.roles) ? [...p.roles] : []
      }));

    try {
      let savedShow = null;
      const isEdit = f.mode === 'edit';

      if (isEdit) {
        state.shows = state.shows.map(s => {
          if (s.id !== f.showId) return s;
          savedShow = {
            ...s,
            ...f,
            location: loc,
            isHold: false,
            externalCrew: cleanExt,
            color: resolveDynamicLocationColor(loc, f.partner),
            updatedAt: Date.now()
          };
          return savedShow;
        });
      } else {
        const nextStt = Math.max(300, ...state.shows.map(s => Number(s.stt) || 0)) + 1;
        savedShow = {
          id: 'sh_' + Date.now(),
          stt: nextStt,
          ...f,
          location: loc,
          isHold: false,
          externalCrew: cleanExt,
          postStatus: 'pending',
          color: resolveDynamicLocationColor(loc, f.partner),
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        state.shows.push(savedShow);
        playStudioSound('noshow');
      }

      const removedHolds = cleanupMatchingHoldsForOfficialShow(savedShow);
      state.formModal = null;

      await syncShowsToCloud();
      await logStudioActivity(isEdit ? `Sửa show: ${loc}` : `Nổ show mới: ${loc}`);

      renderApp();
      showToast(removedHolds > 0
        ? `✅ Đã lưu show & tự dọn ${removedHolds} lịch giữ chỗ trùng ngày!`
        : '✅ Đã lưu & đồng bộ Cloud!');
    } catch (err) {
      console.error('SAVE_SHOW_ERROR:', err);
      f.error = 'Lỗi lưu show: ' + (err?.message || err);
      renderApp();
      showToast('❌ Lưu show thất bại: ' + (err?.message || err), 'error');
    }
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
        state.welcomeSplashVisible = false;
        renderApp();
        showToast(`Xin chào ${getMember(state.pinModal.selectedId).name}!`);
      } catch (err) {
        state.pinModal.pinInput = ''; state.pinModal.loading = false; state.pinModal.error = err.message; renderApp();
      }
    }
  },
  async logoutMember() { state.crewPassModal = false; state.welcomeSplashVisible = false; await logoutCurrentUser(); showToast('🔒 Đã đăng xuất!'); },
  async logoutAdminToNormalUser() {
    state.isAdminMode = false;
    state.isBackendPortal = false;
    window.location.hash = '';
    try {
      await logoutCurrentUser();
    } catch {}
    renderApp();
    showToast('Đã đăng xuất quyền Admin!');
  },
  openCrewPassModal() { state.crewPassModal = true; state.isEditingCrewProfile = false; renderApp(); },
  closeCrewPassModal() { state.crewPassModal = false; renderApp(); },
  toggleEditCrewProfile(v) { state.isEditingCrewProfile = v; renderApp(); },
  toggleVipInfoHidden() { state.vipInfoHidden = !state.vipInfoHidden; localStorage.setItem('as_vip_info_hidden', state.vipInfoHidden ? '1' : '0'); renderApp(); },
  async saveMyMemberProfile() {
    const fullName = document.getElementById('prof-fullname')?.value.trim() || '';
    await saveMyProfileToCloud(state.currentUserId, {
      ...state.memberProfiles[state.currentUserId],
      fullName,
      cccd: document.getElementById('prof-cccd')?.value.trim() || '',
      dob: document.getElementById('prof-dob')?.value.trim() || '',
      phone: document.getElementById('prof-phone')?.value.trim() || '',
      title: document.getElementById('prof-title')?.value.trim() || '',
      bankBin: document.getElementById('prof-bank-bin')?.value || '970436',
      bankAcc: (document.getElementById('prof-bank-acc')?.value || '').replace(/\s+/g, '')
    });
    if (fullName) {
      state.officialLegalNames = { ...(state.officialLegalNames || {}), [state.currentUserId]: fullName.toUpperCase() };
      await saveOfficialLegalName(state.currentUserId, fullName.toUpperCase());
    }
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
    state.crewManifestDraft = null;
    renderApp();
  },
  closeCrewManifestModal() {
    state.crewManifestShowId = null;
    state.crewManifestDraft = null;
    renderApp();
  },
  updateCrewManifestDraft(val) {
    state.crewManifestDraft = val;
  },
  resetCrewManifestDraft(id) {
    state.crewManifestDraft = null;
    renderApp();
    showToast('Đã khôi phục danh sách gốc!');
  },
  copyCrewManifestText(id) {
    const sh = state.shows.find(s => s.id === id);
    const taVal = document.getElementById('crew-manifest-textarea')?.value;
    const textToCopy = typeof taVal === 'string'
      ? taVal
      : (sh ? [
          ...(sh.memberIds || []).map((mid, i) => {
            const p = state.memberProfiles?.[mid] || {};
            const name = (state.officialLegalNames?.[mid] || p.fullName || getMember(mid).name).toUpperCase();
            return `${i + 1}. ${name} | CCCD: ${p.cccd || 'Chưa cập nhật'} | SĐT: ${p.phone || '-'}`;
          }),
          ...(sh.externalCrew || []).map((ext, j) => {
            const extName = String(ext?.name || '').trim().toUpperCase() || `NS ${j + 1}`;
            const roleText = Array.isArray(ext?.roles) && ext.roles.length > 0 ? ` (${ext.roles.join(', ')})` : '';
            return `${(sh.memberIds || []).length + j + 1}. ${extName}${roleText} | CCCD: ${ext?.cccd || 'Chưa cập nhật'} | SĐT: ${ext?.phone || '-'}`;
          })
        ].join('\n') : '');
    if (!textToCopy) return;
    navigator.clipboard?.writeText(textToCopy)
      .then(() => showToast('📋 Đã copy Danh sách nhân sự!'))
      .catch(() => showToast('Không thể copy, vui lòng thử lại!', 'error'));
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
  async toggleHoldBilling(showId) {
    const sh = state.shows.find(s => s.id === showId);
    if (!sh) return;
    sh.countHoldForBilling = !sh.countHoldForBilling;
    await syncShowsToCloud?.();
    renderApp();
    showToast(
      sh.countHoldForBilling ? '💰 Đã bật tính tiền cho show giữ chỗ này!' : '⏳ Đã tắt tính tiền show giữ chỗ.',
      'info'
    );
  },
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
    const bankHolderName = (state.officialLegalNames?.[state.currentUserId] || prof.fullName || bm.memberName || '').trim().toUpperCase();
    const qrData = await loadQrBitmapIfAvailable(prof, bankHolderName);
    const { ui, mono } = await getPreviewFonts();

    const canvas = document.createElement('canvas');
    const W = 940;
    const rowH = 44;
    const tableTotalH = 34 + Math.max(1, bm.rows.length) * rowH + 38;
    const H = 86 + tableTotalH + (qrData ? 148 : 24);
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0f172a';
    ctx.font = `800 20px ${ui}`;
    ctx.fillText(`BẢNG CTP THÁNG ${bm.month}/${state.selectedYear}`, 28, 42);
    ctx.fillStyle = '#475569';
    ctx.font = `500 13px ${ui}`;
    ctx.fillText(`Nhân sự: ${bm.memberName}   •   Chủ show: ${bm.ownerTitle}`, 28, 66);

    const tableX = 28, tableY = 86, tableW = W - 56;
    const cols = [52, 86, 190, 230, 140, tableW - 52 - 86 - 190 - 230 - 140];
    const headers = ['STT', 'NGÀY', 'SHOW', 'NHIỆM VỤ', 'PHÁT SINH', 'TỔNG'];

    ctx.save();
    drawRoundedRect(ctx, tableX, tableY, tableW, tableTotalH, 16);
    ctx.clip();

    ctx.fillStyle = '#107c41';
    ctx.fillRect(tableX, tableY, tableW, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 11px ${ui}`;
    let cx = tableX;
    headers.forEach((h, idx) => {
      if (idx === 5) {
        ctx.textAlign = 'right';
        ctx.fillText(h, cx + cols[idx] - 10, tableY + 21);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText(h, cx + 8, tableY + 21);
      }
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
        if (cIdx === 5) {
          ctx.fillStyle = '#047857';
          ctx.font = `700 12px ${mono}`;
          ctx.textAlign = 'right';
          ctx.fillText(txt, xPos + cols[cIdx] - 10, ry + 27);
          ctx.textAlign = 'left';
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = cIdx === 2 ? `700 12px ${ui}` : `500 12px ${ui}`;
          const clipped = txt.length > 36 ? txt.slice(0, 34) + '…' : txt;
          ctx.fillText(clipped, xPos + 8, ry + 27);
        }
        xPos += cols[cIdx];
      });
      ry += rowH;
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tableX, ry, tableW, 38);
    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 13px ${mono}`;
    ctx.textAlign = 'right';
    ctx.fillText('TỔNG CỘNG:', tableX + tableW - cols[5] - 12, ry + 24);
    ctx.fillStyle = '#34d399';
    ctx.fillText(Number(bm.total || 0).toLocaleString('vi-VN') + 'đ', tableX + tableW - 10, ry + 24);
    ctx.textAlign = 'left';
    ctx.restore();

    drawRoundedRect(ctx, tableX, tableY, tableW, tableTotalH, 16);
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    if (qrData) {
      const qrBoxY = tableY + tableTotalH + 14;
      const qrBoxH = 116;

      ctx.save();
      drawRoundedRect(ctx, tableX, qrBoxY, tableW, qrBoxH, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#0f172a';
      ctx.font = `800 12.5px ${ui}`;
      ctx.fillText('QUÉT MÃ VIETQR THANH TOÁN CTP', tableX + 18, qrBoxY + 25);

      ctx.fillStyle = '#334155';
      ctx.font = `500 12px ${ui}`;
      ctx.fillText('Ngân hàng: ', tableX + 18, qrBoxY + 50);
      ctx.font = `700 12px ${ui}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(qrData.bankLabel, tableX + 86, qrBoxY + 50);

      ctx.fillStyle = '#334155';
      ctx.font = `500 12px ${ui}`;
      ctx.fillText('Chủ TK: ', tableX + 18, qrBoxY + 73);
      ctx.font = `700 12px ${ui}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(qrData.holder, tableX + 68, qrBoxY + 73);

      ctx.fillStyle = '#334155';
      ctx.font = `500 12px ${ui}`;
      ctx.fillText('Số TK: ', tableX + 18, qrBoxY + 96);
      ctx.font = `700 12.5px ${mono}`;
      ctx.fillStyle = '#4338ca';
      ctx.fillText(qrData.acc, tableX + 60, qrBoxY + 96);

      const qrCardSize = 96;
      const qrCardX = tableX + tableW - qrCardSize - 14;
      const qrCardY = qrBoxY + 10;

      ctx.save();
      drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      ctx.clip();
      if (qrData.img) {
        ctx.drawImage(qrData.img, qrCardX + 4, qrCardY + 4, qrCardSize - 8, qrCardSize - 8);
      }
      ctx.restore();
    }

    const ok = downloadCanvasWithVietQrFallback(canvas, `CTP_T${state.ctpMonth}_${state.selectedYear}.png`);
    showToast(ok ? '✅ Đã xuất ảnh Bill CTP (.PNG) thành công!' : 'Lỗi xuất ảnh Bill CTP!', ok ? 'info' : 'error');
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
    const prof = state.memberProfiles?.[uid] || {};
    const ownerFullName = (state.officialLegalNames?.[uid] || prof.fullName || curMem.name || '').trim().toUpperCase();

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

      const defaultContent = m.rec.debtContent || m.rec.note || '';

      return {
        showId: sh.id,
        stt: i + 1,
        dateLabel: formatDayMonth(sh.startDate),
        title: `${sh.location}${rawPartner ? ` (${rawPartner})` : ''}`,
        content: defaultContent,
        clientKey,
        clientPrice: m.clientPrice,
        depositPaid: m.depositPaid,
        remaining: m.remainingClientDebt
      };
    });

    state.clientDebtBillModal = {
      periodLabel: state.ownerAllMonths ? `Cả năm ${state.selectedYear}` : `Tháng ${state.ownerMonth}/${state.selectedYear}`,
      ownerName: ownerFullName,
      clientFilter: 'all',
      clients: Object.values(clientCounts),
      rows
    };
    renderApp();
  },
  updateClientDebtRowContent(showId, val) {
    if (!state.clientDebtBillModal) return;
    const row = (state.clientDebtBillModal.rows || []).find(r => r.showId === showId);
    if (row) row.content = val;
    const rec = ensureOwnerFinRecord(showId);
    rec.debtContent = val;
    saveOwnerFinanceState();
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
    const headerClient = clientFilter === 'all' ? 'Tất cả khách hàng' : (chosenObj?.label || clientFilter);

    const totalPrice = visibleRows.reduce((s, r) => s + (Number(r.clientPrice) || 0), 0);
    const totalPaid = visibleRows.reduce((s, r) => s + (Number(r.depositPaid) || 0), 0);
    const totalRemaining = visibleRows.reduce((s, r) => s + (Number(r.remaining) || 0), 0);

    const lines = [
      `BẢNG CÔNG NỢ KHÁCH HÀNG (${dbm.periodLabel}) - ${headerClient.toUpperCase()}`,
      `Người phụ trách: ${dbm.ownerName.toUpperCase()}`,
      '-----------------------'
    ];
    visibleRows.forEach((r, idx) => {
      const desc = r.content ? ` [${r.content}]` : '';
      lines.push(`${idx + 1}. [${r.dateLabel}] ${r.title}${desc}: Báo ${Number(r.clientPrice || 0).toLocaleString('vi-VN')}đ | Đã trả ${Number(r.depositPaid || 0).toLocaleString('vi-VN')}đ | Còn nợ ${Number(r.remaining || 0).toLocaleString('vi-VN')}đ`);
    });
    lines.push('-----------------------');
    lines.push(`TỔNG BÁO GIÁ: ${totalPrice.toLocaleString('vi-VN')}đ`);
    lines.push(`ĐÃ THU: ${totalPaid.toLocaleString('vi-VN')}đ`);
    lines.push(`CÒN NỢ: ${totalRemaining.toLocaleString('vi-VN')}đ`);
    navigator.clipboard?.writeText(lines.join('\n'))
      .then(() => showToast('📋 Đã copy bảng công nợ gửi khách hàng!'))
      .catch(() => showToast('Không thể copy, vui lòng thử lại!', 'error'));
  },
  async captureClientDebtBill() {
    const dbm = state.clientDebtBillModal;
    if (!dbm) return;
    const clientFilter = dbm.clientFilter || 'all';
    const visibleRows = clientFilter === 'all' ? dbm.rows : dbm.rows.filter(r => r.clientKey === clientFilter);
    const chosenObj = (dbm.clients || []).find(c => c.key === clientFilter);
    const headerClient = clientFilter === 'all' ? 'Tất cả khách hàng' : (chosenObj?.label || clientFilter);

    const totalPrice = visibleRows.reduce((s, r) => s + (Number(r.clientPrice) || 0), 0);
    const totalPaid = visibleRows.reduce((s, r) => s + (Number(r.depositPaid) || 0), 0);
    const totalRemaining = visibleRows.reduce((s, r) => s + (Number(r.remaining) || 0), 0);

    const prof = state.memberProfiles?.[state.currentUserId] || {};
    const ownerFullName = (state.officialLegalNames?.[state.currentUserId] || prof.fullName || dbm.ownerName || '').trim().toUpperCase();
    const qrData = await loadQrBitmapIfAvailable(prof, ownerFullName);
    const { ui, mono } = await getPreviewFonts();

    const canvas = document.createElement('canvas');
    const W = 1080;
    const rowH = 44;
    const tableTotalH = 34 + Math.max(1, visibleRows.length) * rowH + 38;
    const H = 86 + tableTotalH + (qrData ? 148 : 28);
    canvas.width = W * 2;
    canvas.height = H * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#0f172a';
    ctx.font = `800 20px ${ui}`;
    ctx.fillText(`BẢNG CÔNG NỢ KHÁCH HÀNG — ${dbm.periodLabel}`, 28, 42);
    ctx.fillStyle = '#475569';
    ctx.font = `500 12.5px ${ui}`;
    ctx.fillText(`Khách hàng: ${headerClient}   •   Người phụ trách: ${ownerFullName}   •   Còn thiếu: ${totalRemaining.toLocaleString('vi-VN')}đ`, 28, 66);

    const tableX = 28, tableY = 86, tableW = W - 56;
    const cols = [48, 72, 210, 250, 148, 128, tableW - 48 - 72 - 210 - 250 - 148 - 128];
    const headers = ['STT', 'NGÀY', 'SHOW / KHÁCH HÀNG', 'NỘI DUNG', 'BÁO GIÁ', 'ĐÃ TRẢ', 'CÒN NỢ'];

    ctx.save();
    drawRoundedRect(ctx, tableX, tableY, tableW, tableTotalH, 16);
    ctx.clip();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tableX, tableY, tableW, 34);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 10.5px ${ui}`;
    let cx = tableX;
    headers.forEach((h, idx) => {
      if (idx >= 4) {
        ctx.textAlign = 'right';
        ctx.fillText(h, cx + cols[idx] - 10, tableY + 21);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText(h, cx + 8, tableY + 21);
      }
      cx += cols[idx];
    });

    let ry = tableY + 34;
    visibleRows.forEach((r, i) => {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      ctx.fillRect(tableX, ry, tableW, rowH);
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(tableX, ry, tableW, rowH);

      const vals = [
        String(i + 1),
        String(r.dateLabel || ''),
        String(r.title || ''),
        String(r.content || '-'),
        Number(r.clientPrice || 0).toLocaleString('vi-VN') + 'đ',
        Number(r.depositPaid || 0).toLocaleString('vi-VN') + 'đ',
        Number(r.remaining || 0).toLocaleString('vi-VN') + 'đ'
      ];

      let xPos = tableX;
      vals.forEach((txt, cIdx) => {
        if (cIdx === 6) {
          ctx.fillStyle = '#dc2626';
          ctx.font = `700 11.5px ${mono}`;
          ctx.textAlign = 'right';
          ctx.fillText(txt, xPos + cols[cIdx] - 10, ry + 27);
          ctx.textAlign = 'left';
        } else if (cIdx === 5) {
          ctx.fillStyle = '#047857';
          ctx.font = `700 11.5px ${mono}`;
          ctx.textAlign = 'right';
          ctx.fillText(txt, xPos + cols[cIdx] - 10, ry + 27);
          ctx.textAlign = 'left';
        } else if (cIdx === 4) {
          ctx.fillStyle = '#0f172a';
          ctx.font = `700 11.5px ${mono}`;
          ctx.textAlign = 'right';
          ctx.fillText(txt, xPos + cols[cIdx] - 10, ry + 27);
          ctx.textAlign = 'left';
        } else {
          ctx.fillStyle = cIdx === 2 ? '#0f172a' : '#334155';
          ctx.font = cIdx === 2 ? `700 11.5px ${ui}` : `500 11.5px ${ui}`;
          const maxLen = cIdx === 3 ? 38 : cIdx === 2 ? 32 : 16;
          const clipped = txt.length > maxLen ? txt.slice(0, maxLen - 1) + '…' : txt;
          ctx.fillText(clipped, xPos + 8, ry + 27);
        }
        xPos += cols[cIdx];
      });
      ry += rowH;
    });

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(tableX, ry, tableW, 38);
    ctx.fillStyle = '#fbbf24';
    ctx.font = `700 12px ${mono}`;
    ctx.textAlign = 'right';
    ctx.fillText('TỔNG CỘNG:', tableX + cols[0] + cols[1] + cols[2] + cols[3] - 12, ry + 24);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(totalPrice.toLocaleString('vi-VN') + 'đ', tableX + cols[0] + cols[1] + cols[2] + cols[3] + cols[4] - 10, ry + 24);
    ctx.fillStyle = '#34d399';
    ctx.fillText(totalPaid.toLocaleString('vi-VN') + 'đ', tableX + cols[0] + cols[1] + cols[2] + cols[3] + cols[4] + cols[5] - 10, ry + 24);
    ctx.fillStyle = '#fb7185';
    ctx.fillText(totalRemaining.toLocaleString('vi-VN') + 'đ', tableX + tableW - 10, ry + 24);
    ctx.textAlign = 'left';
    ctx.restore();

    drawRoundedRect(ctx, tableX, tableY, tableW, tableTotalH, 16);
    ctx.strokeStyle = '#cbd5e1';
    ctx.stroke();

    if (qrData) {
      const qrBoxY = tableY + tableTotalH + 14;
      const qrBoxH = 116;

      ctx.save();
      drawRoundedRect(ctx, tableX, qrBoxY, tableW, qrBoxH, 18);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#0f172a';
      ctx.font = `800 12.5px ${ui}`;
      ctx.fillText('QUÉT MÃ VIETQR THANH TOÁN', tableX + 18, qrBoxY + 25);

      ctx.fillStyle = '#334155';
      ctx.font = `500 12px ${ui}`;
      ctx.fillText('Ngân hàng: ', tableX + 18, qrBoxY + 50);
      ctx.font = `700 12px ${ui}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(qrData.bankLabel, tableX + 86, qrBoxY + 50);

      ctx.fillStyle = '#334155';
      ctx.font = `500 12px ${ui}`;
      ctx.fillText('Chủ TK: ', tableX + 18, qrBoxY + 73);
      ctx.font = `700 12px ${ui}`;
      ctx.fillStyle = '#0f172a';
      ctx.fillText(qrData.holder, tableX + 68, qrBoxY + 73);

      ctx.fillStyle = '#334155';
      ctx.font = `500 12px ${ui}`;
      ctx.fillText('Số TK: ', tableX + 18, qrBoxY + 96);
      ctx.font = `700 12.5px ${mono}`;
      ctx.fillStyle = '#4338ca';
      ctx.fillText(qrData.acc, tableX + 60, qrBoxY + 96);

      const qrCardSize = 96;
      const qrCardX = tableX + tableW - qrCardSize - 14;
      const qrCardY = qrBoxY + 10;

      ctx.save();
      drawRoundedRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 14);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();
      ctx.clip();
      if (qrData.img) {
        ctx.drawImage(qrData.img, qrCardX + 4, qrCardY + 4, qrCardSize - 8, qrCardSize - 8);
      }
      ctx.restore();
    }

    const ok = downloadCanvasWithVietQrFallback(canvas, `CongNo_KhachHang_${state.selectedYear}.png`);
    showToast(ok ? '✅ Đã xuất ảnh bảng công nợ khách hàng!' : 'Lỗi xuất ảnh bảng công nợ!', ok ? 'info' : 'error');
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
        return `<tr><td>${i + 1}</td><td>${sh.startDate}</td><td>${sh.location}</td><td>Người phụ trách</td><td>${m.clientPrice}</td><td>${m.totalExpense}</td><td>${m.netProfit}</td></tr>`;
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
  setPerfPeriodMode(mode) {
    state.adminPerfMode = mode === 'year' ? 'year' : 'month';
    renderApp();
  },
  setPerfPeriodValue(val) {
    if ((state.adminPerfMode || 'month') === 'year') {
      state.adminPerfYear = Number(val) || 2026;
    } else {
      state.adminPerfMonth = Number(val) || (new Date().getMonth() + 1);
    }
    renderApp();
  },
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
      const cleanLogo = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            const maxSide = 256;
            const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
            const w = Math.max(1, Math.round((img.width || 256) * scale));
            const h = Math.max(1, Math.round((img.height || 256) * scale));
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/png'));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      });

      state.customLogoDataUrl = cleanLogo;
      state.customLogoUrl = cleanLogo;
      try {
        localStorage.setItem('as_custom_logo_2026', cleanLogo);
      } catch {}
      applyCustomLogoToDom();
      await pushAdminConfigToCloud?.();
      await logStudioActivity('Cập nhật Logo Studio mới');
      renderApp();
      showToast('🖼️ Đã đổi & đồng bộ Logo thành công!');
    } catch (err) {
      showToast('Lỗi tải ảnh logo: ' + err.message, 'error');
    } finally {
      inputEl.value = '';
    }
  },
  async resetLogoDefault() {
    state.customLogoDataUrl = '';
    state.customLogoUrl = '';
    try {
      localStorage.removeItem('as_custom_logo_2026');
    } catch {}
    applyCustomLogoToDom();
    await pushAdminConfigToCloud?.();
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
    const y = Number(state.adminLockViewYear) || Number(state.selectedYear) || 2026;
    const monthNum = Number(m);
    const key = `${y}-${monthNum}`;
    if (!state.lockedMonths || typeof state.lockedMonths !== 'object') {
      state.lockedMonths = {};
    }
    const nextLocked = !Boolean(state.lockedMonths[key]);
    state.lockedMonths[key] = nextLocked;
    try {
      localStorage.setItem('as_locked_months_2026', JSON.stringify(state.lockedMonths));
    } catch {}
    renderApp();
    showToast(nextLocked ? `🔒 Đã khóa sổ Tháng ${monthNum}/${y}` : `🔓 Đã mở khóa Tháng ${monthNum}/${y}`);
    try {
      await pushAdminConfigToCloud();
      await logStudioActivity(`${nextLocked ? 'Khóa sổ' : 'Mở khóa'} Tháng ${monthNum}/${y}`);
    } catch (err) {
      showToast(`⚠️ Đã đổi cục bộ, lỗi Cloud: ${err?.message || err}`, 'error');
    }
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
```[cite: 7]

---

### 2. File `admin.ui.js` (đầy đủ)

```javascript
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

function renderCrewLeaderboardHtml(membersSorted) {
  const now = new Date();
  const perfMode = state.adminPerfMode || 'month';
  const perfYear = Number(state.adminPerfYear) || Number(state.selectedYear) || now.getFullYear();
  const perfMonth = Number(state.adminPerfMonth) || (now.getMonth() + 1);
  const monthPrefix = `${perfYear}-${String(perfMonth).padStart(2, '0')}-`;
  const yearPrefix = `${perfYear}-`;

  const periodShows = (state.shows || []).filter(s => {
    if (!s || s.isCancelled || s.isHold) return false;
    const start = String(s.startDate || '');
    const end = String(s.endDate || s.startDate || '');
    if (perfMode === 'year') {
      return start.startsWith(yearPrefix) || end.startsWith(yearPrefix);
    }
    return start.startsWith(monthPrefix) || end.startsWith(monthPrefix);
  });

  const ranked = membersSorted
    .map(m => {
      const cnt = periodShows.filter(s => (s.memberIds || []).includes(m.id)).length;
      return { ...m, cnt };
    })
    .sort((a, b) => {
      if (b.cnt !== a.cnt) return b.cnt - a.cnt;
      return (a.order ?? 99) - (b.order ?? 99);
    });

  const maxCnt = Math.max(1, ...ranked.map(r => r.cnt));
  const yearOptions = Array.from(new Set([...(state.visibleYears || [2026, 2027]), perfYear])).sort((a, b) => a - b);

  return `
    <div class="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div class="font-black text-xs uppercase tracking-wide text-slate-900 flex items-center gap-1.5">
            <span>🏆 Bảng Xếp Hạng Thi Đua Ekip (${membersSorted.length} người)</span>
          </div>
          <div class="text-[10.5px] text-slate-400 font-semibold mt-0.5">
            ${perfMode === 'month' ? `Đua top Tháng ${perfMonth}/${perfYear}` : `Đua top Cả Năm ${perfYear}`} • Tổng ${periodShows.length} show
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <div class="inline-flex p-0.5 rounded-xl bg-slate-100 border border-slate-200/70 text-[10.5px] font-extrabold">
            <button type="button" onclick="adminProActions.setPerfPeriodMode('month')" class="px-2.5 py-1 rounded-lg transition ${perfMode === 'month' ? 'bg-slate-900 text-amber-400 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">Theo Tháng</button>
            <button type="button" onclick="adminProActions.setPerfPeriodMode('year')" class="px-2.5 py-1 rounded-lg transition ${perfMode === 'year' ? 'bg-slate-900 text-amber-400 shadow-2xs' : 'text-slate-600 hover:text-slate-900'}">Theo Năm</button>
          </div>

          ${perfMode === 'month' ? `
            <select onchange="adminProActions.setPerfPeriodValue(this.value)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-800 focus:outline-none">
              ${[1,2,3,4,5,6,7,8,9,10,11,12].map(m => `<option value="${m}" ${perfMonth === m ? 'selected' : ''}>Tháng ${m}/${perfYear}</option>`).join('')}
            </select>
          ` : `
            <select onchange="adminProActions.setPerfPeriodValue(this.value)" class="px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] font-black text-slate-800 focus:outline-none">
              ${yearOptions.map(y => `<option value="${y}" ${perfYear === y ? 'selected' : ''}>Năm ${y}</option>`).join('')}
            </select>
          `}
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        ${ranked.map((m, idx) => {
          const rank = idx + 1;
          const pct = m.cnt > 0 ? Math.max(8, Math.round((m.cnt / maxCnt) * 100)) : 0;

          let cardCls = 'bg-slate-50/90 border-slate-200/80';
          let rankBadge = `<span class="w-5 h-5 rounded-full bg-slate-200/80 text-slate-600 font-mono font-black text-[10px] flex items-center justify-center shrink-0">#${rank}</span>`;
          let barCls = 'bg-slate-400';

          if (rank === 1 && m.cnt > 0) {
            cardCls = 'bg-gradient-to-r from-amber-50 via-yellow-50/80 to-amber-50/60 border-amber-300 ring-1 ring-amber-200/70';
            rankBadge = `<span class="text-base leading-none shrink-0" title="Top 1">🥇</span>`;
            barCls = 'bg-amber-500';
          } else if (rank === 2 && m.cnt > 0) {
            cardCls = 'bg-gradient-to-r from-slate-100 via-slate-50 to-white border-slate-300';
            rankBadge = `<span class="text-base leading-none shrink-0" title="Top 2">🥈</span>`;
            barCls = 'bg-slate-500';
          } else if (rank === 3 && m.cnt > 0) {
            cardCls = 'bg-gradient-to-r from-orange-50/80 via-amber-50/40 to-white border-orange-200';
            rankBadge = `<span class="text-base leading-none shrink-0" title="Top 3">🥉</span>`;
            barCls = 'bg-orange-400';
          }

          return `
            <div class="p-2.5 rounded-2xl border ${cardCls} flex flex-col gap-1.5 transition">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  ${rankBadge}
                  <span style="background:${m.bg};color:${m.text}" class="px-2.5 py-0.5 rounded-full text-[10.5px] font-black truncate">${escapeHtml(m.shortLabel)}</span>
                  ${rank === 1 && m.cnt > 0 ? `<span class="px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[8.5px] tracking-wider uppercase shrink-0">MVP</span>` : ''}
                </div>
                <div class="flex items-baseline gap-1 shrink-0">
                  <span class="font-mono font-black text-sm ${rank === 1 && m.cnt > 0 ? 'text-amber-700' : 'text-slate-900'}">${m.cnt}</span>
                  <span class="text-[9.5px] font-bold text-slate-400">show</span>
                </div>
              </div>
              <div class="w-full h-1.5 rounded-full bg-slate-200/70 overflow-hidden">
                <div style="width:${pct}%" class="h-full rounded-full ${barCls} transition-all duration-300"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
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

      ${renderCrewLeaderboardHtml(membersSorted)}

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
```[cite: 8]

Bạn copy đè đúng từng file lên repo, push xong đợi Vercel build rồi bấm `Ctrl + Shift + R` trên web là chạy mượt lại ngay.
