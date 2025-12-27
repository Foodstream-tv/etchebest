export const preset = 'jest-expo';
export const transformIgnorePatterns = [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|toastify-react-native)',
];
export const setupFilesAfterEnv = ['<rootDir>/jest.setup.js'];
export const testMatch = [
    '**/__tests__/**/*.test.[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
];
export const collectCoverageFrom = [
    'app/**/*.{js,jsx,ts,tsx}',
    'components/**/*.{js,jsx,ts,tsx}',
    '!**/__tests__/**',
    '!**/node_modules/**',
    '!**/*.d.ts',
];
export const moduleNameMapper = {
    '^@/(.*)$': '<rootDir>/$1',
};
