import {
  INITIAL_TEAM_MEMBERS,
  DEFAULT_CTP_RATES,
  DEFAULT_COLOR_RULES
} from '../config/constants.js';

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function safeParse(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const state = {
  // Auth & Cloud
  authReady: false,
  firebaseUser: null,
  cloudSynced: false,
  currentUserId: null,
  isAdminMode: false,

  // Dữ liệu cốt lõi
  members: [...INITIAL_TEAM_MEMBERS],
  shows: safeParse('as_shows_backup_2026', []),
  memberProfiles: safeParse('as_member_profiles_2026', {}),
  officialLegalNames: safeParse('as_official_legal_names_2026', {}),
  customLogoUrl: localStorage.getItem('as_custom_logo_2026') || null,

  // Cấu hình Admin Pro
  visibleYears: safeParse('as_visible_years_config_2026', [2026, 2027]),
  lockedMonths: safeParse('as_locked_months_2026', {}),
  ctpRatesConfig: { ...DEFAULT_CTP_RATES, ...safeParse('as_ctp_rates_config_2026', {}) },
  customColorRules: safeParse('as_custom_color_rules_2026', [...DEFAULT_COLOR_RULES]),
  studioBroadcast: safeParse('as_studio_broadcast_2026', { enabled: false, text: '' }),
  deletedShowsTrash: safeParse('as_deleted_shows_trash_2026', []),
  activityLogs: safeParse('as_activity_logs_2026', []),
  readonlyMaintenanceMode: localStorage.getItem('as_readonly_maintenance_2026') === 'true',

  // UI & Điều hướng
  isBackendPortal: window.location.hash === '#admin',
  activeTab: 'shows', // shows | matrix | free_finder | ctp | owner_stats
  zenFullscreen: false,
  compactMatrix: true,
  hideMoneyMode: localStorage.getItem('as_hide_money_2026') === 'true',
  vipInfoHidden: localStorage.getItem('as_vip_info_hidden') === '1',
  soundEnabled: localStorage.getItem('as_sound_2026') !== 'false',

  // Bộ lọc Lịch Show & Công Tác
  selectedYear: new Date().getFullYear() >= 2026 ? new Date().getFullYear() : 2026,
  selectedMonth: new Date().getMonth() + 1,
  filterAllMonthsInList: false,
  searchQuery: '',
  filterMemberId: 'all',

  // Tab Người Rảnh
  checkStart: getTodayISO(),
  checkEnd: getTodayISO(),

  // Tab Tính CTP (riêng tư theo user)
  ctpMonth: new Date().getMonth() + 1,
  ctpOwnerId: 'all',
  ctpItems: safeParse('as_ctp_items_2026', {}),
  ctpCustomShows: safeParse('as_ctp_custom_shows_2026', []),
  ctpLastUpdatedAt: 0,

  // Tab Công Nợ / Chủ Show (riêng tư theo user)
  ownerMonth: new Date().getMonth() + 1,
  ownerAllMonths: false,
  ownerFilterStatus: 'all', // all | role_owner | role_crew | unsettled | settled
  ownerExpandedShowId: null,
  ownerFinanceMap: safeParse('as_owner_finance_2026', {}),

  // Modals
  detailShowId: null,
  matrixCellModal: null,
  formModal: null,
  pinModal: { step: 'select', selectedId: null, pinInput: '', error: '', loading: false },
  selfChangePinModal: null,
  crewPassModal: false,
  isEditingCrewProfile: false,
  guideModal: false,
  zaloTomorrowModal: null,
  ctpAddShowModal: null,
  ctpBillModal: null,
  imagePreviewModal: null,
  crewManifestModal: null,
  bellDrawerOpen: false,
  quickHoldModal: null,
  promotingHoldId: null,

  // Admin UI State
  adminTab: 'overview', // overview | pins | system
  adminSearch: '',
  adminInspectShowId: null,
  adminSettingsModalOpen: false,
  adminLockViewYear: 2026,
  adminLoginInput: { email: '', password: '', error: '', loading: false },
  newMemberForm: { name: '', shortLabel: '', pin: '1234', colorIdx: 5 },

  toast: null
};

let renderCallback = null;
export function registerRenderer(fn) {
  renderCallback = fn;
}
export function triggerRender() {
  if (typeof renderCallback === 'function') renderCallback();
}