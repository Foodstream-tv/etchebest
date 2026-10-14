import React, { useState } from 'react';
import { TextInputProps } from 'react-native';

import FloatingLabelInput from '@/components/FloatingLabelInput';

type FieldProps = Omit<TextInputProps, 'onFocus' | 'onBlur'> & {
    label: string;
    iconName: React.ComponentProps<typeof FloatingLabelInput>['iconName'];
    error?: string | null;
};

/** FloatingLabelInput that tracks its own focus ring. */
export default function Field({ label, iconName, error, ...rest }: Readonly<FieldProps>) {
    const [focused, setFocused] = useState(false);
    return (
        <FloatingLabelInput
            label={label}
            iconName={iconName}
            error={error}
            focused={focused}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            {...rest}
        />
    );
}
