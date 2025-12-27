// Mock expo-router
jest.mock('expo-router', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn(),
    }),
    Stack: {
        Screen: 'Screen',
    },
}));// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock toastify-react-native
jest.mock('toastify-react-native', () => ({
    __esModule: true,
    default: () => null,
    Toast: {
        show: jest.fn(),
    },
}));

// Silence console warnings during tests
global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};