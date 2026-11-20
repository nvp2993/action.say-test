export const ALL_YEARS = [2026, 2027, 2028, 2029, 2030];

export const INITIAL_TEAM_MEMBERS = [
  { id: 'dung',    name: 'Dũng',    shortLabel: 'DŨNG',    bg: '#f4cccc', text: '#990000', order: 1 },
  { id: 'dang',    name: 'Đăng',    shortLabel: 'ĐĂNG',    bg: '#e6e6e6', text: '#222222', order: 2 },
  { id: 'duc_lon', name: 'Đức lớn', shortLabel: 'ĐỨC LỚN', bg: '#a61c00', text: '#ffffff', order: 3 },
  { id: 'duc_nho', name: 'Đức nhỏ', shortLabel: 'ĐỨC NHỎ', bg: '#f6b26b', text: '#5b3200', order: 4 },
  { id: 'khoa',    name: 'Khoa',    shortLabel: 'KHOA',    bg: '#fff2cc', text: '#7f6000', order: 5 },
  { id: 'kien',    name: 'Kiên',    shortLabel: 'KIÊN',    bg: '#93c47d', text: '#1c4587', order: 6 },
  { id: 'ky',      name: 'Kỳ',      shortLabel: 'KỲ',      bg: '#d9d2e9', text: '#351c75', order: 7 },
  { id: 'loc',     name: 'Lộc',     shortLabel: 'LỘC',     bg: '#333333', text: '#ffffff', order: 8 },
  { id: 'nhat',    name: 'Nhật',    shortLabel: 'NHẬT',    bg: '#783f04', text: '#ffffff', order: 9 },
  { id: 'phu_lon', name: 'Phú lớn', shortLabel: 'PHÚ LỚN', bg: '#b6d7a8', text: '#274e13', order: 10 },
  { id: 'phu_nho', name: 'Phú nhỏ', shortLabel: 'PHÚ NHỎ', bg: '#38761d', text: '#ffffff', order: 11 },
  { id: 'thai',    name: 'Thái',    shortLabel: 'THÁI',    bg: '#1155cc', text: '#ffffff', order: 12 },
  { id: 'thuc',    name: 'Thức',    shortLabel: 'THỨC',    bg: '#134f5c', text: '#ffffff', order: 13 }
];

export const BADGE_COLOR_PRESETS = [
  { name: 'Đỏ Đậm', bg: '#a61c00', text: '#ffffff' },
  { name: 'Cam Nhạt', bg: '#f6b26b', text: '#5b3200' },
  { name: 'Xanh Bơ', bg: '#b6d7a8', text: '#274e13' },
  { name: 'Xanh Rừng', bg: '#38761d', text: '#ffffff' },
  { name: 'Tím Nhạt', bg: '#d9d2e9', text: '#351c75' },
  { name: 'Xanh Dương', bg: '#1155cc', text: '#ffffff' },
  { name: 'Xanh Lá', bg: '#93c47d', text: '#1c4587' },
  { name: 'Hồng Phấn', bg: '#f4cccc', text: '#990000' },
  { name: 'Xanh Cổ Vịt', bg: '#134f5c', text: '#ffffff' },
  { name: 'Đen Xám', bg: '#333333', text: '#ffffff' },
  { name: 'Xám Bạc', bg: '#e6e6e6', text: '#222222' },
  { name: 'Nâu Đất', bg: '#783f04', text: '#ffffff' },
  { name: 'Vàng Kem', bg: '#fff2cc', text: '#7f6000' }
];

export const ROLE_OPTIONS = [
  { id: 'Quay', label: '🎥 Quay' },
  { id: 'Chụp', label: '📸 Chụp' },
  { id: 'Dựng', label: '✂️ Dựng' },
  { id: 'Flycam', label: '🚁 Flycam' },
  { id: 'Đèn', label: '💡 Đèn' }
];

export const POST_STATUS_OPTIONS = [
  { id: 'pending', label: '⏳ Chờ chép file', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'editing', label: '✂️ Đang dựng/chỉnh', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'done',    label: '✅ Đã giao khách', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
];

export const OWNER_STATUS_OPTIONS = [
  { id: 'unpaid',    label: '⏳ Chưa thanh lý', badgeCls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'deposited', label: '💵 Đã nhận cọc',   badgeCls: 'bg-blue-100 text-blue-800 border-blue-300' },
  { id: 'settled',   label: '✅ Đã thanh lý',   badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
];

export const CREW_CTP_STATUS_OPTIONS = [
  { id: 'unpaid',  label: '⏳ Chờ Chủ Show trả', badgeCls: 'bg-amber-100 text-amber-800 border-amber-300' },
  { id: 'settled', label: '✅ Đã nhận CTP',      badgeCls: 'bg-emerald-100 text-emerald-800 border-emerald-300' }
];

export const DEFAULT_CTP_RATES = {
  quay1Day: 1500000,
  quayMultiDay: 1200000,
  chup1Day: 1500000,
  chupMultiDay: 1200000,
  dung: 1000000,
  flycam: 1000000,
  lamhinh: 300000,
  gimbal: 200000
};

export const DEFAULT_COLOR_RULES = [
  { id: 'def_1',  keyword: 'hồ tràm, vũng tàu', color: '#c9bee8' },
  { id: 'def_2',  keyword: 'mũi né, phan thiết, nha trang, tây ninh, quy nhơn, hội an', color: '#f2c1a0' },
  { id: 'def_3',  keyword: 'đà lạt, đl, đà nẵng, huế', color: '#dbe89c' },
  { id: 'def_4',  keyword: 'phú quốc, kê gà', color: '#faeec7' },
  { id: 'def_5',  keyword: 'cam ranh, ninh chữ, long khánh, lk', color: '#a8d0a0' },
  { id: 'def_6',  keyword: 'bình dương, đồng tháp, bến tre, vĩnh long, bình phước', color: '#f2cbc6' },
  { id: 'def_7',  keyword: 'long an, đồng nai, ninh bình, hà nội', color: '#cbd6db' },
  { id: 'def_8',  keyword: 'sg, sài gòn, golf, q2', color: '#a4d8f7' },
  { id: 'def_9',  keyword: 'hcm, nhà bè, cần giờ', color: '#c7ebd8' },
  { id: 'def_10', keyword: 'cần thơ, bận', color: '#f5e18c' }
];

export const BANK_LIST = [
  { bin: '970436', name: 'Vietcombank' },
  { bin: '970407', name: 'Techcombank' },
  { bin: '970415', name: 'VietinBank' },
  { bin: '970418', name: 'BIDV' },
  { bin: '970422', name: 'MB Bank' },
  { bin: '970416', name: 'ACB' },
  { bin: '970432', name: 'VPBank' },
  { bin: '970403', name: 'Sacombank' },
  { bin: '970423', name: 'TPBank' },
  { bin: '970405', name: 'Agribank' }
];

export const ADMIN_SWATCH_COLORS_30 = [
  '#f4c29f', '#c9b8df', '#9ec999', '#9ad0f0', '#bce3cf',
  '#f5dc82', '#d2e391', '#faeec7', '#cfd6dc', '#dce9fa',
  '#f2d0c9', '#e8d5b7', '#ffffff'
];

