import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    FlatList,
    KeyboardAvoidingView,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    Pressable,
    StyleProp,
    Text,
    TextInput,
    View,
    ViewStyle,
} from 'react-native';

import Button from '@/components/ui/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { makeStyles, useTheme } from '@/contexts/ThemeContext';
import { usePolling } from '@/hooks/usePolling';
import { ChatMessage, getChatMessages, MAX_CHAT_MESSAGE_LENGTH, postChatMessage } from '@/services/streaming';

import { pluralSuffix } from './format';
import { haptics } from '@/utils/haptics';

/** Same cadence as the web chat. */
export const CHAT_POLL_INTERVAL_MS = 5000;
const BOTTOM_THRESHOLD = 48;

type PendingMessage = {
    id: string;
    username: string;
    message: string;
    /** Ids the server already returned when the message was sent: a *new* id with the same text is its echo */
    knownIds: ReadonlySet<string>;
};

type ChatRow = ChatMessage & { pending?: boolean };

type ChatPanelProps = {
    roomId: string;
    signedIn: boolean;
    /** Name shown on the optimistic copy of our own messages */
    username?: string;
    onSignIn: () => void;
    style?: StyleProp<ViewStyle>;
};

/** Removes duplicated ids (keeps the last occurrence, i.e. the freshest copy). */
export function dedupeMessages(messages: readonly ChatMessage[]): ChatMessage[] {
    const byId = new Map<string, ChatMessage>();
    for (const message of messages) byId.set(String(message.id), message);
    return Array.from(byId.values());
}

/** Optimistic messages the server has not echoed yet. */
export function unconfirmedPending(server: readonly ChatMessage[], pending: readonly PendingMessage[]): PendingMessage[] {
    return pending.filter(
        (item) => !server.some((message) => !item.knownIds.has(String(message.id)) && message.message === item.message)
    );
}

export default function ChatPanel({ roomId, signedIn, username, onSignIn, style }: Readonly<ChatPanelProps>) {
    const styles = useStyles();
    const { colors } = useTheme();
    const { t } = useI18n();

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [pending, setPending] = useState<PendingMessage[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [sendFailed, setSendFailed] = useState(false);
    const [hasNew, setHasNew] = useState(false);

    const listRef = useRef<FlatList<ChatRow>>(null);
    const atBottomRef = useRef(true);
    const mountedRef = useRef(true);
    const messagesRef = useRef<ChatMessage[]>([]);
    const counterRef = useRef(0);
    const roomRef = useRef(roomId);
    roomRef.current = roomId;

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    // Another room: start from scratch.
    useEffect(() => {
        messagesRef.current = [];
        setMessages([]);
        setPending([]);
        setText('');
        setSendFailed(false);
        setHasNew(false);
        atBottomRef.current = true;
    }, [roomId]);

    const fetchChat = useCallback(async () => {
        if (!signedIn) return;
        const requestedRoom = roomId;
        try {
            const list = await getChatMessages(requestedRoom);
            if (!mountedRef.current || roomRef.current !== requestedRoom) return;
            const next = dedupeMessages(list);
            messagesRef.current = next;
            setMessages(next);
        } catch {
            // Keep what is displayed; the next poll retries.
        }
    }, [roomId, signedIn]);

    usePolling(fetchChat, CHAT_POLL_INTERVAL_MS, [fetchChat]);

    const rows = useMemo<ChatRow[]>(
        () => [
            ...messages,
            ...unconfirmedPending(messages, pending).map((item) => ({
                id: item.id,
                username: item.username,
                message: item.message,
                pending: true,
            })),
        ],
        [messages, pending]
    );

    const scrollToEnd = useCallback((animated = true) => {
        listRef.current?.scrollToEnd({ animated });
    }, []);

    const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - BOTTOM_THRESHOLD;
        atBottomRef.current = atBottom;
        if (atBottom) setHasNew(false);
    }, []);

    const previousCount = useRef(0);
    const onContentSizeChange = useCallback(() => {
        const grew = rows.length > previousCount.current;
        previousCount.current = rows.length;
        if (atBottomRef.current) {
            scrollToEnd(grew);
        } else if (grew) {
            setHasNew(true);
        }
    }, [rows.length, scrollToEnd]);

    const send = useCallback(async () => {
        const body = text.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
        if (!body || sending || !signedIn) return;

        counterRef.current += 1;
        const pendingId = `local-${counterRef.current}`;
        setPending((list) => [
            ...list,
            { id: pendingId, username: username ?? '', message: body, knownIds: new Set(messagesRef.current.map((m) => String(m.id))) },
        ]);
        setText('');
        setSending(true);
        setSendFailed(false);
        // Our own message always scrolls into view.
        atBottomRef.current = true;
        haptics.tap();

        try {
            await postChatMessage(roomId, body);
            await fetchChat();
        } catch {
            haptics.error();
            if (mountedRef.current) {
                setSendFailed(true);
                setText((current) => current || body);
            }
        } finally {
            if (mountedRef.current) {
                setPending((list) => list.filter((item) => item.id !== pendingId));
                setSending(false);
            }
        }
    }, [text, sending, signedIn, username, roomId, fetchChat]);

    const renderItem = useCallback(
        ({ item }: { item: ChatRow }) => (
            <Text
                style={[styles.message, item.pending && styles.pendingMessage]}
                accessibilityHint={item.pending ? t('live.chat.pending') : undefined}
            >
                <Text style={styles.author}>{item.username}</Text>
                <Text style={styles.separator}> : </Text>
                {item.message}
            </Text>
        ),
        [styles, t]
    );

    const canSend = text.trim().length > 0 && !sending;

    return (
        <KeyboardAvoidingView
            style={[styles.root, style]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            testID="chat-panel"
        >
            <View style={styles.heading}>
                <Text style={styles.headingText}>{t('watch.room.chatHeading')}</Text>
                <Text style={styles.headingText}>
                    {t('watch.room.chatCount', { count: rows.length, plural: pluralSuffix(rows.length) })}
                </Text>
            </View>

            <View style={styles.listWrap}>
                <FlatList
                    ref={listRef}
                    data={rows}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    onScroll={onScroll}
                    scrollEventThrottle={64}
                    onContentSizeChange={onContentSizeChange}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={rows.length === 0 ? styles.emptyContent : styles.listContent}
                    accessibilityLabel={t('live.chat.listAria')}
                    accessibilityLiveRegion="polite"
                    ListEmptyComponent={
                        <View style={styles.empty} testID="chat-empty">
                            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.muted} />
                            <Text style={styles.emptyText}>
                                {signedIn ? t('watch.room.chatNoMessages') : t('watch.room.signInToChat')}
                            </Text>
                        </View>
                    }
                />
                {hasNew ? (
                    <Pressable
                        style={styles.newPill}
                        onPress={() => {
                            atBottomRef.current = true;
                            setHasNew(false);
                            scrollToEnd();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={t('live.chat.newMessages')}
                        testID="chat-new-messages"
                    >
                        <Ionicons name="arrow-down" size={14} color={colors.onBrand} />
                        <Text style={styles.newPillText}>{t('live.chat.newMessages')}</Text>
                    </Pressable>
                ) : null}
            </View>

            {signedIn ? (
                <View style={styles.composer}>
                    {sendFailed ? (
                        <Text style={styles.error} accessibilityRole="alert" testID="chat-send-error">
                            {t('live.chat.sendError')}
                        </Text>
                    ) : null}
                    <TextInput
                        value={text}
                        onChangeText={(value) => setText(value.slice(0, MAX_CHAT_MESSAGE_LENGTH))}
                        onSubmitEditing={send}
                        placeholder={t('watch.room.chatPlaceholderShort')}
                        placeholderTextColor={colors.placeholder}
                        accessibilityLabel={t('watch.room.chatInputAria')}
                        maxLength={MAX_CHAT_MESSAGE_LENGTH}
                        returnKeyType="send"
                        blurOnSubmit={false}
                        style={styles.input}
                        testID="chat-input"
                    />
                    <View style={styles.composerFooter}>
                        <Text style={styles.counter} testID="chat-counter">
                            {t('live.chat.charCount', { count: text.length, max: MAX_CHAT_MESSAGE_LENGTH })}
                        </Text>
                        <Button
                            label={sending ? t('watch.room.chatSending') : t('watch.room.chatSend')}
                            accessibilityLabel={t('watch.room.chatSend')}
                            size="sm"
                            disabled={!canSend}
                            loading={sending}
                            onPress={send}
                            testID="chat-send"
                        />
                    </View>
                </View>
            ) : (
                <View style={styles.signIn}>
                    <Button label={t('watch.room.chatSignIn')} variant="ghost" size="sm" onPress={onSignIn} testID="chat-sign-in" />
                </View>
            )}
        </KeyboardAvoidingView>
    );
}

const useStyles = makeStyles(({ colors, radii }) => ({
    root: {
        flex: 1,
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radii.card,
        overflow: 'hidden',
    },
    heading: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    headingText: {
        color: colors.muted,
        fontSize: 12,
    },
    listWrap: {
        flex: 1,
    },
    listContent: {
        padding: 16,
        gap: 10,
    },
    emptyContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 16,
    },
    empty: {
        alignItems: 'center',
        gap: 8,
    },
    emptyText: {
        color: colors.muted,
        fontSize: 14,
        textAlign: 'center',
    },
    message: {
        color: colors.muted,
        fontSize: 14,
        lineHeight: 21,
    },
    pendingMessage: {
        opacity: 0.55,
    },
    author: {
        color: colors.text,
        fontWeight: '700',
    },
    separator: {
        color: colors.placeholder,
    },
    newPill: {
        position: 'absolute',
        alignSelf: 'center',
        bottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 36,
        paddingHorizontal: 14,
        borderRadius: radii.pill,
        backgroundColor: colors.orange,
    },
    newPillText: {
        color: colors.onBrand,
        fontSize: 13,
        fontWeight: '700',
    },
    composer: {
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    input: {
        minHeight: 48,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        color: colors.text,
        paddingHorizontal: 14,
        fontSize: 15,
    },
    composerFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    counter: {
        color: colors.placeholder,
        fontSize: 12,
    },
    error: {
        color: colors.danger,
        fontSize: 13,
        fontWeight: '600',
    },
    signIn: {
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        alignItems: 'center',
    },
}));
