import React from 'react';
import { StyleProp, View, ViewStyle } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';

import BrandBackdrop from '@/components/BrandBackdrop';
import { makeStyles } from '@/contexts/ThemeContext';

type ScreenProps = React.PropsWithChildren<{
    /** Safe-area edges to pad (tab screens: top only, the tab bar handles the bottom) */
    edges?: readonly Edge[];
    /** Hide the decorative orbs (video screens) */
    plain?: boolean;
    style?: StyleProp<ViewStyle>;
    testID?: string;
}>;

/** Themed page container: web page background (#050505 / #f6f2ed) with the brand orbs. */
export default function Screen({ children, edges = ['top'], plain = false, style, testID }: Readonly<ScreenProps>) {
    const styles = useStyles();
    return (
        <View style={styles.root} testID={testID}>
            {plain ? null : <BrandBackdrop compact />}
            <SafeAreaView edges={edges} style={[styles.safe, style]}>
                {children}
            </SafeAreaView>
        </View>
    );
}

const useStyles = makeStyles(({ colors }) => ({
    root: {
        flex: 1,
        backgroundColor: colors.bg,
    },
    safe: {
        flex: 1,
    },
}));
