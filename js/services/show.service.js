import { doc, setDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, APP_ID } from '../config/firebase.js';
import { state, triggerRender } from '../state/store.js';
import { getMember, resolveDynamicLocationColor, showToast } from '../utils/helpers.js';

let unsubs = [];

export function detachShowListeners() {
  unsubs.forEach(fn => { try { fn(); } catch {} });
  unsubs = [];
}

export function attachShowListeners() {
  detachShowListeners();

  // 1. Lắng nghe Shows Master & Cấu hình Studio
  const masterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'app_single_doc', 'shows_master');
  unsubs.push(onSnapshot(masterRef, (snap) => {
    state.cloudSynced = true;
    if (snap.exists()) {
      const d = snap.data();
      if (Array.isArray(d.shows)) {
        state.shows = d.shows;
        localStorage.setItem('as_shows_backup_2026', JSON.stringify(state.shows));
      }
      if (Array.isArray(d.visibleYears) && d.visibleYears.length) state.visibleYears = d.visibleYears;
      if (d.lockedMonths) state.lockedMonths = d.lockedMonths;
      if (d.ctpRatesConfig) state.ctpRatesConfig = { ...state.ctpRatesConfig, ...d.ctpRatesConfig };
      if (Array.isArray(d.customColorRules)) state.customColorRules = d.customColorRules;
      if (d.studioBroadcast) state.studioBroadcast = d.studioBroadcast;
      if (Array.isArray(d.deletedShowsTrash)) state.deletedShowsTrash = d.deletedShowsTrash;
      if (Array.isArray(d.activityLogs)) state.activityLogs = d.activityLogs;
      if (d.readonlyMaintenanceMode !== undefined) state.readonlyMaintenanceMode = Boolean(d.readonlyMaintenanceMode);
      if (d.memberStylesMap) {
        state.members.forEach(m => {
          const cfg = d.memberStylesMap[m.id];
          if (cfg) {
            if (cfg.bg) m.bg = cfg.bg;
            if (cfg.text) m.text = cfg.text;
            if (cfg.order !== undefined) m.order = cfg.order;
          }
        });
      }
    }
    triggerRender();
  }, () => { state.cloudSynced = false; triggerRender(); }));

  // 2. Lắng nghe Hồ sơ Crew Profiles (Avatar, CCCD, VietQR)
  const profCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'crew_profiles');
  unsubs.push(onSnapshot(profCol, (snap) => {
    snap.docs.forEach(d => { state.memberProfiles[d.id] = d.data(); });
    localStorage.setItem('as_member_profiles_2026', JSON.stringify(state.memberProfiles));
    triggerRender();
  }));

  // 3. Lắng nghe Cấu hình Branding & Họ tên xuất vé
  const cfgCol = collection(db, 'artifacts', APP_ID, 'public', 'data', 'studio_config');
  unsubs.push(onSnapshot(cfgCol, (snap) => {
    snap.docs.forEach(d => {
      if (d.id === 'branding' && d.data()?.customLogoUrl) {
        state.customLogoUrl = d.data().customLogoUrl;
        localStorage.setItem('as_custom_logo_2026', state.customLogoUrl);
      }
      if (d.id === 'official_names' && d.data()?.names) {
        state.officialLegalNames = d.data().names;
        localStorage.setItem('as_official_legal_names_2026', JSON.stringify(state.officialLegalNames));
      }
    });
    triggerRender();
  }));
}

export async function syncShowsToCloud() {
  localStorage.setItem('as_shows_backup_2026', JSON.stringify(state.shows));
  const masterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'app_single_doc', 'shows_master');
  await setDoc(masterRef, { shows: state.shows, updatedAt: Date.now() }, { merge: true });
}

export async function saveMyProfileToCloud(memberId, profileObj) {
  state.memberProfiles[memberId] = { ...profileObj, updatedAt: Date.now() };
  localStorage.setItem('as_member_profiles_2026', JSON.stringify(state.memberProfiles));
  const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'crew_profiles', memberId);
  await setDoc(ref, state.memberProfiles[memberId], { merge: true });
}

export function canEditShow(show) {
  if (!show) return false;
  if (state.isAdminMode) return true;
  if (!state.currentUserId) return false;
  const creatorId = String(show.creatorId || show.ownerId || '').trim();
  return creatorId !== '' && creatorId === state.currentUserId;
}

export function canSeeShowPartner(show) {
  if (!show) return false;
  if (!show.hidePartner && !show.isCustomCtp) return true;
  const creatorId = String(show.creatorId || show.userId || show.ownerId || '').trim();
  return creatorId !== '' && creatorId === state.currentUserId;
}

export function getVisiblePartnerText(show) {
  return (show && show.partner && canSeeShowPartner(show)) ? show.partner : '';
}

export function isYearMonthLocked(yearNum, monthNum) {
  if (state.isAdminMode) return false;
  const lm = state.lockedMonths || {};
  return Boolean(lm[`${yearNum}-${monthNum}`] ?? (Number(yearNum) === 2026 ? lm[monthNum] : false));
}

export function getActiveNonCancelledShows() {
  return (state.shows || []).filter(sh => sh && !sh.isCancelled);
}

export function getBusyMembersMap(startDate, endDate, excludeShowId = null) {
  const map = {};
  if (!startDate || !endDate) return map;
  const s1 = new Date(startDate + 'T00:00:00');
  const e1 = new Date(endDate + 'T00:00:00');
  getActiveNonCancelledShows().forEach(sh => {
    if (excludeShowId && sh.id === excludeShowId) return;
    const s2 = new Date(sh.startDate + 'T00:00:00');
    const e2 = new Date(sh.endDate + 'T00:00:00');
    if (s1 <= e2 && e1 >= s2) {
      (sh.memberIds || []).forEach(mid => {
        if (!map[mid]) map[mid] = [];
        map[mid].push(sh.location);
      });
    }
  });
  return map;
}

export function getFilteredShows() {
  return (state.shows || [])
    .filter(sh => {
      if (!sh || !sh.startDate) return false;
      const start = new Date(sh.startDate + 'T00:00:00');
      const end = new Date((sh.endDate < sh.startDate ? sh.startDate : sh.endDate) + 'T00:00:00');
      if (state.filterAllMonthsInList) {
        if (end < new Date(state.selectedYear, 0, 1) || start > new Date(state.selectedYear, 11, 31)) return false;
      } else {
        if (end < new Date(state.selectedYear, state.selectedMonth - 1, 1) || start > new Date(state.selectedYear, state.selectedMonth, 0)) return false;
      }
      if (state.filterMemberId !== 'all' && !(sh.memberIds || []).includes(state.filterMemberId)) return false;
      if (state.searchQuery.trim() !== '') {
        const q = state.searchQuery.toLowerCase();
        const text = `${sh.location || ''} ${getVisiblePartnerText(sh)} ${sh.note || ''} ${sh.stt || ''} ${getMember(sh.ownerId).name}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || (Number(a.stt) || 0) - (Number(b.stt) || 0));
}