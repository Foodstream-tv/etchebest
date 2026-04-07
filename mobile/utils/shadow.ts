import { Platform } from 'react-native';

type ShadowConfig = {
  color: string;
  offset: { width: number; height: number };
  opacity: number;
  radius: number;
  elevation?: number;
};

const hexToRgba = (color: string, opacity: number): string => {
  const normalized = color.trim();
  if (!normalized.startsWith('#')) {
    return normalized;
  }

  let hex = normalized.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map((char) => char + char).join('');
  }

  if (hex.length === 6) {
    hex = `${hex}ff`;
  }

  if (hex.length !== 8) {
    return `rgba(0, 0, 0, ${opacity})`;
  }

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  const alpha = parseInt(hex.slice(6, 8), 16) / 255;
  const finalAlpha = Math.min(1, Math.max(0, alpha * opacity));
  return `rgba(${red}, ${green}, ${blue}, ${finalAlpha.toFixed(3)})`;
};

export const createShadowStyle = ({
  color,
  offset,
  opacity,
  radius,
  elevation,
}: ShadowConfig): { [key: string]: any } => {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${offset.width}px ${offset.height}px ${radius}px ${hexToRgba(color, opacity)}`,
    };
  }

  return {
    shadowColor: color,
    shadowOffset: offset,
    shadowOpacity: opacity,
    shadowRadius: radius,
    ...(elevation !== undefined ? { elevation } : {}),
  };
};
