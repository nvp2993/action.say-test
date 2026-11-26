import { doc, setDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, APP_ID } from '../config/firebase.js';
import { state, triggerRender } from '../state/store.js';
import { getShowDays } from '../utils/helpers.js';

let finUnsubs = [];
let ctpTimer = null;
let ownerTimer = null;

export function detachFinanceListeners() {
  finUnsubs.forEach(fn => { try { fn(); } catch {} });
  finUnsubs = [];
}

export function attachFinanceListeners(memberId) {
  detachFinanceListeners();
  if (!memberId) return;

  const ctpRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_ctp_data', memberId);
  finUnsubs.push(onSnapshot(ctpRef, (snap) => {
    if (snap.exists()) {
      const d = snap.data();
      if (d.items) state.ctpItems = { ...state.ctpItems, ...d.items };
      if (Array.isArray(d.customShows)) state.ctpCustomShows = d.customShows;
      localStorage.setItem('as_ctp_items_2026', JSON.stringify(state.ctpItems));
      localStorage.setItem('as_ctp_custom_shows_2026', JSON.stringify(state.ctpCustomShows));
      const activeTag = document.activeElement?.tagName;
      const isTypingInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
      if (!isTypingInput && (state.activeTab === 'ctp' || state.activeTab === 'owner_stats')) {
        triggerRender();
      }
    }
  }));

  const ownerRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'owner_finance_v2', memberId);
  finUnsubs.push(onSnapshot(ownerRef, (snap) => {
    if (snap.exists() && snap.data()?.map) {
      state.ownerFinanceMap = { ...state.ownerFinanceMap, ...snap.data().map };
      localStorage.setItem('as_owner_finance_2026', JSON.stringify(state.ownerFinanceMap));
      const activeTag = document.activeElement?.tagName;
      const isTypingInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA';
      if (!isTypingInput && state.activeTab === 'owner_stats') {
        triggerRender();
      }
    }
  }));
}

export function saveCtpState(immediate = false) {
  localStorage.setItem('as_ctp_items_2026', JSON.stringify(state.ctpItems));
  localStorage.setItem('as_ctp_custom_shows_2026', JSON.stringify(state.ctpCustomShows));
  if (!state.currentUserId) return;

  clearTimeout(ctpTimer);
  const push = async () => {
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_ctp_data', state.currentUserId);
    await setDoc(ref, { items: state.ctpItems, customShows: state.ctpCustomShows, updatedAt: Date.now() }, { merge: true });
  };
  if (immediate) push(); else ctpTimer = setTimeout(push, 600);
}

export function saveOwnerFinanceState(immediate = false) {
  localStorage.setItem('as_owner_finance_2026', JSON.stringify(state.ownerFinanceMap));
  if (!state.currentUserId) return;

  clearTimeout(ownerTimer);
  const push = async () => {
    const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'owner_finance_v2', state.currentUserId);
    await setDoc(ref, { map: state.ownerFinanceMap, updatedAt: Date.now() }, { merge: true });
  };
  if (immediate) push(); else ownerTimer = setTimeout(push, 600);
}

export function getDefaultRateForTask(taskKey, sh) {
  const days = getShowDays(sh);
  const r = state.ctpRatesConfig || {};
  if (taskKey === 'quay') return days === 1 ? (r.quay1Day ?? 1500000) : (r.quayMultiDay ?? 1200000) * days;
  if (taskKey === 'chup') return days === 1 ? (r.chup1Day ?? 1500000) : (r.chupMultiDay ?? 1200000) * days;
  if (taskKey === 'dung') return r.dung ?? 1000000;
  if (taskKey === 'lamhinh') return r.lamhinh ?? 300000;
  if (taskKey === 'flycam') return r.flycam ?? 1000000;
  if (taskKey === 'gimbal') return r.gimbal ?? 200000;
  return 0;
}

export function findAnyCtpShow(showId) {
  return state.shows.find(s => s.id === showId) || (state.ctpCustomShows || []).find(s => s.id === showId);
}

export function getMemberExtrasForShow(showId, memberId) {
  const sh = findAnyCtpShow(showId);
  const extras = Array.isArray(state.ctpItems?.[showId]?.extras) ? state.ctpItems[showId].extras : [];
  return extras.filter(ex => {
    if (!ex) return false;
    if (ex.payerId) return ex.payerId === memberId;
    return sh ? sh.ownerId !== memberId : true;
  });
}

export function getCombinedCtpShows() {
  const uid = state.currentUserId;
  const regular = (state.shows || []).filter(sh => {
    if (!sh || sh.isCancelled || !sh.startDate) return false;
    const [y, m] = sh.startDate.split('-').map(Number);
    if (y !== state.selectedYear || m !== state.ctpMonth) return false;
    if (state.ctpOwnerId !== 'all' && sh.ownerId !== state.ctpOwnerId) return false;

    const isCrewMember = (sh.memberIds || []).includes(uid) && sh.ownerId !== uid;
    const myExtras = getMemberExtrasForShow(sh.id, uid);
    const hasMyExpense = myExtras.length > 0 && sh.ownerId !== uid;

    return isCrewMember || hasMyExpense;
  }).sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  const custom = (state.ctpCustomShows || []).filter(sh => {
    if (!sh || sh.isCancelled || sh.isHold) return false;
    const m = sh.startDate ? parseInt(sh.startDate.split('-')[1], 10) : Number(sh.ctpMonth);
    if (m !== state.ctpMonth) return false;
    if (state.ctpOwnerId !== 'all' && sh.ownerId !== state.ctpOwnerId) return false;
    return true;
  });

  return [...regular, ...custom];
}

export function ensureOwnerFinRecord(sh) {
  const id = typeof sh === 'string' ? sh : sh.id;
  if (!state.ownerFinanceMap[id]) {
    state.ownerFinanceMap[id] = {
      clientPrice: 0,
      depositPaid: 0,
      status: 'unpaid',
      crewCosts: {},
      crewTasks: {},
      otherExpenses: [],
      crewMemberMeta: {},
      note: ''
    };
  }
  const rec = state.ownerFinanceMap[id];
  if (!rec.crewCosts) rec.crewCosts = {};
  if (!rec.crewTasks) rec.crewTasks = {};
  if (!Array.isArray(rec.otherExpenses)) rec.otherExpenses = [];
  if (!rec.crewMemberMeta) rec.crewMemberMeta = {};
  return rec;
}

export function calculateOwnerShowMetrics(sh) {
  const rec = ensureOwnerFinRecord(sh);
  const clientPrice = Number(rec.clientPrice) || 0;
  const depositPaid = Number(rec.depositPaid) || 0;
  let crewCtpTotal = 0;
  (sh.memberIds || []).forEach(mid => {
    if (mid === sh.ownerId) return;
    crewCtpTotal += (Number(rec.crewCosts?.[mid]) || 0);
  });
  const otherExpTotal = (rec.otherExpenses || []).reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
  const totalExpense = crewCtpTotal + otherExpTotal;
  const netProfit = clientPrice - totalExpense;
  const remainingClientDebt = rec.status === 'settled' ? 0 : Math.max(0, clientPrice - depositPaid);
  return { rec, clientPrice, depositPaid, crewCtpTotal, otherExpTotal, totalExpense, netProfit, remainingClientDebt };
}

export function calculateCrewShowMetrics(sh) {
  const uid = state.currentUserId;
  const ctpItem = state.ctpItems[sh.id] || { tasks: {}, extras: [] };
  const taskSum = Object.entries(ctpItem.tasks || {}).reduce((s, [, v]) => (v !== null && v !== undefined) ? s + (Number(v) || 0) : s, 0);
  const myExtras = sh.ownerId === uid ? [] : getMemberExtrasForShow(sh.id, uid);
  const extraBillSum = myExtras.reduce((s, ex) => s + (Number(ex.amount) || 0), 0);
  const grossCtp = taskSum + extraBillSum;
  const rec = ensureOwnerFinRecord(sh);
  if (!rec.crewMemberMeta[uid]) {
    rec.crewMemberMeta[uid] = { ctpStatus: 'unpaid', selfExpense: 0, selfExpenseNote: '' };
  }
  const meta = rec.crewMemberMeta[uid];
  const selfExpense = Number(meta.selfExpense) || 0;
  const netPocket = grossCtp - selfExpense;
  const isSettled = meta.ctpStatus === 'settled';
  return { ctpItem: { ...ctpItem, extras: myExtras }, meta, grossCtp, selfExpense, netPocket, isSettled, pendingCtpDebt: isSettled ? 0 : Math.max(0, grossCtp) };
}

export async function saveQuickShowExpensesBatch({ showId, entries = [], deletedIds = [] }) {
  if (!showId) throw new Error('Thiếu showId');

  const sh = findAnyCtpShow(showId);
  const showOwnerId = sh?.ownerId || '';

  if (!state.ctpItems[showId]) state.ctpItems[showId] = { tasks: {}, extras: [] };
  if (!Array.isArray(state.ctpItems[showId].extras)) state.ctpItems[showId].extras = [];

  const ownerRec = ensureOwnerFinRecord(showId);
  if (!Array.isArray(ownerRec.otherExpenses)) ownerRec.otherExpenses = [];

  const deletedSet = new Set((deletedIds || []).filter(Boolean));
  const touchedCtpPayers = new Set();
  let ctpChanged = false;
  let ownerChanged = false;

  if (deletedSet.size > 0) {
    const beforeExtrasLen = state.ctpItems[showId].extras.length;
    state.ctpItems[showId].extras = state.ctpItems[showId].extras.filter(ex => {
      if (!ex) return false;
      if (ex.id && deletedSet.has(ex.id)) {
        if (ex.payerId) touchedCtpPayers.add(ex.payerId);
        return false;
      }
      return true;
    });
    if (state.ctpItems[showId].extras.length !== beforeExtrasLen) ctpChanged = true;

    const beforeOtherLen = ownerRec.otherExpenses.length;
    ownerRec.otherExpenses = ownerRec.otherExpenses.filter(ex => {
      if (!ex) return false;
      return !(ex.id && deletedSet.has(ex.id));
    });
    if (ownerRec.otherExpenses.length !== beforeOtherLen) ownerChanged = true;
  }

  (entries || []).forEach((item, idx) => {
    const cleanTitle = String(item?.title || '').trim();
    const numAmount = Number(item?.amount) || 0;
    if (!cleanTitle || numAmount <= 0) return;

    const payerId = item?.payerId || state.currentUserId;
    const isOwnerPaying = Boolean(showOwnerId && payerId === showOwnerId);
    const entryId = item?.id || `exp_${Date.now()}_${idx}`;

    const prevExtraIdx = state.ctpItems[showId].extras.findIndex(x => x && x.id === entryId);
    const prevOtherIdx = ownerRec.otherExpenses.findIndex(x => x && x.id === entryId);

    if (prevExtraIdx >= 0) {
      const prevPayer = state.ctpItems[showId].extras[prevExtraIdx]?.payerId;
      if (prevPayer) touchedCtpPayers.add(prevPayer);
      state.ctpItems[showId].extras.splice(prevExtraIdx, 1);
      ctpChanged = true;
    }
    if (prevOtherIdx >= 0) {
      ownerRec.otherExpenses.splice(prevOtherIdx, 1);
      ownerChanged = true;
    }

    if (isOwnerPaying) {
      ownerRec.otherExpenses.push({
        id: entryId,
        name: cleanTitle,
        amount: numAmount,
        payerId,
        createdById: state.currentUserId,
        updatedAt: Date.now()
      });
      ownerChanged = true;
    } else {
      state.ctpItems[showId].extras.push({
        id: entryId,
        name: cleanTitle,
        amount: numAmount,
        payerId,
        createdById: state.currentUserId,
        updatedAt: Date.now()
      });
      touchedCtpPayers.add(payerId);
      if (state.currentUserId) touchedCtpPayers.add(state.currentUserId);
      ctpChanged = true;
    }
  });

  if (ctpChanged) {
    saveCtpState(true);
    const ctpPayload = {
      items: {
        [showId]: {
          tasks: state.ctpItems[showId].tasks || {},
          extras: state.ctpItems[showId].extras
        }
      },
      updatedAt: Date.now()
    };

    await Promise.all(
      Array.from(touchedCtpPayers)
        .filter(pid => pid && pid !== state.currentUserId)
        .map(pid => {
          const ref = doc(db, 'artifacts', APP_ID, 'public', 'data', 'user_ctp_data', pid);
          return setDoc(ref, ctpPayload, { merge: true });
        })
    );
  }

  if (ownerChanged) {
    saveOwnerFinanceState(true);
    if (showOwnerId && showOwnerId !== state.currentUserId) {
      const ownerDocRef = doc(db, 'artifacts', APP_ID, 'public', 'data', 'owner_finance_v2', showOwnerId);
      await setDoc(
        ownerDocRef,
        {
          map: {
            [showId]: state.ownerFinanceMap[showId]
          },
          updatedAt: Date.now()
        },
        { merge: true }
      );
    }
  }

  if (ctpChanged || ownerChanged) {
    triggerRender();
  }
}
