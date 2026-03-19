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

// Silence console warnings during tests
globalThis.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};