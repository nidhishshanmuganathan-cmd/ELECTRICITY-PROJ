export function authErrorMessage(error) {
  const messages = {
    'auth/unauthorized-domain': 'Sign-in is not enabled for this website yet. Please contact the app owner.',
    'auth/popup-blocked': 'Allow pop-ups for this website, then try Google sign-in again. On mobile, open the site directly in Chrome or Safari.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled. Please try again.',
    'auth/cancelled-popup-request': 'Another sign-in window is already open.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled yet. Please contact the app owner.',
    'auth/network-request-failed': 'Unable to connect. Check your internet connection and try again.',
    'auth/too-many-requests': 'Too many attempts. Please wait and try again.',
    'auth/invalid-credential': 'Invalid email or password.',
    'auth/wrong-password': 'Invalid email or password.',
    'auth/user-not-found': 'Invalid email or password.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled. Please contact the app owner.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password should be at least 6 characters.',
  }
  return messages[error?.code] || 'Unable to complete this request. Please try again.'
}
