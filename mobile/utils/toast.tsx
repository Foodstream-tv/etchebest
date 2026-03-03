import { Toast, ToastPosition } from 'toastify-react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  position: ToastPosition = 'bottom'
): void {
  switch (type) {
    case 'success':
      Toast.success(message, position);
      break;
    case 'error':
      Toast.error(message, position);
      break;
    case 'info':
      Toast.info(message, position);
      break;
    case 'warning':
      Toast.warn(message, position);
      break;
    default:
      Toast.info(message, position);
      break;
  }
}

/**
 * Shorthand toast functions
 */
export const toast = {
  success: (message: string, position?: ToastPosition) => showToast(message, 'success', position),
  error: (message: string, position?: ToastPosition) => showToast(message, 'error', position),
  info: (message: string, position?: ToastPosition) => showToast(message, 'info', position),
  warning: (message: string, position?: ToastPosition) => showToast(message, 'warning', position),
};

export default toast;
