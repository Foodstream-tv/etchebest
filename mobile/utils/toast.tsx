import { Toast } from 'toastify-react-native';

import preferencesService from '@/services/preferences';

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
  const run = async () => {
    const { position = 'bottom' } = options;

    try {
      const notifications = await preferencesService.getNotificationPreferences();
      const canShowInApp = notifications.global && notifications.channel === 'site';
      if (!canShowInApp) {
        return;
      }
    } catch {
      // In case preference loading fails, keep toasts enabled by default.
    }

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
  };

  void run();
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
