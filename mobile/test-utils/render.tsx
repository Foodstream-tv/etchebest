import { render, RenderOptions } from '@testing-library/react-native';
import React from 'react';

import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <ThemeProvider>
            <LanguageProvider>{children}</LanguageProvider>
        </ThemeProvider>
    );
}

/** `render` wrapped with the app providers (theme + language). */
export function renderWithProviders(ui: React.ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
    return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react-native';
