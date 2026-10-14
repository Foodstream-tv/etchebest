import React from 'react';
import { FlatList } from 'react-native';

import ChatPanel, { CHAT_POLL_INTERVAL_MS, dedupeMessages, unconfirmedPending } from '../ChatPanel';
import { act, fireEvent, renderWithProviders, screen } from '@/test-utils/render';
import { getChatMessages, postChatMessage } from '@/services/streaming';

jest.mock('@/services/streaming', () => ({
    MAX_CHAT_MESSAGE_LENGTH: 500,
    getChatMessages: jest.fn(),
    postChatMessage: jest.fn(),
}));

const mockedGet = getChatMessages as jest.Mock;
const mockedPost = postChatMessage as jest.Mock;
const onSignIn = jest.fn();

const msg = (id: string, message: string, username = 'bob') => ({ id, username, message });

async function renderChat(props: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
    const utils = renderWithProviders(<ChatPanel roomId="room-1" signedIn username="alice" onSignIn={onSignIn} {...props} />);
    await act(async () => {});
    return utils;
}

const send = async (text: string) => {
    fireEvent.changeText(screen.getByTestId('chat-input'), text);
    await act(async () => {
        fireEvent.press(screen.getByTestId('chat-send'));
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    mockedGet.mockResolvedValue([]);
    mockedPost.mockResolvedValue(undefined);
});

describe('chat helpers', () => {
    it('dedupes messages by id, keeping the freshest copy and the order of first appearance', () => {
        const result = dedupeMessages([msg('1', 'a'), msg('2', 'b'), msg('1', 'a edited')]);
        expect(result).toEqual([msg('1', 'a edited'), msg('2', 'b')]);
    });

    it('treats a new server message with the same text as the echo of a pending one', () => {
        const pending = [{ id: 'local-1', username: 'alice', message: 'hi', knownIds: new Set(['1']) }];
        expect(unconfirmedPending([msg('1', 'hi')], pending)).toHaveLength(1);
        expect(unconfirmedPending([msg('1', 'hi'), msg('2', 'hi')], pending)).toHaveLength(0);
    });
});

describe('ChatPanel', () => {
    it('shows the empty state and the message count', async () => {
        await renderChat();
        expect(screen.getByText('Aucun message pour l’instant.')).toBeTruthy();
        expect(screen.getByText('0 message')).toBeTruthy();
    });

    it('renders the messages once even if the server repeats an id', async () => {
        mockedGet.mockResolvedValue([msg('1', 'Bonjour'), msg('2', 'Salut'), msg('1', 'Bonjour')]);
        await renderChat();
        expect(screen.getAllByText(/Bonjour/)).toHaveLength(1);
        expect(screen.getAllByText(/Salut/)).toHaveLength(1);
        expect(screen.getByText('2 messages')).toBeTruthy();
    });

    it('does not fetch nor show the composer when signed out', async () => {
        await renderChat({ signedIn: false });
        expect(mockedGet).not.toHaveBeenCalled();
        expect(screen.getByText('Connectez-vous pour participer au chat.')).toBeTruthy();
        expect(screen.queryByTestId('chat-input')).toBeNull();
        fireEvent.press(screen.getByTestId('chat-sign-in'));
        expect(onSignIn).toHaveBeenCalledTimes(1);
    });

    it('disables send while the input is empty', async () => {
        await renderChat();
        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        fireEvent.changeText(screen.getByTestId('chat-input'), '    ');
        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        expect(mockedPost).not.toHaveBeenCalled();
    });

    it('shows the message right away, then keeps a single copy once the server echoes it', async () => {
        let resolvePost!: () => void;
        mockedPost.mockReturnValue(new Promise<void>((r) => (resolvePost = r)));
        await renderChat();
        await send('  Bonjour  ');

        // optimistic copy, input already cleared, send disabled while in flight
        expect(screen.getAllByText(/Bonjour/)).toHaveLength(1);
        expect(screen.getByTestId('chat-input').props.value).toBe('');
        fireEvent.changeText(screen.getByTestId('chat-input'), 'second');
        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        expect(mockedPost).toHaveBeenCalledTimes(1);
        expect(mockedPost).toHaveBeenCalledWith('room-1', 'Bonjour');

        mockedGet.mockResolvedValue([msg('10', 'Bonjour', 'alice')]);
        await act(async () => resolvePost());
        expect(screen.getAllByText(/Bonjour/)).toHaveLength(1);
        expect(screen.getByText('1 message')).toBeTruthy();
    });

    it('does not duplicate the message when a poll returns the echo before the post resolves', async () => {
        jest.useFakeTimers();
        try {
            let resolvePost!: () => void;
            mockedPost.mockReturnValue(new Promise<void>((r) => (resolvePost = r)));
            await renderChat();
            await send('Hello');

            mockedGet.mockResolvedValue([msg('10', 'Hello', 'alice')]);
            await act(async () => {
                jest.advanceTimersByTime(CHAT_POLL_INTERVAL_MS);
            });
            expect(screen.getAllByText(/Hello/)).toHaveLength(1);
            await act(async () => resolvePost());
            expect(screen.getAllByText(/Hello/)).toHaveLength(1);
        } finally {
            jest.useRealTimers();
        }
    });

    it('removes the optimistic copy, restores the text and alerts when the post fails', async () => {
        mockedPost.mockRejectedValueOnce(new Error('nope'));
        await renderChat();
        await send('Perdu ?');
        expect(screen.queryAllByText(/Perdu/)).toHaveLength(0);
        expect(screen.getByTestId('chat-send-error')).toBeTruthy();
        expect(screen.getByTestId('chat-input').props.value).toBe('Perdu ?');

        // retry works and clears the error
        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        expect(mockedPost).toHaveBeenCalledTimes(2);
        expect(screen.queryByTestId('chat-send-error')).toBeNull();
    });

    it('does not overwrite what the user typed meanwhile when a send fails', async () => {
        let rejectPost!: (e: Error) => void;
        mockedPost.mockReturnValue(new Promise<void>((_, reject) => (rejectPost = reject)));
        await renderChat();
        await send('first');
        fireEvent.changeText(screen.getByTestId('chat-input'), 'typing now');
        await act(async () => rejectPost(new Error('x')));
        expect(screen.getByTestId('chat-input').props.value).toBe('typing now');
    });

    it('limits the message to 500 characters and shows the counter', async () => {
        await renderChat();
        const input = screen.getByTestId('chat-input');
        expect(input.props.maxLength).toBe(500);
        fireEvent.changeText(input, 'x'.repeat(650));
        expect(screen.getByTestId('chat-input').props.value).toHaveLength(500);
        expect(screen.getByText('500/500')).toBeTruthy();

        await act(async () => {
            fireEvent.press(screen.getByTestId('chat-send'));
        });
        expect(mockedPost.mock.calls[0][1]).toHaveLength(500);
    });

    it('sends with the keyboard submit key', async () => {
        await renderChat();
        fireEvent.changeText(screen.getByTestId('chat-input'), 'enter');
        await act(async () => {
            fireEvent(screen.getByTestId('chat-input'), 'submitEditing');
        });
        expect(mockedPost).toHaveBeenCalledWith('room-1', 'enter');
    });

    it('polls every 5 s and stops on unmount', async () => {
        jest.useFakeTimers();
        try {
            const { unmount } = await renderChat();
            expect(mockedGet).toHaveBeenCalledTimes(1);
            await act(async () => {
                jest.advanceTimersByTime(CHAT_POLL_INTERVAL_MS * 2);
            });
            expect(mockedGet).toHaveBeenCalledTimes(3);
            unmount();
            await act(async () => {
                jest.advanceTimersByTime(CHAT_POLL_INTERVAL_MS * 10);
            });
            expect(mockedGet).toHaveBeenCalledTimes(3);
        } finally {
            jest.useRealTimers();
        }
    });

    it('keeps the displayed messages when a poll fails', async () => {
        jest.useFakeTimers();
        try {
            mockedGet.mockResolvedValue([msg('1', 'Toujours là')]);
            await renderChat();
            mockedGet.mockRejectedValue(new Error('offline'));
            await act(async () => {
                jest.advanceTimersByTime(CHAT_POLL_INTERVAL_MS);
            });
            expect(screen.getAllByText(/Toujours là/)).toHaveLength(1);
        } finally {
            jest.useRealTimers();
        }
    });

    describe('auto-scroll', () => {
        const scrollEvent = (offset: number) => ({
            nativeEvent: { contentOffset: { y: offset }, contentSize: { height: 1000 }, layoutMeasurement: { height: 300 } },
        });

        it('follows new messages only while the user is at the bottom', async () => {
            jest.useFakeTimers();
            const scrollToEnd = jest.spyOn(FlatList.prototype, 'scrollToEnd').mockImplementation(() => {});
            try {
                mockedGet.mockResolvedValue([msg('1', 'one')]);
                await renderChat();
                const list = screen.getByLabelText('Messages du chat');

                // at the bottom: a new message scrolls
                fireEvent.scroll(list, scrollEvent(700));
                mockedGet.mockResolvedValue([msg('1', 'one'), msg('2', 'two')]);
                await act(async () => {
                    jest.advanceTimersByTime(CHAT_POLL_INTERVAL_MS);
                });
                scrollToEnd.mockClear();
                fireEvent(screen.getByLabelText('Messages du chat'), 'contentSizeChange', 300, 1100);
                expect(scrollToEnd).toHaveBeenCalled();
                expect(screen.queryByTestId('chat-new-messages')).toBeNull();

                // scrolled up: no scroll, a pill appears instead
                fireEvent.scroll(screen.getByLabelText('Messages du chat'), scrollEvent(0));
                mockedGet.mockResolvedValue([msg('1', 'one'), msg('2', 'two'), msg('3', 'three')]);
                await act(async () => {
                    jest.advanceTimersByTime(CHAT_POLL_INTERVAL_MS);
                });
                scrollToEnd.mockClear();
                fireEvent(screen.getByLabelText('Messages du chat'), 'contentSizeChange', 300, 1200);
                expect(scrollToEnd).not.toHaveBeenCalled();
                expect(screen.getByTestId('chat-new-messages')).toBeTruthy();

                // tapping the pill scrolls down and hides it
                fireEvent.press(screen.getByTestId('chat-new-messages'));
                expect(scrollToEnd).toHaveBeenCalled();
                expect(screen.queryByTestId('chat-new-messages')).toBeNull();
            } finally {
                scrollToEnd.mockRestore();
                jest.useRealTimers();
            }
        });
    });
});
