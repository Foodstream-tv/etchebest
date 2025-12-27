import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Toast } from 'toastify-react-native';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  duration?: number;
}

const icons: Record<ToastType, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  success: { name: 'checkmark-circle', color: 'green' },
  error: { name: 'close-circle', color: 'red' },
  info: { name: 'information-circle', color: '#4285F4' },
  warning: { name: 'warning', color: '#FFA500' },
};

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: ToastType = 'info',
  options: ToastOptions = {}
): void {
  const { duration = 2500 } = options;
  const icon = icons[type];

  Toast.show({
    text1: message,
    position: 'bottom',
    icon: <Ionicons name={icon.name} size={24} color={icon.color} />,
    iconColor: icon.color,
    progressBarColor: type === 'error' ? 'red' : undefined,
    visibilityTime: duration,
  });
}

/**
 * Shorthand toast functions
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => showToast(message, 'success', options),
  error: (message: string, options?: ToastOptions) => showToast(message, 'error', { duration: 3000, ...options }),
  info: (message: string, options?: ToastOptions) => showToast(message, 'info', options),
  warning: (message: string, options?: ToastOptions) => showToast(message, 'warning', options),
};

export default toast;
