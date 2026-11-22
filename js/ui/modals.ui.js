import { state } from '../state/store.js';
import { ROLE_OPTIONS } from '../config/constants.js';
import { escapeHtml, getMember, renderPillHtml, normalizeRoleName, formatDayMonth, buildVietQrUrl, getBankName } from '../utils/helpers.js';
import { getBusyMembersMap } from '../services/show.service.js';

const DEFAULT_STUDIO_LOGO = './assets/logo.png';
const FALLBACK_LOGO_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230f172a'/%3E%3Ctext x='32' y='40' text-anchor='middle' font-family='Arial,sans-serif' font-weight='900' font-size='22' fill='%23fbbf24'%3EA%C3%97S%3C/text%3E%3C/svg%3E";

function getModalLogoSrc() {
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

export function renderWelcomeSplashHtml() {
  if (!state.welcomeSplashVisible || !state.currentUserId) return '';
  const m = getMember(state.currentUserId);
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const displayName = (prof.fullName || m?.name || 'CREW').toUpperCase();
  const logoSrc = getModalLogoSrc();

  return `
    <div onclick="appActions.dismissWelcomeSplash()" class="fixed inset-0 z-[70] bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-white cursor-pointer select-none">
      <div class="w-24 h-24 rounded-3xl bg-slate-900 border border-amber-400/40 shadow-2xl overflow-hidden flex items-center justify-center mb-4">
        <img src="${escapeHtml(logoSrc)}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_SVG}'" alt="Action x Say" class="w-full h-full object-cover" />
      </div>
      <div class="text-[10px] font-black tracking-[0.25em] text-amber-400 uppercase">ACTION MEDIA × SAY STUDIOS</div>
      <div class="text-lg font-black text-white mt-1.5">Xin chào, ${escapeHtml(displayName)}</div>
      <div class="text-[11px] text-slate-400 mt-1">Chạm vào màn hình để vào lịch ngay</div>
    </div>
  `;
}

export function renderPinModalHtml() {
  const pm = state.pinModal;
  if (!pm) return '';
  const selMem = pm.selectedId ? getMember(pm.selectedId) : null;
  const logoSrc = getModalLogoSrc();

  return `
    <div class="fixed inset-0 z-50 bg-slate-950 flex items-center justify-center p-4">
      <div class="bg-white w-full max-w-sm rounded-3xl p-5 space-y-3.5 shadow-2xl border">
        <div class="flex flex-col items-center text-center space-y-2 pb-2 border-b">
          <div onclick="appActions.tapLogoSecret()" class="w-14 h-14 rounded-2xl bg-black overflow-hidden shadow-md cursor-pointer">
            <img src="${escapeHtml(logoSrc)}" onerror="this.onerror=null;this.src='${FALLBACK_LOGO_SVG}'" alt="Action x Say" class="w-full h-full object-cover" />
          </div>
          <h2 class="font-black text-sm text-slate-900 uppercase">LỊCH SHOW ACTION &amp; SAY</h2>
          <p class="text-[11px] text-slate-500">${pm.step === 'select' ? 'Chọn tên của bạn để đăng nhập' : `Nhập mã PIN của ${escapeHtml(selMem?.name || '')}`}</p>
        </div>

        ${pm.step === 'select' ? `
          <div class="grid grid-cols-2 gap-1.5 max-h-[55dvh] overflow-y-auto custom-scroll">
            ${state.members.map(m => `<button type="button" onclick="appActions.chooseMemberForPin('${m.id}')" class="p-2.5 rounded-xl border hover:border-slate-900 flex justify-between items-center bg-slate-50">${renderPillHtml(m.id, 'sm')}<i class="fa-solid fa-chevron-right text-slate-300 text-[10px]"></i></button>`).join('')}
          </div>
        ` : `
          <div class="flex flex-col items-center space-y-3 py-2">
            ${renderPillHtml(pm.selectedId, 'md')}
            <input id="native-pin-input" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autofocus
              value="${escapeHtml(pm.pinInput)}" oninput="appActions.handleNativePinInput(this.value)" placeholder="••••"
              class="w-40 text-center text-xl tracking-widest font-mono py-2 px-3 border-2 border-indigo-500 rounded-2xl bg-slate-50 focus:outline-none" />
            <div class="min-h-[18px] text-xs font-bold text-rose-600 text-center">${escapeHtml(pm.error || (pm.loading ? '⏳ Đang xác thực...' : ''))}</div>
            <button type="button" onclick="appActions.backToSelectMemberPin()" class="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold">← Chọn tên khác</button>
          </div>
        `}
      </div>
    </div>
  `;
}

function buildVipLeaderboardData(mode, year, month) {
  const membersSorted = [...(state.members || [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const prefix = mode === 'year'
    ? `${year}-`
    : `${year}-${String(month).padStart(2, '0')}-`;

  const periodShows = (state.shows || []).filter(s => {
    if (!s || s.isCancelled || s.isHold) return false;
    const start = String(s.startDate || '');
    const end = String(s.endDate || s.startDate || '');
    return start.startsWith(prefix) || end.startsWith(prefix);
  });

  const ranked = membersSorted
    .map(mem => ({
      ...mem,
      cnt: periodShows.filter(s => (s.memberIds || []).includes(mem.id)).length
    }))
    .sort((a, b) => (b.cnt !== a.cnt ? b.cnt - a.cnt : (a.order ?? 99) - (b.order ?? 99)));

  const maxCnt = Math.max(1, ...ranked.map(r => r.cnt));
  return { ranked, maxCnt, totalShows: periodShows.length };
}

function renderVipLeaderboardRowsHtml(ranked, maxCnt, currentUserId) {
  return ranked.map((mem, idx) => {
    const rank = idx + 1;
    const isMe = mem.id === currentUserId;
    const pct = mem.cnt > 0 ? Math.max(8, Math.round((mem.cnt / maxCnt) * 100)) : 0;

    let rowCls = 'bg-white/[0.04] border-white/[0.07]';
    let badgeHtml = `<span class="w-5 h-5 rounded-full bg-white/10 text-slate-300 font-mono font-black text-[9.5px] flex items-center justify-center shrink-0">#${rank}</span>`;
    let barCls = 'bg-gradient-to-r from-slate-500 to-slate-400';
    let countCls = 'text-white';

    if (rank === 1 && mem.cnt > 0) {
      rowCls = 'bg-gradient-to-r from-amber-400/20 via-yellow-300/10 to-transparent border-amber-400/45';
      badgeHtml = `<span class="text-sm leading-none shrink-0" title="Top 1">🥇</span>`;
      barCls = 'bg-gradient-to-r from-amber-400 to-yellow-200';
      countCls = 'text-amber-300';
    } else if (rank === 2 && mem.cnt > 0) {
      rowCls = 'bg-gradient-to-r from-slate-200/15 via-slate-300/5 to-transparent border-slate-300/30';
      badgeHtml = `<span class="text-sm leading-none shrink-0" title="Top 2">🥈</span>`;
      barCls = 'bg-gradient-to-r from-slate-300 to-slate-100';
      countCls = 'text-slate-100';
    } else if (rank === 3 && mem.cnt > 0) {
      rowCls = 'bg-gradient-to-r from-orange-400/15 via-amber-500/5 to-transparent border-orange-300/30';
      badgeHtml = `<span class="text-sm leading-none shrink-0" title="Top 3">🥉</span>`;
      barCls = 'bg-gradient-to-r from-orange-400 to-amber-300';
      countCls = 'text-orange-200';
    }

    if (isMe) {
      rowCls += ' ring-1 ring-amber-300/75';
    }

    return `
      <div class="px-2.5 py-1.5 rounded-xl border ${rowCls} space-y-1">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 min-w-0">
            ${badgeHtml}
            <span style="background:${mem.bg};color:${mem.text || '#fff'}" class="px-2 py-0.5 rounded-full text-[9.5px] font-black truncate">${escapeHtml(mem.shortLabel || mem.name)}</span>
            ${rank === 1 && mem.cnt > 0 ? `<span class="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-black text-[8px] tracking-wider uppercase shrink-0">MVP</span>` : ''}
            ${isMe ? `<span class="px-1.5 py-0.5 rounded bg-white/15 text-amber-200 font-black text-[8px] tracking-wider uppercase shrink-0">BẠN</span>` : ''}
          </div>
          <div class="flex items-baseline gap-1 shrink-0">
            <span class="font-mono font-black text-xs ${countCls}">${mem.cnt}</span>
            <span class="text-[9px] font-semibold text-slate-400">show</span>
          </div>
        </div>
        <div class="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div style="width:${pct}%" class="h-full rounded-full ${barCls}"></div>
        </div>
      </div>
    `;
  }).join('');
}

export function renderCrewPassModalHtml() {
  if (!state.crewPassModal || !state.currentUserId) return '';
  const m = getMember(state.currentUserId);
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const savedAvatars = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');
  const avatarSrc = prof.avatarUrl || prof.avatar || savedAvatars[state.currentUserId] || '';

  const isEditing = !!state.isEditingCrewProfile;
  const hidden = !!state.vipInfoHidden;

  const showCount = (state.shows || []).filter(
    s => s && !s.isCancelled && !s.isHold && (s.memberIds || []).includes(state.currentUserId)
  ).length;

  const now = new Date();
  const curYear = Number(state.selectedYear) || now.getFullYear();
  const curMonth = Number(state.selectedMonth) || (now.getMonth() + 1);
  const monthBoard = buildVipLeaderboardData('month', curYear, curMonth);
  const yearBoard = buildVipLeaderboardData('year', curYear, curMonth);
  const myMonthRankIdx = monthBoard.ranked.findIndex(r => r.id === state.currentUserId);
  const myMonthRank = myMonthRankIdx >= 0 ? myMonthRankIdx + 1 : '-';

  const displayName = (prof.fullName || m.name || '').toUpperCase();
  const displayTitle = prof.title || 'Media Crew';
  const nickLabel = (m.name || '').toUpperCase();

  const bankBin = prof.bankBin || '970407';
  const bankNames = {
    '970407': 'Techcombank', '970436': 'Vietcombank', '970418': 'BIDV',
    '970415': 'VietinBank', '970422': 'MB Bank', '970432': 'VPBank',
    '970416': 'ACB', '970423': 'TPBank', '970403': 'Sacombank', '970441': 'VIB'
  };
  const bankLabel = bankNames[bankBin] || 'Ngân hàng';
  const bankAcc = String(prof.bankAcc || '').replace(/\s+/g, '');
  const qrUrl = bankAcc
    ? `https://img.vietqr.io/image/${bankBin}-${encodeURIComponent(bankAcc)}-qr_only.png?accountName=${encodeURIComponent(displayName)}`
    : '';

  const flipJs = "document.getElementById('vip-card-flip-inner')?.classList.toggle('is-flipped')";
  const switchMonthJs = "event.stopPropagation();document.getElementById('vip-lb-month')?.classList.remove('hidden');document.getElementById('vip-lb-year')?.classList.add('hidden');document.getElementById('vip-lb-btn-m')?.classList.add('bg-amber-400','text-slate-950');document.getElementById('vip-lb-btn-m')?.classList.remove('text-slate-300');document.getElementById('vip-lb-btn-y')?.classList.remove('bg-amber-400','text-slate-950');document.getElementById('vip-lb-btn-y')?.classList.add('text-slate-300');";
  const switchYearJs = "event.stopPropagation();document.getElementById('vip-lb-year')?.classList.remove('hidden');document.getElementById('vip-lb-month')?.classList.add('hidden');document.getElementById('vip-lb-btn-y')?.classList.add('bg-amber-400','text-slate-950');document.getElementById('vip-lb-btn-y')?.classList.remove('text-slate-300');document.getElementById('vip-lb-btn-m')?.classList.remove('bg-amber-400','text-slate-950');document.getElementById('vip-lb-btn-m')?.classList.add('text-slate-300');";

  return `
    <style>
      .vip-flip-scene { perspective: 1200px; }
      .vip-flip-inner {
        display: grid;
        transform-style: preserve-3d;
        transition: transform 0.65s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .vip-flip-inner.is-flipped { transform: rotateY(180deg); }
      .vip-flip-face {
        grid-area: 1 / 1;
        backface-visibility: hidden;
        -webkit-backface-visibility: hidden;
      }
      .vip-flip-back { transform: rotateY(180deg); }
    </style>

    <div onclick="appActions.closeCrewPassModal()" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-sm bg-[#111318] text-white rounded-[32px] p-4 space-y-3.5 shadow-2xl max-h-[92dvh] overflow-y-auto custom-scroll">

        <div class="vip-flip-scene">
          <div id="vip-card-flip-inner" class="vip-flip-inner">

            <!-- MẶT TRƯỚC: VIP PASS -->
            <div onclick="${flipJs}" class="vip-flip-face relative rounded-[26px] p-4 overflow-hidden bg-gradient-to-br from-[#a3b86c]/80 via-[#212723] to-[#0e1218] border border-amber-300/25 shadow-lg space-y-3.5 cursor-pointer select-none">
              <div class="flex items-center justify-between gap-1.5">
                <div class="px-2.5 py-1 rounded-full bg-black/40 text-[9.5px] font-black tracking-wider text-amber-300 flex items-center gap-1 truncate">
                  <span>⚡ ACTION X SAY • VIP</span>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button type="button" onclick="event.stopPropagation();${flipJs}" title="Lật xem Bảng Xếp Hạng Thi Đua" class="px-2.5 py-1 rounded-full bg-amber-400/20 hover:bg-amber-400/35 border border-amber-300/40 text-[9.5px] font-black text-amber-200 flex items-center gap-1 transition">
                    <span>🏆 #${myMonthRank}</span>
                    <span class="text-amber-300/80">↻</span>
                  </button>
                  <button type="button" onclick="event.stopPropagation();appActions.closeCrewPassModal()" class="w-7 h-7 rounded-full bg-black/45 hover:bg-black/70 text-white/90 font-bold text-xs flex items-center justify-center">✕</button>
                </div>
              </div>

              <div class="flex items-center gap-3.5">
                <div onclick="event.stopPropagation();appActions.triggerVipAvatarUpload()" title="Chạm để đổi ảnh đại diện" class="relative w-16 h-16 rounded-2xl bg-slate-900/90 ring-2 ring-white/70 overflow-hidden flex items-center justify-center shrink-0 cursor-pointer">
                  ${avatarSrc
                    ? `<img src="${escapeHtml(avatarSrc)}" alt="Avatar" class="w-full h-full object-cover" />`
                    : `<span class="text-xl font-black text-white">${escapeHtml(m.shortLabel || 'AS')}</span>`
                  }
                  <span class="absolute bottom-1 right-1 w-4 h-4 rounded-md bg-amber-400 text-slate-950 text-[9px] flex items-center justify-center shadow">📷</span>
                  <input id="vip-avatar-file-input" type="file" accept="image/*" onchange="appActions.handleVipAvatarUpload(this)" class="hidden" />
                </div>

                <div class="min-w-0 flex-1">
                  <div class="text-base font-black tracking-tight text-white truncate">${escapeHtml(displayName)}</div>
                  <div class="text-xs font-extrabold text-amber-300 mt-0.5 truncate">${escapeHtml(displayTitle)}</div>
                  <div class="mt-1.5 flex items-center gap-1.5 flex-wrap">
                    <span class="px-2.5 py-0.5 rounded-lg bg-white/15 text-[10px] font-black tracking-wider text-white/95 uppercase">${escapeHtml(nickLabel)}</span>
                    <span class="px-2 py-0.5 rounded-lg bg-black/35 text-[9.5px] font-mono font-black text-amber-300">${showCount} SHOWS</span>
                  </div>
                </div>
              </div>

              <div class="h-px bg-white/15"></div>

              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="text-[10px] font-black text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span> VIETQR NHẬN CTP
                  </div>
                  <div class="text-sm font-black text-white">${escapeHtml(bankLabel)}</div>
                  <div class="text-sm font-mono font-black text-amber-300 tracking-wider">${escapeHtml(bankAcc || 'Chưa cập nhật STK')}</div>
                  <div class="text-[11px] font-bold text-white/75 uppercase truncate">${escapeHtml(displayName)}</div>
                </div>

                <div class="w-24 h-24 rounded-2xl bg-white p-1.5 shrink-0 flex items-center justify-center overflow-hidden shadow-md">
                  ${qrUrl
                    ? `<img src="${escapeHtml(qrUrl)}" alt="VietQR" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" class="w-full h-full object-contain" /><span style="display:none" class="text-[9px] text-slate-500 text-center font-bold px-1 items-center justify-center">Lỗi tải QR</span>`
                    : `<span class="text-[9px] text-slate-400 text-center font-bold px-1">Chưa có STK</span>`
                  }
                </div>
              </div>

              <div class="text-center text-[9.5px] font-bold text-white/45 tracking-wide pt-0.5">
                Chạm vào thẻ để lật xem Bảng Xếp Hạng Thi Đua ↻
              </div>
            </div>

            <!-- MẶT SAU: BẢNG XẾP HẠNG THI ĐUA (BLACK & GOLD) -->
            <div class="vip-flip-face vip-flip-back relative rounded-[26px] p-4 overflow-hidden bg-gradient-to-br from-[#1e222d] via-[#12151d] to-[#080a0f] border border-amber-400/35 shadow-xl flex flex-col gap-2.5">
              <div class="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-amber-400/10 blur-2xl"></div>

              <div class="flex items-center justify-between gap-1.5 relative z-10">
                <div class="min-w-0">
                  <div class="text-[10.5px] font-black tracking-wider text-amber-300 uppercase flex items-center gap-1">
                    <span>🏆 BẢNG VÀNG THI ĐUA</span>
                  </div>
                  <div class="text-[9.5px] text-slate-400 font-semibold mt-0.5">Action Media × Say Studios</div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <button type="button" onclick="event.stopPropagation();${flipJs}" class="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-[9.5px] font-black text-amber-200 transition">
                    ↺ Thẻ VIP
                  </button>
                  <button type="button" onclick="event.stopPropagation();appActions.closeCrewPassModal()" class="w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white/90 font-bold text-xs flex items-center justify-center">✕</button>
                </div>
              </div>

              <div class="flex items-center justify-between gap-2 relative z-10">
                <div class="inline-flex p-0.5 rounded-xl bg-black/45 border border-white/10 text-[10px] font-black">
                  <button id="vip-lb-btn-m" type="button" onclick="${switchMonthJs}" class="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 transition">Tháng ${curMonth}/${curYear}</button>
                  <button id="vip-lb-btn-y" type="button" onclick="${switchYearJs}" class="px-2.5 py-1 rounded-lg text-slate-300 hover:text-white transition">Năm ${curYear}</button>
                </div>
                <span class="text-[9.5px] font-mono font-bold text-amber-300/80">${monthBoard.ranked.length} thành viên</span>
              </div>

              <div id="vip-lb-month" class="flex-1 min-h-0 max-h-[190px] overflow-y-auto custom-scroll space-y-1.5 pr-0.5 relative z-10">
                ${renderVipLeaderboardRowsHtml(monthBoard.ranked, monthBoard.maxCnt, state.currentUserId)}
              </div>

              <div id="vip-lb-year" class="hidden flex-1 min-h-0 max-h-[190px] overflow-y-auto custom-scroll space-y-1.5 pr-0.5 relative z-10">
                ${renderVipLeaderboardRowsHtml(yearBoard.ranked, yearBoard.maxCnt, state.currentUserId)}
              </div>
            </div>

          </div>
        </div>

        <div class="rounded-[24px] bg-[#181b22] p-3.5 space-y-2.5 text-xs">
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-1.5">
              <span class="font-black text-amber-400 uppercase tracking-wider text-[11px]">INFO</span>
              <button type="button" onclick="appActions.toggleVipInfoHidden()" title="Ẩn/hiện thông tin" class="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-amber-300 shrink-0">
                ${hidden
                  ? `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>`
                  : `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.773 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`
                }
              </button>
              <button type="button" onclick="appActions.copyVipInfoText()" class="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-[10.5px] whitespace-nowrap">Copy</button>
            </div>
            <div class="flex items-center gap-1.5">
              <button type="button" onclick="appActions.toggleEditCrewProfile(${!isEditing})" class="px-2.5 py-1 rounded-full bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold text-[10.5px] whitespace-nowrap">
                ${isEditing ? '✕ Hủy' : 'Sửa'}
              </button>
              <button type="button" onclick="appActions.openSelfChangePinModal()" class="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-[10.5px] whitespace-nowrap">🔑 Đổi PIN</button>
            </div>
          </div>

          ${isEditing ? `
            <div class="space-y-2 pt-1 text-[11px]">
              <div class="flex items-center justify-between p-2 rounded-xl bg-black/30">
                <span class="text-slate-300 font-bold">Ảnh đại diện (đồng bộ toàn app)</span>
                <button type="button" onclick="appActions.triggerVipAvatarUpload()" class="px-2.5 py-1 rounded-lg bg-amber-400 text-slate-950 font-black text-[10px]">Đổi Ảnh</button>
              </div>
              <input id="prof-fullname" type="text" value="${escapeHtml(prof.fullName || m.name)}" placeholder="Họ và tên đầy đủ" class="w-full px-3 py-2 rounded-xl bg-black/40 text-white font-bold focus:outline-none" />
              <input id="prof-title" type="text" value="${escapeHtml(prof.title || '')}" placeholder="Chức danh (VD: Cam.Op, Editor, Flycam...)" class="w-full px-3 py-2 rounded-xl bg-black/40 text-white font-bold focus:outline-none" />
              <div class="grid grid-cols-2 gap-2">
                <input id="prof-cccd" type="text" value="${escapeHtml(prof.cccd || '')}" placeholder="Số CCCD" class="w-full px-3 py-2 rounded-xl bg-black/40 text-white font-mono font-bold focus:outline-none" />
                <input id="prof-dob" type="text" value="${escapeHtml(prof.dob || '')}" placeholder="Ngày sinh (DD/MM/YYYY)" class="w-full px-3 py-2 rounded-xl bg-black/40 text-white font-mono font-bold focus:outline-none" />
              </div>
              <input id="prof-phone" type="text" value="${escapeHtml(prof.phone || '')}" placeholder="Số điện thoại" class="w-full px-3 py-2 rounded-xl bg-black/40 text-white font-mono font-bold focus:outline-none" />
              <div class="grid grid-cols-2 gap-2">
                <select id="prof-bank-bin" class="w-full px-2.5 py-2 rounded-xl bg-black/40 text-white font-bold focus:outline-none">
                  <option value="970407" ${bankBin === '970407' ? 'selected' : ''}>Techcombank</option>
                  <option value="970436" ${bankBin === '970436' ? 'selected' : ''}>Vietcombank</option>
                  <option value="970422" ${bankBin === '970422' ? 'selected' : ''}>MB Bank</option>
                  <option value="970418" ${bankBin === '970418' ? 'selected' : ''}>BIDV</option>
                  <option value="970415" ${bankBin === '970415' ? 'selected' : ''}>VietinBank</option>
                  <option value="970416" ${bankBin === '970416' ? 'selected' : ''}>ACB</option>
                  <option value="970423" ${bankBin === '970423' ? 'selected' : ''}>TPBank</option>
                  <option value="970432" ${bankBin === '970432' ? 'selected' : ''}>VPBank</option>
                </select>
                <input id="prof-bank-acc" type="text" value="${escapeHtml(bankAcc)}" placeholder="Số tài khoản" class="w-full px-3 py-2 rounded-xl bg-black/40 text-white font-mono font-bold focus:outline-none" />
              </div>
              <button type="button" onclick="appActions.saveMyMemberProfile()" class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs">💾 Lưu Hồ Sơ</button>
            </div>
          ` : `
            <div class="divide-y divide-white/10 text-xs">
              <div class="py-2 flex items-center justify-between">
                <span class="text-slate-400">CCCD</span>
                <span class="font-mono font-bold text-white">${hidden ? '••••••••••••' : escapeHtml(prof.cccd || 'Chưa cập nhật')}</span>
              </div>
              <div class="py-2 flex items-center justify-between">
                <span class="text-slate-400">Ngày sinh</span>
                <span class="font-mono font-bold text-white">${hidden ? '••••••••' : escapeHtml(prof.dob || 'Chưa cập nhật')}</span>
              </div>
              <div class="py-2 flex items-center justify-between">
                <span class="text-slate-400">Điện thoại</span>
                <span class="font-mono font-bold text-emerald-400">${hidden ? '••••••••••' : escapeHtml(prof.phone || 'Chưa cập nhật')}</span>
              </div>
            </div>
          `}
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-0.5">
          <button type="button" onclick="appActions.switchMemberFromVipCard()" class="py-3 rounded-2xl bg-[#1c2029] hover:bg-[#252b37] text-amber-300 font-black text-xs flex items-center justify-center gap-1.5 transition-colors">
            <span>🔄 Đổi Nhân Sự</span>
          </button>
          <button type="button" onclick="appActions.logoutMember()" class="py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-1.5 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
            <span>Đăng xuất</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderFormModalHtml() {
  const f = state.formModal;
  if (!f) return '';
  const busyMap = getBusyMembersMap(f.startDate, f.endDate, f.showId);
  const roleIcons = {
    quay: '🎬',
    chup: '📷',
    dung: '✂️',
    flycam: '🚁',
    den: '💡'
  };

  return `
    <div onclick="appActions.closeFormModal()" class="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-2 sm:p-4">
      <div onclick="event.stopPropagation()" style="overflow-anchor: none;" class="ios-sheet custom-scroll bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-4 sm:p-5 space-y-3 max-h-[92dvh] overflow-y-auto text-xs shadow-2xl">
        <div class="flex justify-between items-center border-b border-slate-100 pb-2.5">
          <h3 class="font-black text-sm text-slate-900 uppercase">${f.mode === 'edit' ? `✏️ SỬA SHOW #${f.stt || ''}` : '⚡ NỔ SHOW MỚI'}</h3>
          <button type="button" onclick="appActions.closeFormModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 flex items-center justify-center">✕</button>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input type="text" value="${escapeHtml(f.location)}" oninput="appActions.updateFormField('location', this.value)" placeholder="Địa điểm (Hồ Tràm, SG...)" class="px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500" />
          <input type="text" value="${escapeHtml(f.partner)}" oninput="appActions.updateFormField('partner', this.value)" placeholder="Tên show - Đối tác" class="px-3 py-2 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500" />
        </div>

        <label class="flex items-center gap-2 font-bold text-slate-700 cursor-pointer select-none">
          <input type="checkbox" ${f.hidePartner ? 'checked' : ''} onchange="appActions.updateFormField('hidePartner', this.checked)" class="rounded border-slate-300" />
          <span>Ẩn đối tác với mọi người, chỉ báo bận lên lịch chung</span>
        </label>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-[10.5px] font-extrabold text-slate-700 mb-1">Ngày Bắt Đầu:</label>
            <input type="date" value="${escapeHtml(f.startDate)}" onchange="appActions.updateFormField('startDate', this.value)" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500" />
          </div>
          <div>
            <label class="block text-[10.5px] font-extrabold text-slate-700 mb-1">Ngày Kết Thúc:</label>
            <input type="date" value="${escapeHtml(f.endDate)}" onchange="appActions.updateFormField('endDate', this.value)" class="w-full px-3 py-2 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:border-indigo-500" />
          </div>
        </div>

        <div>
          <label class="block text-[10.5px] font-extrabold text-slate-700 mb-1">📌 Chọn Chủ Show (Phụ trách show):</label>
          <select onchange="appActions.updateFormField('ownerId', this.value)" class="w-full px-3 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-900 bg-white focus:outline-none focus:border-indigo-500">
            ${state.members.map(m => `<option value="${m.id}" ${f.ownerId === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`).join('')}
          </select>
        </div>

        <div class="space-y-1">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[11px] font-black text-slate-900">Chọn Nhân Sự &amp; Gắn Vai Trò:</span>
            <div class="flex items-center gap-2 shrink-0 text-[10.5px] font-bold">
              <button type="button" onclick="appActions.selectOnlyMeInForm()" class="text-slate-600 hover:text-indigo-600">Chỉ mình tôi</button>
              <button type="button" onclick="appActions.selectAllMembersInForm()" class="text-indigo-600 hover:text-indigo-800 font-extrabold">Chọn tất cả</button>
            </div>
          </div>

          <div class="grid grid-cols-3 gap-1.5 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
            ${state.members.map(m => {
              const sel = f.memberIds.includes(m.id);
              const busy = busyMap[m.id];
              const roles = f.roles?.[m.id] || [];
              const normRoles = (roles || []).map(normalizeRoleName);

              const cardStyleCls = sel
                ? (busy
                    ? 'bg-rose-50/95 border-rose-500 ring-1 ring-rose-300'
                    : 'bg-indigo-50/90 border-indigo-500')
                : (busy
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-white border-slate-200/80 hover:border-slate-300');

              return `
                <div onclick="appActions.toggleFormMember('${m.id}')" class="p-1.5 rounded-xl border cursor-pointer transition select-none flex flex-col gap-1 ${cardStyleCls}">
                  <div class="flex items-center justify-between gap-1">
                    ${renderPillHtml(m.id, 'xs')}
                    <span class="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] shrink-0 ${
                      sel
                        ? (busy ? 'bg-rose-600 text-white' : 'bg-slate-900 text-white')
                        : 'border border-slate-300 bg-white text-transparent'
                    }">✓</span>
                  </div>

                  ${busy ? `
                    <div class="px-1.5 py-0.5 rounded-md text-[9px] font-extrabold truncate leading-tight ${
                      sel
                        ? 'bg-rose-600 text-white'
                        : 'text-rose-600'
                    }">
                      ⚠️ ${sel ? 'Trùng: ' : ''}${escapeHtml(busy.join(', '))}
                    </div>
                  ` : ''}

                   ${sel ? `
                    <div class="flex flex-wrap gap-1 pt-0.5" onclick="event.stopPropagation()">
                      ${ROLE_OPTIONS.map(r => {
                        const active = normRoles.includes(r.id);
                        return `
                          <button type="button" onclick="appActions.toggleMemberRole('${m.id}', '${r.id}')" class="px-1.5 py-[2px] rounded text-[8.5px] font-bold border leading-tight transition ${
                            active
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }">
                            ${escapeHtml(r.label)}
                          </button>
                        `;
                      }).join('')}
                    </div>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="overflow-anchor: none;" class="p-3.5 rounded-2xl border border-indigo-200/80 bg-indigo-50/90 space-y-2.5">
          <div class="flex items-start gap-2.5 min-w-0">
            <div class="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-sm shrink-0 shadow-xs">
              🤝
            </div>
            <div class="min-w-0">
              <div class="font-black text-slate-900 text-xs leading-tight">Nhân sự ngoài (Freelancer)</div>
              <div class="text-[10.5px] text-slate-500 mt-0.5 leading-snug">Bão show book thêm người ngoài: ghi tên &amp; chọn vai trò</div>
            </div>
          </div>

          <button type="button" onclick="appActions.addExternalCrewDraft()" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-extrabold text-[11px] inline-flex items-center gap-1 transition">
            <span>+ Thêm nhân sự ngoài</span>
          </button>

          <div id="external-crew-list-box" style="overflow-anchor: none;" class="space-y-2">
            ${(f.externalCrew || []).map((p, idx) => {
              const extRoles = Array.isArray(p?.roles) ? p.roles : [];
              return `
                <div data-ext-idx="${idx}" class="p-3 rounded-2xl bg-white border border-indigo-100 shadow-2xs space-y-2">
                  <div class="flex items-center gap-2">
                    <input type="text" value="${escapeHtml(p?.name || '')}" oninput="appActions.updateExternalCrewName(${idx}, this.value)" placeholder="Nhập tên (VD: Minh Flycam)..." class="flex-1 min-w-0 px-3 py-2 bg-white border border-slate-200 rounded-xl font-semibold text-xs text-slate-800 focus:outline-none focus:border-indigo-500" />
                    <button type="button" onclick="appActions.removeExternalCrewDraft(${idx})" title="Xóa nhân sự ngoài" class="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 flex items-center justify-center shrink-0 transition">
                      <i class="fa-regular fa-trash-can text-xs"></i>
                    </button>
                  </div>
                 <div class="flex flex-wrap gap-1">
                    ${ROLE_OPTIONS.map(r => {
                      const active = extRoles.includes(r.label) || extRoles.includes(r.id) || extRoles.map(normalizeRoleName).includes(r.id);
                      return `
                        <button type="button" onclick="appActions.toggleExternalCrewRole(${idx}, '${escapeHtml(r.label)}')" class="px-2 py-0.5 rounded-md text-[9.5px] font-bold border transition ${
                          active
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }">
                          ${escapeHtml(r.label)}
                        </button>
                      `;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        ${f.error ? `<div class="text-rose-600 font-bold">${escapeHtml(f.error)}</div>` : ''}
        <button type="button" onclick="appActions.saveShowForm()" class="w-full bg-slate-950 hover:bg-slate-900 text-white font-black py-3 rounded-2xl text-xs uppercase tracking-wide flex items-center justify-center gap-1.5 shadow-sm transition">
          <span>⚡</span>
          <span>${f.mode === 'edit' ? 'LƯU CHỈNH SỬA' : 'NỔ SHOW'}</span>
        </button>
      </div>
    </div>
  `;
}

export function renderToastHtml() {
  if (!state.toast) return '';
  return `<div class="fixed top-12 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold text-white bg-slate-900">${escapeHtml(state.toast.message)}</div>`;
}

export function renderCtpCustomShowModalHtml() {
  const m = state.ctpCustomShowModal;
  if (!m) return '';
  return `
    <div onclick="ctpActions.closeAddCustomShowModal()" class="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-md bg-white rounded-3xl p-5 space-y-3.5 text-xs shadow-2xl">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-black text-sm text-slate-900">📝 TỰ NOTE SHOW NGOÀI LỊCH</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">Show sẽ được thêm vào cuối danh sách tính CTP tháng T${state.ctpMonth}</p>
          </div>
          <button type="button" onclick="ctpActions.closeAddCustomShowModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">✕</button>
        </div>

        <div class="space-y-2.5">
          <div>
            <label class="block font-bold text-slate-700 mb-1">📍 Địa điểm / Tên Show (*):</label>
            <input id="ctp-ext-loc" type="text" value="${escapeHtml(m.location || '')}" placeholder="VD: Tiệc cưới Q7, Event Phú Quốc..." class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:border-slate-900" />
          </div>
          <div>
            <label class="block font-bold text-amber-800 mb-1">🛡️ Đối tác / Ghi chú (Tự động ẩn trên lịch chung):</label>
            <input id="ctp-ext-partner" type="text" value="${escapeHtml(m.partner || '')}" placeholder="VD: PSC, Anh Khoa gọi ngoài..." class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold focus:outline-none focus:border-slate-900" />
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <div>
              <label class="block font-bold text-slate-700 mb-1">Từ ngày:</label>
              <input id="ctp-ext-start" type="date" value="${escapeHtml(m.startDate || '')}" class="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold" />
            </div>
            <div>
              <label class="block font-bold text-slate-700 mb-1">Đến ngày:</label>
              <input id="ctp-ext-end" type="date" value="${escapeHtml(m.endDate || '')}" class="w-full px-3 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold" />
            </div>
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">📌 Chọn Chủ Show (Người thanh toán CTP):</label>
            <select id="ctp-ext-owner" class="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold">
              ${(state.members || []).map(mem => `<option value="${mem.id}" ${m.ownerId === mem.id ? 'selected' : ''}>${escapeHtml(mem.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-1">
          <button type="button" onclick="ctpActions.closeAddCustomShowModal()" class="py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs">Huỷ</button>
          <button type="button" onclick="ctpActions.submitAddCustomShow()" class="py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs">OK • THÊM VÀO CUỐI</button>
        </div>
      </div>
    </div>
  `;
}

export function renderHoldComposerModalHtml() {
  const hm = state.holdComposerModal;
  if (!hm) return '';
  const selectedIds = Array.isArray(hm.memberIds) ? hm.memberIds : [];

  return `
    <div onclick="holdBellActions.closeHoldComposer()" class="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-md bg-white rounded-3xl p-5 space-y-3.5 text-xs shadow-2xl max-h-[90dvh] overflow-y-auto">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-black text-sm text-slate-900">📌 GIỮ LỊCH / NHẮC CHỦ SHOW</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">Khóa trùng lịch &amp; báo cho Chủ show + anh em đi cùng</p>
          </div>
          <button type="button" onclick="holdBellActions.closeHoldComposer()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">✕</button>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block font-bold text-slate-700 mb-1">Từ ngày:</label>
            <input id="hold-start-date" type="date" value="${escapeHtml(hm.startDate || '')}" class="w-full px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-mono font-bold" />
          </div>
          <div>
            <label class="block font-bold text-slate-700 mb-1">Đến ngày:</label>
            <input id="hold-end-date" type="date" value="${escapeHtml(hm.endDate || '')}" class="w-full px-3 py-2 rounded-2xl bg-white border border-slate-200 text-xs font-mono font-bold" />
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">📌 Chủ show phụ trách (nhận nhắc điền tiếp):</label>
          <select id="hold-owner-id" class="w-full px-3.5 py-2.5 rounded-2xl bg-white border border-slate-200 text-xs font-bold">
            ${(state.members || []).map(mem => `
              <option value="${mem.id}" ${hm.ownerId === mem.id ? 'selected' : ''}>
                ${escapeHtml(mem.name)}${mem.id === state.currentUserId ? ' (Chính mình — chờ khách chốt)' : ''}
              </option>
            `).join('')}
          </select>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1.5">👥 Nhân sự giữ lịch (nhận thông báo &amp; khóa trùng):</label>
          <div class="flex flex-wrap gap-1.5">
            ${(state.members || []).map(mem => {
              const active = selectedIds.includes(mem.id);
              return `
                <button type="button" onclick="holdBellActions.toggleHoldMember('${mem.id}')" class="px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                  active
                    ? 'bg-slate-900 text-amber-300 border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }">
                  ${escapeHtml(mem.name)}
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <div>
          <label class="block font-bold text-slate-700 mb-1">📝 Ghi chú nhanh:</label>
          <input id="hold-note-inp" type="text" value="${escapeHtml(hm.note || '')}" placeholder="VD: Đi tỉnh 4 người / Chờ Agency X chốt..." class="w-full px-3.5 py-2.5 rounded-2xl bg-white border-2 border-slate-900 text-xs font-semibold focus:outline-none" />
        </div>

        <button type="button" onclick="holdBellActions.submitQuickHold()" class="w-full py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-900 text-amber-400 font-black text-xs uppercase tracking-wide">
          ⏳ LƯU GIỮ LỊCH &amp; GỬI THÔNG BÁO
        </button>
      </div>
    </div>
  `;
}

export function renderHoldBellModalHtml() {
  if (!state.holdBellModalOpen) return '';
  const holds = (state.shows || []).filter(s => s && s.isHold && !s.isCancelled);
  const myHolds = holds.filter(s => s.ownerId === state.currentUserId || (s.memberIds || []).includes(state.currentUserId));

  return `
    <div onclick="holdBellActions.closeBellDrawer()" class="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
      <div onclick="event.stopPropagation()" class="w-full max-w-md bg-white rounded-3xl p-5 space-y-3.5 text-xs shadow-2xl max-h-[88dvh] overflow-y-auto">
        <div class="flex items-start justify-between">
          <div>
            <h3 class="font-black text-sm text-slate-900">🔔 THÔNG BÁO &amp; GIỮ LỊCH</h3>
            <p class="text-[11px] text-slate-500 mt-0.5">Vuốt lên xuống để xem tất cả lịch chờ &amp; show mới chốt</p>
          </div>
          <button type="button" onclick="holdBellActions.closeBellDrawer()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 font-bold text-slate-600">✕</button>
        </div>

        <button type="button" onclick="holdBellActions.createQuickHold()" class="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wide">
          GIỮ LỊCH / NHẮC CHỦ SHOW MỚI
        </button>

        <div class="space-y-1.5">
          <div class="text-[10.5px] font-black text-amber-700 uppercase">⏳ CHỜ BẠN CẬP NHẬT / CHỐT SHOW (0)</div>
          <div class="py-4 px-3 rounded-2xl border border-dashed border-slate-200 text-center text-[11px] text-slate-400">
            Không có lịch giữ chỗ nào đang chờ bạn chốt.
          </div>
        </div>

        <div class="space-y-2">
          <div class="text-[10.5px] font-black text-rose-700 uppercase">📌 LỊCH BẠN ĐƯỢC GIỮ CHỖ — CHỜ CHỦ SHOW (${myHolds.length})</div>
          ${myHolds.length === 0 ? `
            <div class="py-3 px-3 rounded-2xl bg-slate-50 text-center text-[11px] text-slate-400">Chưa có lịch giữ chỗ nào.</div>
          ` : myHolds.map(h => {
            const owner = getMember(h.ownerId);
            const crewNames = (h.memberIds || []).map(id => getMember(id).name).join(', ');
            return `
              <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-black text-slate-900 text-xs truncate">🗓️ ${escapeHtml(h.startDate)}${h.endDate && h.endDate !== h.startDate ? ' → ' + escapeHtml(h.endDate) : ''} • ${escapeHtml(h.location || '')}</div>
                  <div class="text-[10.5px] text-slate-500 mt-0.5 truncate">Chủ show: <b>${escapeHtml(owner.name)}</b> • Giữ bởi: ${escapeHtml(crewNames || owner.name)}</div>
                </div>
                <button type="button" onclick="holdBellActions.releaseHold('${escapeHtml(h.id)}')" class="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-600 border border-slate-200 font-bold text-[11px] shrink-0">Gỡ</button>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

export function renderCrewManifestModalHtml() {
  const showId = state.crewManifestShowId;
  if (!showId) return '';
  const sh = (state.shows || []).find(s => s && s.id === showId);
  if (!sh) return '';

  const loc = escapeHtml(sh.location || '');
  const dateLabel = escapeHtml(formatDayMonth(sh.startDate || ''));

  const memberLines = (sh.memberIds || []).map((mid, i) => {
    const p = state.memberProfiles?.[mid] || {};
    const name = (state.officialLegalNames?.[mid] || p.fullName || getMember(mid).name).toUpperCase();
    return `${i + 1}. ${name} | CCCD: ${p.cccd || 'Chưa cập nhật'} | SĐT: ${p.phone || '-'}`;
  });

  const baseIdx = memberLines.length;
  const extLines = (sh.externalCrew || []).map((ext, j) => {
    const name = (String(ext?.name || '').trim() || `NS ${j + 1}`).toUpperCase();
    const roleText = Array.isArray(ext?.roles) && ext.roles.length > 0 ? ` (${ext.roles.join(', ')})` : '';
    return `${baseIdx + j + 1}. ${name}${roleText} | CCCD: ${ext?.cccd || 'Chưa cập nhật'} | SĐT: ${ext?.phone || '-'}`;
  });

  const defaultText = [...memberLines, ...extLines].join('\n');
  const textValue = state.crewManifestDraft ?? defaultText;

  return `
    <div id="crew-manifest-backdrop" onclick="if(event.target.id==='crew-manifest-backdrop') appActions.closeCrewManifestModal()" class="fixed inset-0 z-[110] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3">
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div class="px-5 pt-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
          <div>
            <div class="text-base font-black text-slate-900 flex items-center gap-1.5">📋 DANH SÁCH NHÂN SỰ</div>
            <div class="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
              <span>📌 ${loc}</span>
              <span>•</span>
              <span>${dateLabel}</span>
            </div>
          </div>
          <button type="button" onclick="appActions.closeCrewManifestModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center">✕</button>
        </div>

        <div class="p-4 space-y-2.5">
          <div class="flex items-center justify-between text-xs">
            <span class="font-bold text-slate-600">✏️ Chạm trực tiếp để sửa</span>
            <button type="button" onclick="appActions.resetCrewManifestDraft('${escapeHtml(sh.id)}')" class="font-extrabold text-blue-600 hover:underline inline-flex items-center gap-1">
              <span>↺</span>
              <span>Khôi phục</span>
            </button>
          </div>
          <textarea id="crew-manifest-textarea" rows="6" oninput="appActions.updateCrewManifestDraft(this.value)" class="w-full p-3.5 rounded-2xl bg-slate-100/90 border border-slate-200/80 text-slate-800 text-xs leading-relaxed font-medium focus:outline-none focus:bg-white focus:border-slate-400">${escapeHtml(textValue)}</textarea>
          <button type="button" onclick="appActions.copyCrewManifestText('${escapeHtml(sh.id)}')" class="w-full py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-black text-xs tracking-wide uppercase flex items-center justify-center gap-2 shadow-lg">
            <span>📋</span>
            <span>COPY DANH SÁCH</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderClientDebtBillModalHtml() {
  const dbm = state.clientDebtBillModal;
  if (!dbm) return '';
  const prof = state.memberProfiles?.[state.currentUserId] || {};
  const ownerName = (state.officialLegalNames?.[state.currentUserId] || prof.fullName || dbm.ownerName || '').trim().toUpperCase();
  const qrUrl = prof.bankAcc ? buildVietQrUrl(prof.bankBin, prof.bankAcc) : '';
  const clientFilter = dbm.clientFilter || 'all';
  const clientOptions = Array.isArray(dbm.clients) ? dbm.clients : [];
  const visibleRows = clientFilter === 'all'
    ? dbm.rows
    : dbm.rows.filter(r => r.clientKey === clientFilter);
  const chosenObj = clientOptions.find(c => c.key === clientFilter);
  const headerClient = clientFilter === 'all' ? 'Tất cả khách hàng' : (chosenObj?.label || clientFilter);

  const totalPrice = visibleRows.reduce((s, r) => s + (Number(r.clientPrice) || 0), 0);
  const totalPaid = visibleRows.reduce((s, r) => s + (Number(r.depositPaid) || 0), 0);
  const totalRemaining = visibleRows.reduce((s, r) => s + (Number(r.remaining) || 0), 0);

  return `
    <div onclick="ownerActions.closeClientDebtBill()" class="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-2.5 sm:p-4">
      <div onclick="event.stopPropagation()" id="client-debt-bill-capture-area" class="bg-white w-full max-w-3xl rounded-3xl p-4 sm:p-5 space-y-3 text-xs shadow-2xl flex flex-col max-h-[90dvh]">
        <div class="flex justify-between items-center border-b pb-2 shrink-0 gap-2">
          <div class="min-w-0">
            <h3 class="font-black text-sm text-slate-900">BẢNG CÔNG NỢ KHÁCH HÀNG — ${escapeHtml(dbm.periodLabel)}</h3>
            <p class="text-[11px] text-slate-500 truncate">Khách hàng: <b class="text-slate-800">${escapeHtml(headerClient)}</b> • Người phụ trách: <b class="text-slate-800">${escapeHtml(ownerName)}</b> • Còn thiếu: <b class="text-rose-600 font-mono">${totalRemaining.toLocaleString('vi-VN')}đ</b></p>
          </div>
          <button type="button" data-html2canvas-ignore="true" onclick="ownerActions.closeClientDebtBill()" class="w-8 h-8 rounded-full bg-slate-100 shrink-0">✕</button>
        </div>

        <div data-html2canvas-ignore="true" class="flex items-center gap-2 shrink-0">
          <span class="text-[10.5px] font-black text-slate-500 uppercase shrink-0">LỌC KHÁCH HÀNG:</span>
          <select onchange="ownerActions.setClientDebtFilter(this.value)" class="flex-1 min-w-0 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold">
            <option value="all" ${clientFilter === 'all' ? 'selected' : ''}>Tất cả khách hàng (${dbm.rows.length} show)</option>
            ${clientOptions.map(c => `<option value="${escapeHtml(c.key)}" ${clientFilter === c.key ? 'selected' : ''}>${escapeHtml(c.label)} (${c.count} show)</option>`).join('')}
          </select>
        </div>

        <div class="flex-1 min-h-0 overflow-auto border border-slate-200 rounded-2xl">
          <table class="w-full border-collapse text-[11px] min-w-[640px]">
            <thead class="sticky top-0 bg-slate-900 text-white font-extrabold text-[10px] uppercase">
              <tr>
                <th class="py-2 px-1.5 border border-slate-800 w-10">STT</th>
                <th class="py-2 px-1.5 border border-slate-800 w-14">NGÀY</th>
                <th class="py-2 px-2 border border-slate-800 text-left">SHOW / KHÁCH HÀNG</th>
                <th class="py-2 px-2 border border-slate-800 text-left min-w-[150px]">NỘI DUNG</th>
                <th class="py-2 px-1.5 border border-slate-800 text-right">BÁO GIÁ</th>
                <th class="py-2 px-1.5 border border-slate-800 text-right">ĐÃ TRẢ</th>
                <th class="py-2 px-1.5 border border-slate-800 text-right">CÒN NỢ</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${visibleRows.map((r, i) => `
                <tr>
                  <td class="py-1.5 px-1.5 border text-center">${i + 1}</td>
                  <td class="py-1.5 px-1.5 border text-center font-mono">${escapeHtml(r.dateLabel)}</td>
                  <td class="py-1.5 px-2 border font-bold">${escapeHtml(r.title)}</td>
                  <td class="py-1.5 px-1.5 border">
                    <input type="text" value="${escapeHtml(r.content || '')}" oninput="ownerActions.updateClientDebtRowContent('${escapeHtml(r.showId)}', this.value)" placeholder="Nhập nội dung công việc..." class="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-medium focus:outline-none focus:border-indigo-500" />
                  </td>
                  <td class="py-1.5 px-1.5 border text-right font-mono">${Number(r.clientPrice || 0).toLocaleString('vi-VN')}đ</td>
                  <td class="py-1.5 px-1.5 border text-right font-mono text-emerald-700">${Number(r.depositPaid || 0).toLocaleString('vi-VN')}đ</td>
                  <td class="py-1.5 px-1.5 border text-right font-mono font-black text-rose-600">${Number(r.remaining || 0).toLocaleString('vi-VN')}đ</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr class="bg-slate-900 text-white font-mono font-black">
                <td colspan="4" class="py-2 px-2 text-right text-amber-300">TỔNG CỘNG:</td>
                <td class="py-2 px-1.5 text-right">${totalPrice.toLocaleString('vi-VN')}đ</td>
                <td class="py-2 px-1.5 text-right text-emerald-400">${totalPaid.toLocaleString('vi-VN')}đ</td>
                <td class="py-2 px-1.5 text-right text-rose-400">${totalRemaining.toLocaleString('vi-VN')}đ</td>
              </tr>
            </tfoot>
          </table>
        </div>

        ${qrUrl ? `
          <div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200 shrink-0">
            <div class="text-[11px] space-y-0.5">
              <div class="font-black text-slate-900 uppercase">💳 QUÉT MÃ VIETQR THANH TOÁN</div>
              <div>Ngân hàng: <b>${escapeHtml(getBankName(prof.bankBin))}</b></div>
              <div>Chủ TK: <b class="uppercase">${escapeHtml(ownerName)}</b></div>
              <div>Số TK: <b class="font-mono text-indigo-700">${escapeHtml(prof.bankAcc)}</b></div>
            </div>
            <img src="${qrUrl}" alt="VietQR" class="vietqr-img-el w-20 h-20 object-contain bg-white p-1 rounded-xl border shrink-0" />
          </div>
        ` : ''}

        <div data-html2canvas-ignore="true" class="grid grid-cols-3 gap-2 shrink-0">
          <button type="button" onclick="ownerActions.captureClientDebtBill()" class="bg-amber-400 text-slate-950 font-black py-2.5 rounded-full text-[11px]">📸 Chụp Ảnh</button>
          <button type="button" onclick="ownerActions.copyClientDebtText()" class="bg-emerald-600 text-white font-black py-2.5 rounded-full text-[11px]">Copy Zalo</button>
          <button type="button" onclick="ownerActions.exportOwnerExcel()" class="bg-slate-900 text-white font-black py-2.5 rounded-full text-[11px]">Tải .XLSX</button>
        </div>
      </div>
    </div>
  `;
}
