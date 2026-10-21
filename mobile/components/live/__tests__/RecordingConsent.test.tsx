import React from 'react';

import RecordingConsentModal from '../RecordingConsentModal';
import ReplayRemovalCard from '../ReplayRemovalCard';
import { ApiError } from '@/services/http';
import { removeReplay } from '@/services/lives';
import { act, fireEvent, renderWithProviders, screen } from '@/test-utils/render';
import { confirmAction } from '@/utils/confirm';

jest.mock('@/services/lives', () => ({ removeReplay: jest.fn() }));
jest.mock('@/utils/confirm', () => ({ confirmAction: jest.fn() }));

const mockedRemove = removeReplay as jest.Mock;
const mockedConfirm = confirmAction as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
});

describe('RecordingConsentModal', () => {
    it('cannot be accepted until the box is ticked, and starts unticked every time', () => {
        const onAccept = jest.fn();
        const onCancel = jest.fn();
        const { rerender } = renderWithProviders(<RecordingConsentModal visible onAccept={onAccept} onCancel={onCancel} />);

        // Unticked: the button is disabled (fireEvent would climb to the Button's own onPress prop, a test
        // artefact: a real touch on a disabled Pressable does nothing).
        expect(screen.getByTestId('recording-consent-accept').props.accessibilityState.disabled).toBe(true);

        fireEvent.press(screen.getByTestId('recording-consent-checkbox'));
        expect(screen.getByTestId('recording-consent-checkbox').props.accessibilityState.checked).toBe(true);
        expect(screen.getByTestId('recording-consent-accept').props.accessibilityState.disabled).toBe(false);
        fireEvent.press(screen.getByTestId('recording-consent-accept'));
        expect(onAccept).toHaveBeenCalledTimes(1);

        // closed then reopened: asked again from scratch
        rerender(<RecordingConsentModal visible={false} onAccept={onAccept} onCancel={onCancel} />);
        rerender(<RecordingConsentModal visible onAccept={onAccept} onCancel={onCancel} />);
        expect(screen.getByTestId('recording-consent-checkbox').props.accessibilityState.checked).toBe(false);
    });

    it('lets the person decline', () => {
        const onCancel = jest.fn();
        renderWithProviders(<RecordingConsentModal visible onAccept={jest.fn()} onCancel={onCancel} />);
        fireEvent.press(screen.getByTestId('recording-consent-cancel'));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});

describe('ReplayRemovalCard', () => {
    const confirmNow = () => mockedConfirm.mock.calls[0][0].onConfirm();

    it('asks before removing, then removes and tells the screen', async () => {
        mockedRemove.mockResolvedValue(undefined);
        const onRemoved = jest.fn();
        renderWithProviders(<ReplayRemovalCard roomId="room-1" onRemoved={onRemoved} />);

        fireEvent.press(screen.getByTestId('replay-removal-button'));
        expect(mockedRemove).not.toHaveBeenCalled(); // nothing before the confirmation
        expect(mockedConfirm.mock.calls[0][0].destructive).toBe(true);

        await act(async () => {
            confirmNow();
        });
        expect(mockedRemove).toHaveBeenCalledWith('room-1');
        expect(onRemoved).toHaveBeenCalledTimes(1);
    });

    it('explains a refusal to someone who did not take part', async () => {
        mockedRemove.mockRejectedValue(new ApiError('forbidden', 403, {}));
        const onRemoved = jest.fn();
        renderWithProviders(<ReplayRemovalCard roomId="room-1" onRemoved={onRemoved} />);

        fireEvent.press(screen.getByTestId('replay-removal-button'));
        await act(async () => {
            confirmNow();
        });
        expect(onRemoved).not.toHaveBeenCalled();
        expect(screen.getByText(/Seuls l'hôte|Only the host/)).toBeTruthy();
    });
});
