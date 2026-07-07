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
}));

// Mock @expo/vector-icons
jest.mock('@expo/vector-icons', () => ({
    Ionicons: 'Ionicons',
}));

// Mock expo-auth-session and related packages
jest.mock('expo-auth-session', () => ({
    makeRedirectUri: jest.fn(() => 'foodstream://oauthredirect'),
}));
jest.mock('expo-auth-session/providers/google', () => ({
    useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
}));
jest.mock('expo-linking', () => ({
    createURL: jest.fn(() => 'foodstream://oauthredirect'),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
}));
jest.mock('expo-constants', () => ({
    default: {
        executionEnvironment: 'storeClient',
    },
    ExecutionEnvironment: {
        StoreClient: 'storeClient',
    },
}));

// Silence console warnings during tests
globalThis.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
};