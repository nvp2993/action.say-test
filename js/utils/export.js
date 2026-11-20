import { state, triggerRender } from '../state/store.js';
import { getMember, showToast } from './helpers.js';

export function exportShowToAppleCalendar(showId, getVisiblePartnerText) {
  const sh = state.shows.find(s => s.id === showId);
  if (!sh) return;
  const startClean = sh.startDate.replace(/-/g, '');
  const endObj = new Date(sh.endDate + 'T00:00:00');
  endObj.setDate(endObj.getDate() + 1);
  const endClean = endObj.toISOString().slice(0, 10).replace(/-/g, '');

  const crewNames = (sh.memberIds || []).map(id => {
    const r = sh.roles?.[id] ? ` (${Array.isArray(sh.roles[id]) ? sh.roles[id].join(', ') : sh.roles[id]})` : '';
    return getMember(id).name + r;
  }).join(', ');

  const visPartner = getVisiblePartnerText(sh);
  const icsLines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Action & Say Media//Lich Show//VI',
    'BEGIN:VEVENT',
    `UID:${sh.id}@actionsay.vn`,
    `DTSTAMP:${startClean}T010000Z`,
    `DTSTART;VALUE=DATE:${startClean}`,
    `DTEND;VALUE=DATE:${endClean}`,
    `SUMMARY:🎬 Show: ${sh.location}${visPartner ? ' - ' + visPartner : ''}`,
    `DESCRIPTION:Nhân sự: ${crewNames}\\nChủ show: ${getMember(sh.ownerId).name}\\nGhi chú: ${sh.note || 'Chuẩn bị thiết bị đầy đủ!'}`,
    `LOCATION:${sh.location}`,
    'BEGIN:VALARM', 'TRIGGER:-PT4H', 'ACTION:DISPLAY', 'DESCRIPTION:Nhắc lịch đi show ngày mai!', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsLines], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `lich-show-${sh.startDate}.ics`; a.click();
  URL.revokeObjectURL(url);
  showToast('📅 Đã tải file Lịch iPhone (.ics)!');
}

async function fetchImageAsBase64(url) {
  const cleanUrl = url.split('?')[0];
  for (const u of [cleanUrl, `https://wsrv.nl/?url=${encodeURIComponent(cleanUrl)}&output=png`]) {
    try {
      const res = await fetch(u, { mode: 'cors' });
      if (!res.ok) continue;
      const blob = await res.blob();
      return await new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch {}
  }
  return null;
}

export async function captureElementToPreview(elementId, fileName, title) {
  const target = document.getElementById(elementId);
  if (!target || typeof html2canvas === 'undefined') return;
  showToast('📸 Đang xử lý mã QR & chụp ảnh...');

  const qrImgs = Array.from(target.querySelectorAll('img[alt="VietQR"], img.vietqr-img-el'));
  const restored = [];
  for (const img of qrImgs) {
    if (img.src && !img.src.startsWith('data:image')) {
      const b64 = await fetchImageAsBase64(img.src);
      if (b64) {
        img.src = b64;
        try { if (img.decode) await img.decode(); } catch {}
      }
    }
    try {
      const w = img.clientWidth || 112;
      const h = img.clientHeight || 112;
      const c = document.createElement('canvas');
      c.width = w * 2; c.height = h * 2;
      c.style.width = `${w}px`; c.style.height = `${h}px`;
      c.className = img.className;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      img.parentNode.insertBefore(c, img);
      img.style.display = 'none';
      restored.push({ img, c });
    } catch {}
  }

  const scrollBox = target.querySelector('.overflow-auto');
  const oldMaxH = target.style.maxHeight;
  const oldOv = scrollBox ? scrollBox.style.overflow : '';
  target.style.maxHeight = 'none';
  if (scrollBox) scrollBox.style.overflow = 'visible';

  try {
    const canvas = await html2canvas(target, {
      scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: false,
      ignoreElements: el => el.getAttribute?.('data-html2canvas-ignore') === 'true'
    });
    state.imagePreviewModal = { dataUrl: canvas.toDataURL('image/png'), fileName, title };
    triggerRender();
  } catch (err) {
    showToast('Lỗi chụp ảnh: ' + err.message, 'error');
  } finally {
    target.style.maxHeight = oldMaxH;
    if (scrollBox) scrollBox.style.overflow = oldOv;
    restored.forEach(({ img, c }) => { c.remove(); img.style.display = ''; });
  }
}

export async function shareOrDownloadPreviewImage() {
  const m = state.imagePreviewModal;
  if (!m) return;
  try {
    const blob = await (await fetch(m.dataUrl)).blob();
    const file = new File([blob], m.fileName, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: m.title });
      return;
    }
  } catch {}
  const a = document.createElement('a');
  a.href = m.dataUrl; a.download = m.fileName; a.click();
  showToast('🖼️ Đã tải ảnh về máy!');
}