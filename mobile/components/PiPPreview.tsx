/**
 * PiPPreview — a draggable Picture-in-Picture overlay for the local camera stream.
 *
 * Renders the local stream in a small rounded tile that the user can drag
 * anywhere on screen.  Uses React Native's built-in PanResponder + Animated
 * so no extra dependency is required.  The overlay is clamped to the screen
 * boundaries on release so it can never be dragged off-screen.
 */
import React, { useEffect, useRef } from 'react';
import {Animated,
    PanResponder,
    StyleSheet,
    useWindowDimensions,} from 'react-native';
import { createShadowStyle } from '@/utils/shadow';
import StreamView from './StreamView';

const PIP_WIDTH = 120;
const PIP_HEIGHT = 160;

interface PiPPreviewProps {
    /** Local camera MediaStream to render.  Renders nothing when null. */
    readonly stream: MediaStream | null;
    /** Gap from the bottom edge for the initial placement (default: 16 px). */
    readonly initialBottom?: number;
    /** Gap from the right edge for the initial placement (default: 16 px). */
    readonly initialRight?: number;
}

export default function PiPPreview({
    stream,
    initialBottom = 16,
    initialRight = 16,
}: Readonly<PiPPreviewProps>) {
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    // Mirror the latest screen dimensions into refs so the panResponder
    // callbacks (created once) always read up-to-date values.
    const screenWidthRef = useRef(screenWidth);
    const screenHeightRef = useRef(screenHeight);
    screenWidthRef.current = screenWidth;
    screenHeightRef.current = screenHeight;

    // Absolute position of the overlay (top-left corner).
    const initialX = screenWidth - PIP_WIDTH - initialRight;
    const initialY = screenHeight - PIP_HEIGHT - initialBottom;
    const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;

    // Track the current position via a listener so panResponder callbacks
    // don't need to access the private _value property.
    const currentPos = useRef({ x: initialX, y: initialY });
    useEffect(() => {
        currentPos.current = { x: initialX, y: initialY };
        const listenerId = pan.addListener((value) => {
            currentPos.current = value;
        });
        return () => pan.removeListener(listenerId);
    }, [pan, initialX, initialY]);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                // Absorb the accumulated position so each new drag starts
                // exactly from where the overlay currently sits.
                pan.setOffset(currentPos.current);
                pan.setValue({ x: 0, y: 0 });
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
                useNativeDriver: false,
            }),
            onPanResponderRelease: () => {
                pan.flattenOffset();
                // Clamp position so the PiP stays within the visible screen.
                const maxX = screenWidthRef.current - PIP_WIDTH;
                const maxY = screenHeightRef.current - PIP_HEIGHT;
                const clampedX = Math.max(0, Math.min(currentPos.current.x, maxX));
                const clampedY = Math.max(0, Math.min(currentPos.current.y, maxY));
                if (
                    clampedX !== currentPos.current.x ||
                    clampedY !== currentPos.current.y
                ) {
                    Animated.spring(pan, {
                        toValue: { x: clampedX, y: clampedY },
                        useNativeDriver: false,
                    }).start();
                }
            },
        }),
    ).current;

    if (!stream) {
        return null;
    }

    return (
        <Animated.View
            style={[styles.container, { left: pan.x, top: pan.y }]}
            {...panResponder.panHandlers}
        >
            <StreamView
                stream={stream}
                style={styles.video}
                objectFit="cover"
                mirror={true}
            />
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        width: PIP_WIDTH,
        height: PIP_HEIGHT,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.25)',
        // Subtle shadow so the PiP floats above the background content.
        ...createShadowStyle({
            color: '#000',
            offset: { width: 0, height: 4 },
            opacity: 0.4,
            radius: 8,
            elevation: 8,
        }),
    },
    video: {
        flex: 1,
    },
});