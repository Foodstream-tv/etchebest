import { Toast } from 'toastify-react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  position?: 'top' | 'bottom' | 'center';
}

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
): void {
  const { position = 'bottom' } = options;

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
  }
}

/**
 * Shorthand toast functions
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => showToast(message, 'success', options),
  error: (message: string, options?: ToastOptions) => showToast(message, 'error', options),
  info: (message: string, options?: ToastOptions) => showToast(message, 'info', options),
  warning: (message: string, options?: ToastOptions) => showToast(message, 'warning', options),
};

export default toast;
