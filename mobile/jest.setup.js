// Mock expo-router (tests needing to assert navigation override this with their own jest.mock)
jest.mock('expo-router', () => {
    const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
    const mockNavigation = { addListener: jest.fn(() => jest.fn()), setOptions: jest.fn(), dispatch: jest.fn() };
    return {
        __mockRouter: mockRouter,
        __mockNavigation: mockNavigation,
        useNavigation: () => mockNavigation,
        useRouter: () => mockRouter,
        useLocalSearchParams: jest.fn(() => ({})),
        // Runs the effect once on mount, like a focused screen.
        useFocusEffect: (effect) => {
            const React = require('react');
            React.useEffect(() => effect(), [effect]);
        },
        Redirect: 'Redirect',
        Link: 'Link',
        Stack: { Screen: 'Screen' },
        Tabs: { Screen: 'Screen' },
    };
});

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
// Native modules of the Studio: the pickers are host-component stubs (tests fire their `onChange`).
jest.mock('expo-image-picker', () => ({
    launchImageLibraryAsync: jest.fn(),
}));
jest.mock('@react-native-community/datetimepicker', () => ({
    __esModule: true,
    default: 'DateTimePicker',
    DateTimePickerAndroid: { open: jest.fn() },
}));

// The recipe assistant keeps the screen on while it is open.
jest.mock('expo-keep-awake', () => ({
    useKeepAwake: jest.fn(),
    activateKeepAwakeAsync: jest.fn(),
    deactivateKeepAwake: jest.fn(),
}));
