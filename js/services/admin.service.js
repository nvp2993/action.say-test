import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, APP_ID } from '../config/firebase.js';
import { state, triggerRender } from '../state/store.js';
import { getMember, resolveDynamicLocationColor, showToast } from '../utils/helpers.js';
import { syncShowsToCloud } from './show.service.js';

export async function pushAdminConfigToCloud() {
  if (!state.isAdminMode) return;
  const masterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'app_single_doc', 'shows_master');
  const memberStylesMap = Object.fromEntries(
    state.members.map(m => [m.id, { bg: m.bg, text: m.text, order: m.order }])
  );
  await setDoc(masterRef, {
    visibleYears: state.visibleYears,
    lockedMonths: state.lockedMonths,
    ctpRatesConfig: state.ctpRatesConfig,
    customColorRules: state.customColorRules,
    studioBroadcast: state.studioBroadcast,
    deletedShowsTrash: (state.deletedShowsTrash || []).slice(0, 30),
    activityLogs: (state.activityLogs || []).slice(0, 30),
    readonlyMaintenanceMode: Boolean(state.readonlyMaintenanceMode),
    memberStylesMap,
    updatedAt: Date.now()
  }, { merge: true });
}

export async function logStudioActivity(actionText) {
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} ${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}`;
  const actor = state.currentUserId ? getMember(state.currentUserId).name : 'Admin';
  state.activityLogs.unshift({ id: 'log_' + Date.now(), time, actor: state.isAdminMode ? `${actor} (Admin)` : actor, text: actionText });
  state.activityLogs = state.activityLogs.slice(0, 30);
  localStorage.setItem('as_activity_logs_2026', JSON.stringify(state.activityLogs));
  const masterRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'app_single_doc', 'shows_master');
  await setDoc(masterRef, { activityLogs: state.activityLogs }, { merge: true });
}

export async function applyColorsToAllShows() {
  let count = 0;
  state.shows.forEach(sh => {
    if (!sh) return;
    const c = resolveDynamicLocationColor(sh.location, sh.partner);
    if (sh.color !== c) { sh.color = c; count++; }
  });
  await syncShowsToCloud();
  triggerRender();
  return count;
}

export async function saveOfficialLegalName(memberId, legalName) {
  if (!state.isAdminMode) return;
  state.officialLegalNames[memberId] = String(legalName || '').trim().toUpperCase();
  localStorage.setItem('as_official_legal_names_2026', JSON.stringify(state.officialLegalNames));
  const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'studio_config', 'official_names');
  await setDoc(ref, { names: state.officialLegalNames, updatedAt: Date.now() }, { merge: true });
  showToast('✅ Đã lưu Họ tên xuất vé lên Cloud!');
}

export function exportFullJsonBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    shows: state.shows,
    members: state.members,
    memberProfiles: state.memberProfiles,
    officialLegalNames: state.officialLegalNames,
    lockedMonths: state.lockedMonths,
    visibleYears: state.visibleYears,
    ctpRatesConfig: state.ctpRatesConfig,
    customColorRules: state.customColorRules
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ActionSay_Backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  showToast('📦 Đã tải file Backup .JSON!');
}