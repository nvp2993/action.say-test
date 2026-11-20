import { state } from '../state/store.js';
import { escapeHtml, getSortedMembers, formatDdMmYyyy } from '../utils/helpers.js';
import { getBusyMembersMap } from '../services/show.service.js';

export function renderCrewBoardTabHtml() {
  const busyMap = getBusyMembersMap(state.checkStart, state.checkEnd);
  const members = getSortedMembers();
  const avail = members.filter(m => !busyMap[m.id]);
  const busy = members.filter(m => busyMap[m.id]);

  const renderAvatar = (m) => {
    const saved = JSON.parse(localStorage.getItem('as_member_avatars_2026') || '{}');
    const av = state.memberProfiles?.[m.id]?.avatarUrl || state.memberProfiles?.[m.id]?.avatar || saved[m.id] || '';
    return av ? `<img src="${av}" alt="${escapeHtml(m.name)}" class="w-full h-full object-cover" />` : escapeHtml(m.shortLabel.slice(0, 2));
  };

  return `
    <div class="flex-1 min-h-0 overflow-y-auto custom-scroll p-3 bg-slate-50">
      <div class="as-ag-shell">
        <div class="as-ag-header">
          <div>
            <div class="as-ag-brand">Action × Say • Crew Board</div>
            <div class="as-ag-title-row">
              <div class="as-ag-title">NHÂN SỰ RẢNH / BẬN</div>
              <div class="as-ag-summary-pill"><b class="ok">${avail.length} rảnh</b> • <b class="busy">${busy.length} bận</b></div>
            </div>
          </div>
          <div class="as-ag-date-bar">
            <div class="as-ag-date-field">
              <span>Từ ngày</span>
              <div class="as-date-ddmmyyyy-wrap">
                <input type="date" value="${state.checkStart}" onchange="appActions.setCheckDate('checkStart', this.value)" />
                <div class="as-date-ddmmyyyy-display"><span class="as-date-text">${formatDdMmYyyy(state.checkStart)}</span></div>
              </div>
            </div>
            <span class="as-ag-date-arrow">→</span>
            <div class="as-ag-date-field">
              <span>Đến ngày</span>
              <div class="as-date-ddmmyyyy-wrap">
                <input type="date" min="${state.checkStart}" value="${state.checkEnd}" onchange="appActions.setCheckDate('checkEnd', this.value)" />
                <div class="as-date-ddmmyyyy-display"><span class="as-date-text">${formatDdMmYyyy(state.checkEnd)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div class="as-ag-board">
          <div class="as-ag-col">
            <div class="as-ag-col-head">
              <div class="as-ag-col-title"><span class="as-ag-dot-ok"></span>Ekip sẵn sàng (${avail.length}/${members.length})</div>
              <span class="as-ag-col-sub">Chạm thẻ để nổ show</span>
            </div>
            ${avail.length ? `
              <div class="as-ag-avail-grid">
                ${avail.map(m => `
                  <div onclick="appActions.openAddModal('${state.checkStart}', '${m.id}')" class="as-ag-card-ok">
                    <div class="as-ag-user">
                      <div class="as-ag-ava">${renderAvatar(m)}</div>
                      <div style="min-width:0;">
                        <div class="as-ag-name">${escapeHtml(m.name)}</div>
                        <div class="as-ag-role-hint">Available</div>
                      </div>
                    </div>
                    <span class="as-ag-chev">›</span>
                  </div>
                `).join('')}
              </div>
            ` : `<div class="as-ag-empty">Tất cả anh em đều đã có lịch trong khoảng ngày này</div>`}
          </div>

          <div class="as-ag-col">
            <div class="as-ag-col-head">
              <div class="as-ag-col-title"><span class="as-ag-dot-busy"></span>Ekip đang có lịch (${busy.length}/${members.length})</div>
              <span class="as-ag-col-sub">Lịch hiện tại</span>
            </div>
            ${busy.length ? `
              <div class="as-ag-busy-stack">
                ${busy.map(m => `
                  <div class="as-ag-card-busy">
                    <div class="as-ag-user" style="flex:1;">
                      <div class="as-ag-ava">${renderAvatar(m)}</div>
                      <div style="min-width:0;">
                        <div class="as-ag-name">${escapeHtml(m.name)}</div>
                        <div class="as-ag-busy-loc">📍 ${escapeHtml(busyMap[m.id].join(', '))}</div>
                      </div>
                    </div>
                    <span class="as-ag-status-chip">Đi show</span>
                  </div>
                `).join('')}
              </div>
            ` : `<div class="as-ag-empty">Chưa có anh em nào giữ lịch trong ngày này</div>`}
          </div>
        </div>
      </div>
    </div>
  `;
}
