import {
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth, ADMIN_EMAIL, MEMBER_EMAIL_DOMAIN } from '../config/firebase.js';
import { state, triggerRender } from '../state/store.js';

// Biến đổi PIN 4 số thành mật khẩu đạt chuẩn >= 6 ký tự của Firebase Auth
export function pinToFirebasePassword(pin4) {
  return `AS2026#${String(pin4).trim()}`;
}

export function memberIdToEmail(memberId) {
  return `${String(memberId).trim()}@${MEMBER_EMAIL_DOMAIN}`;
}

export function parseMemberIdFromUser(user) {
  if (!user || !user.email) return null;
  const email = user.email.toLowerCase();
  if (email === ADMIN_EMAIL.toLowerCase()) {
    // Admin mặc định gắn với tài khoản Phú lớn khi xem lịch ngoài App
    return localStorage.getItem('as_admin_acting_member') || 'phu_lon';
  }
  if (email.endsWith(`@${MEMBER_EMAIL_DOMAIN}`)) {
    return email.split('@')[0];
  }
  return null;
}

export function initAuthListener(onAuthenticated, onSignedOut) {
  onAuthStateChanged(auth, (user) => {
    state.authReady = true;
    state.firebaseUser = user || null;

    if (user && user.email) {
      state.isAdminMode = user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      state.currentUserId = parseMemberIdFromUser(user);
      state.pinModal = null;
      if (typeof onAuthenticated === 'function') onAuthenticated(user);
    } else {
      state.isAdminMode = false;
      state.currentUserId = null;
      state.pinModal = { step: 'select', selectedId: null, pinInput: '', error: '', loading: false };
      if (typeof onSignedOut === 'function') onSignedOut();
    }
    triggerRender();
  });
}

// Đăng nhập nhân sự bằng chọn tên + PIN 4 số qua Firebase Auth
export async function loginMemberWithPin(memberId, pin4) {
  if (!/^\d{4}$/.test(String(pin4))) {
    throw new Error('Mã PIN phải gồm đúng 4 chữ số!');
  }
  const email = memberIdToEmail(memberId);
  const password = pinToFirebasePassword(pin4);
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('Mã PIN chưa đúng, vui lòng thử lại!');
    }
    if (err.code === 'auth/user-not-found') {
      throw new Error('Tài khoản nhân sự chưa được tạo trên Firebase Auth!');
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Nhập sai quá nhiều lần. Vui lòng thử lại sau vài phút!');
    }
    throw new Error('Lỗi đăng nhập: ' + err.message);
  }
}

// Đăng nhập Admin bằng Email & Mật khẩu thật trên Firebase Auth
export async function loginAdminWithEmail(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail !== ADMIN_EMAIL.toLowerCase()) {
    throw new Error('Email này không có quyền Quản trị viên!');
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return cred.user;
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('Email hoặc mật khẩu Admin không chính xác!');
    }
    throw new Error('Lỗi đăng nhập Admin: ' + err.message);
  }
}

// Tự đổi PIN cá nhân (xác thực lại PIN cũ rồi cập nhật trực tiếp lên Firebase Auth)
export async function changeMyPin(oldPin4, newPin4) {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('Chưa đăng nhập!');
  if (state.isAdminMode) throw new Error('Tài khoản Admin đổi mật khẩu trên Firebase Console.');
  if (!/^\d{4}$/.test(String(newPin4))) throw new Error('Mã PIN mới phải gồm đúng 4 chữ số!');

  try {
    const credential = EmailAuthProvider.credential(user.email, pinToFirebasePassword(oldPin4));
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, pinToFirebasePassword(newPin4));
  } catch (err) {
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      throw new Error('Mã PIN hiện tại không đúng!');
    }
    throw new Error('Không thể đổi PIN: ' + err.message);
  }
}

export async function logoutCurrentUser() {
  await signOut(auth);
}