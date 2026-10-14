import { act, renderHook } from '@testing-library/react-native';

import { classifyError, DISCONNECT_GRACE_MS, isUdpCandidate, useWebRTC } from '../useWebRTC';
import * as streaming from '@/services/streaming';

// ---- Fakes -------------------------------------------------------------------------------

class MockTrack {
    enabled = true;
    stop = jest.fn();
    constructor(public kind: 'audio' | 'video') {}
}

let streamSeq = 0;
class MockStream {
    id = `stream-${++streamSeq}`;
    tracks = [new MockTrack('audio'), new MockTrack('video')];
    getTracks = () => this.tracks;
    getAudioTracks = () => this.tracks.filter((t) => t.kind === 'audio');
    getVideoTracks = () => this.tracks.filter((t) => t.kind === 'video');
    toURL = () => `url-${this.id}`;
}

class MockPC {
    static instances: MockPC[] = [];
    connectionState = 'new';
    localDescription: { sdp: string } | null = null;
    addTrack = jest.fn();
    close = jest.fn();
    onicecandidate: ((e: unknown) => void) | null = null;
    ontrack: ((e: unknown) => void) | null = null;
    onconnectionstatechange: (() => void) | null = null;
    createOffer = jest.fn(async () => ({ type: 'offer', sdp: 'v=0 offer' }));
    createAnswer = jest.fn(async () => ({ type: 'answer', sdp: 'v=0 answer' }));
    setLocalDescription = jest.fn(async (desc: { sdp: string }) => {
        this.localDescription = desc;
    });
    setRemoteDescription = jest.fn(async () => undefined);
    constructor() {
        MockPC.instances.push(this);
    }
    emitCandidate(candidate: string) {
        this.onicecandidate?.({ candidate: { candidate, sdpMLineIndex: 0, sdpMid: '0' } });
    }
    setState(next: string) {
        this.connectionState = next;
        this.onconnectionstatechange?.();
    }
}

class MockSessionDescription {
    constructor(init: object) {
        Object.assign(this, init);
    }
}

const mockEnv: { isNative: boolean; getUserMedia: jest.Mock } = {
    isNative: true,
    getUserMedia: jest.fn(),
};

jest.mock('@/utils/webrtc', () => ({
    get isNativeWebRTC() {
        return mockEnv.isNative;
    },
    get RTCPeerConnection() {
        return MockPC;
    },
    get RTCSessionDescription() {
        return MockSessionDescription;
    },
    get MediaStream() {
        return MockStream;
    },
    get mediaDevices() {
        return { getUserMedia: mockEnv.getUserMedia };
    },
}));

jest.mock('@/services/streaming', () => ({
    createRoom: jest.fn(),
    reserveRoom: jest.fn(),
    disconnectRoom: jest.fn(),
    sendOffer: jest.fn(),
    sendICECandidate: jest.fn(),
    fetchRenegotiationOffer: jest.fn(),
    sendRenegotiationAnswer: jest.fn(),
}));

const api = streaming as jest.Mocked<typeof streaming>;

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
}

let lastStream: MockStream;

beforeEach(() => {
    jest.clearAllMocks();
    MockPC.instances = [];
    mockEnv.isNative = true;
    mockEnv.getUserMedia.mockImplementation(async () => {
        lastStream = new MockStream();
        return lastStream;
    });
    api.createRoom.mockResolvedValue({ roomId: 'room-1' });
    api.reserveRoom.mockResolvedValue({ message: 'ok', reserved: true, registeredCount: 1, maxParticipants: 5 });
    api.disconnectRoom.mockResolvedValue(undefined);
    api.sendOffer.mockResolvedValue({ sdp: 'v=0 answer-from-server' });
    api.sendICECandidate.mockResolvedValue(undefined);
    api.fetchRenegotiationOffer.mockResolvedValue(null);
    api.sendRenegotiationAnswer.mockResolvedValue(undefined);
});

afterEach(() => {
    jest.useRealTimers();
});

const pc = () => MockPC.instances[MockPC.instances.length - 1];

async function startHost(result: { current: ReturnType<typeof useWebRTC> }, title = 'Pasta maison') {
    await act(async () => {
        await result.current.startLive(title, { title });
    });
}

describe('useWebRTC - host', () => {
    it('creates the room with the given title/metadata, negotiates and goes live', async () => {
        const { result } = renderHook(() => useWebRTC());
        await act(async () => {
            await result.current.startLive('Pasta maison', { title: 'Pasta maison', tags: ['Italien'] });
        });

        expect(api.createRoom).toHaveBeenCalledWith('Pasta maison', { title: 'Pasta maison', tags: ['Italien'] });
        expect(api.sendOffer).toHaveBeenCalledWith('room-1', expect.stringContaining('offer'));
        expect(pc().setRemoteDescription).toHaveBeenCalledTimes(1);
        expect(result.current.roomId).toBe('room-1');
        expect(result.current.localStream).toBe(lastStream);
        expect(result.current.state).toBe('connecting');

        act(() => pc().setState('connected'));
        expect(result.current.state).toBe('live');
    });

    it('ignores a second start while one is running (double tap)', async () => {
        const gate = deferred<{ roomId: string }>();
        api.createRoom.mockReturnValueOnce(gate.promise);
        const { result } = renderHook(() => useWebRTC());

        let first!: Promise<void>;
        act(() => {
            first = result.current.startLive('A');
            void result.current.startLive('A');
        });
        expect(result.current.state).toBe('creating');

        await act(async () => {
            gate.resolve({ roomId: 'room-1' });
            await first;
        });
        expect(api.createRoom).toHaveBeenCalledTimes(1);
    });

    it('reports the Expo Go error without touching the backend', async () => {
        mockEnv.isNative = false;
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        expect(result.current.state).toBe('error');
        expect(result.current.errorCode).toBe('unsupported');
        expect(api.createRoom).not.toHaveBeenCalled();
        expect(api.disconnectRoom).not.toHaveBeenCalled();
        expect(mockEnv.getUserMedia).not.toHaveBeenCalled();
    });

    it('does not create a room when createRoom itself fails, and maps a 409 to "conflict"', async () => {
        api.createRoom.mockRejectedValueOnce(Object.assign(new Error('already live'), { status: 409 }));
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        expect(result.current.state).toBe('error');
        expect(result.current.errorCode).toBe('conflict');
        expect(api.disconnectRoom).not.toHaveBeenCalled();

        // and the user can retry right away
        api.createRoom.mockResolvedValueOnce({ roomId: 'room-2' });
        await startHost(result);
        expect(api.createRoom).toHaveBeenCalledTimes(2);
        expect(result.current.roomId).toBe('room-2');
        expect(result.current.error).toBeNull();
    });

    it('disconnects the orphan room when the camera permission is denied', async () => {
        mockEnv.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
        expect(api.disconnectRoom).toHaveBeenCalledWith('room-1');
        expect(result.current.state).toBe('error');
        expect(result.current.errorCode).toBe('permission');
        expect(result.current.roomId).toBeNull();
        expect(MockPC.instances).toHaveLength(0);
    });

    it('stops tracks, closes the PC and disconnects the room when negotiation fails', async () => {
        api.sendOffer.mockRejectedValueOnce(new Error('boom'));
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        expect(result.current.state).toBe('error');
        expect(result.current.error).toBe('boom');
        expect(lastStream.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
        expect(pc().close).toHaveBeenCalledTimes(1);
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
        expect(result.current.localStream).toBeNull();
    });

    it('stopLive is idempotent: tracks stopped, PC closed, backend notified once', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        await act(async () => {
            await Promise.all([result.current.stopLive(), result.current.stopLive()]);
        });
        await act(async () => {
            await result.current.stopLive();
        });

        expect(lastStream.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
        expect(pc().close).toHaveBeenCalledTimes(1);
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
        expect(result.current.state).toBe('idle');
        expect(result.current.localStream).toBeNull();
        expect(result.current.roomId).toBeNull();
    });

    it('stopLive followed by unmount does not disconnect twice', async () => {
        const { result, unmount } = renderHook(() => useWebRTC());
        await startHost(result);
        await act(async () => {
            await result.current.stopLive();
        });
        unmount();
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
    });

    it('releases camera, mic, polling and backend room on unmount (back gesture)', async () => {
        jest.useFakeTimers();
        const { result, unmount } = renderHook(() => useWebRTC());
        await startHost(result);
        const stream = lastStream;
        const connection = pc();
        const pollsBefore = api.fetchRenegotiationOffer.mock.calls.length;

        unmount();

        expect(stream.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
        expect(connection.close).toHaveBeenCalledTimes(1);
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
        expect(api.disconnectRoom).toHaveBeenCalledWith('room-1');

        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });
        expect(api.fetchRenegotiationOffer.mock.calls.length).toBe(pollsBefore);
    });

    it('does not disconnect on unmount when nothing was started', () => {
        const { unmount } = renderHook(() => useWebRTC());
        unmount();
        expect(api.disconnectRoom).not.toHaveBeenCalled();
    });

    it('disconnects a room created after the user already stopped (in-flight createRoom)', async () => {
        const gate = deferred<{ roomId: string }>();
        api.createRoom.mockReturnValueOnce(gate.promise);
        const { result } = renderHook(() => useWebRTC());

        let start!: Promise<void>;
        act(() => {
            start = result.current.startLive('Late');
        });
        await act(async () => {
            await result.current.stopLive();
        });
        await act(async () => {
            gate.resolve({ roomId: 'orphan' });
            await start;
        });

        expect(api.disconnectRoom).toHaveBeenCalledWith('orphan');
        expect(mockEnv.getUserMedia).not.toHaveBeenCalled();
        expect(result.current.state).toBe('idle');
    });

    it('stops the camera that opens after the screen was left (in-flight getUserMedia)', async () => {
        const gate = deferred<MockStream>();
        mockEnv.getUserMedia.mockReturnValueOnce(gate.promise);
        const { result, unmount } = renderHook(() => useWebRTC());

        let start!: Promise<void>;
        act(() => {
            start = result.current.startLive('Late camera');
        });
        await act(async () => {
            await Promise.resolve();
        });
        unmount();

        const lateStream = new MockStream();
        await act(async () => {
            gate.resolve(lateStream);
            await start;
        });

        expect(lateStream.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
        expect(MockPC.instances).toHaveLength(0);
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
    });
});

describe('useWebRTC - ICE candidates', () => {
    it('queues candidates until the offer is posted, then flushes them in order', async () => {
        const offer = deferred<{ sdp: string }>();
        api.sendOffer.mockReturnValueOnce(offer.promise);
        const { result } = renderHook(() => useWebRTC());

        let start!: Promise<void>;
        act(() => {
            start = result.current.startLive('Queue');
        });
        await act(async () => {
            await Promise.resolve();
            await Promise.resolve();
        });
        await waitForPc();

        pc().emitCandidate('candidate:cand-1 1 udp 1 10.0.0.1 5000 typ host');
        pc().emitCandidate('candidate:cand-2 1 udp 1 10.0.0.1 5000 typ host');
        expect(api.sendICECandidate).not.toHaveBeenCalled();

        await act(async () => {
            offer.resolve({ sdp: 'answer' });
            await start;
        });

        const sent = api.sendICECandidate.mock.calls.map(([, c]) => c.candidate);
        expect(sent).toEqual(['candidate:cand-1 1 udp 1 10.0.0.1 5000 typ host', 'candidate:cand-2 1 udp 1 10.0.0.1 5000 typ host']);
        expect(api.sendICECandidate.mock.calls[0][0]).toBe('room-1');

        await act(async () => {
            pc().emitCandidate('candidate:cand-3 1 udp 1 10.0.0.1 5000 typ host');
        });
        expect(api.sendICECandidate.mock.calls.map(([, c]) => c.candidate)).toEqual(['candidate:cand-1 1 udp 1 10.0.0.1 5000 typ host', 'candidate:cand-2 1 udp 1 10.0.0.1 5000 typ host', 'candidate:cand-3 1 udp 1 10.0.0.1 5000 typ host']);
    });

    it('does not send TCP candidates (the media server is UDP only)', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        await act(async () => {
            pc().emitCandidate('candidate:9 1 tcp 1518280447 10.0.0.1 9 typ host tcptype active');
            pc().emitCandidate('candidate:1 1 udp 2122260223 10.0.0.1 5000 typ host');
        });

        expect(api.sendICECandidate.mock.calls.map(([, c]) => c.candidate)).toEqual(['candidate:1 1 udp 2122260223 10.0.0.1 5000 typ host']);
    });

    it('keeps sending after a failed candidate and ignores the end-of-candidates event', async () => {
        api.sendICECandidate.mockRejectedValueOnce(new Error('rejected'));
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        await act(async () => {
            pc().emitCandidate('candidate:a 1 udp 1 10.0.0.1 5000 typ host');
            pc().emitCandidate('candidate:b 1 udp 1 10.0.0.1 5000 typ host');
            pc().onicecandidate?.({ candidate: null });
        });

        expect(api.sendICECandidate.mock.calls.map(([, c]) => c.candidate)).toEqual(['candidate:a 1 udp 1 10.0.0.1 5000 typ host', 'candidate:b 1 udp 1 10.0.0.1 5000 typ host']);
        expect(result.current.state).toBe('connecting');
    });

    it('drops queued candidates when stopped before the offer was posted', async () => {
        const offer = deferred<{ sdp: string }>();
        api.sendOffer.mockReturnValueOnce(offer.promise);
        const { result } = renderHook(() => useWebRTC());

        let start!: Promise<void>;
        act(() => {
            start = result.current.startLive('Drop');
        });
        await waitForPc();
        pc().emitCandidate('late');

        await act(async () => {
            await result.current.stopLive();
        });
        await act(async () => {
            offer.resolve({ sdp: 'answer' });
            await start;
        });

        expect(api.sendICECandidate).not.toHaveBeenCalled();
    });
});

async function waitForPc() {
    for (let i = 0; i < 20 && MockPC.instances.length === 0; i += 1) {
        await act(async () => {
            await Promise.resolve();
        });
    }
    // the offer is created asynchronously after the PC
    await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe('useWebRTC - connection lifecycle', () => {
    it('treats "disconnected" as transient and recovers', async () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        act(() => pc().setState('connected'));
        expect(result.current.state).toBe('live');

        act(() => pc().setState('disconnected'));
        expect(result.current.state).toBe('connecting');

        act(() => {
            jest.advanceTimersByTime(DISCONNECT_GRACE_MS / 2);
        });
        act(() => pc().setState('connected'));
        expect(result.current.state).toBe('live');

        await act(async () => {
            jest.advanceTimersByTime(DISCONNECT_GRACE_MS * 2);
        });
        expect(result.current.state).toBe('live');
        expect(api.disconnectRoom).not.toHaveBeenCalled();
    });

    it('gives up when "disconnected" lasts: frees camera and room', async () => {
        jest.useFakeTimers();
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        const stream = lastStream;
        act(() => pc().setState('connected'));
        act(() => pc().setState('disconnected'));

        await act(async () => {
            jest.advanceTimersByTime(DISCONNECT_GRACE_MS + 10);
        });

        expect(result.current.state).toBe('disconnected');
        expect(stream.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
    });

    it('a failed connection is terminal immediately', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        const stream = lastStream;
        await act(async () => {
            pc().setState('failed');
        });

        expect(result.current.state).toBe('disconnected');
        expect(stream.tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
    });

    it('polls renegotiation offers while live and stops polling after stopLive', async () => {
        jest.useFakeTimers();
        api.fetchRenegotiationOffer.mockResolvedValue({ type: 'offer', sdp: 'v=0 reneg' });
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        await act(async () => {
            jest.advanceTimersByTime(1300);
        });
        expect(api.sendRenegotiationAnswer).toHaveBeenCalledWith('room-1', expect.stringContaining('answer'));
        expect(pc().createAnswer).toHaveBeenCalled();

        await act(async () => {
            await result.current.stopLive();
        });
        const polls = api.fetchRenegotiationOffer.mock.calls.length;
        await act(async () => {
            jest.advanceTimersByTime(10_000);
        });
        expect(api.fetchRenegotiationOffer.mock.calls.length).toBe(polls);
    });

    it('a failing renegotiation poll does not break the call', async () => {
        jest.useFakeTimers();
        api.fetchRenegotiationOffer.mockRejectedValue(new Error('network'));
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        await act(async () => {
            jest.advanceTimersByTime(3000);
        });
        expect(result.current.state).toBe('connecting');
        expect(api.disconnectRoom).not.toHaveBeenCalled();
    });

    it('exposes remote streams and removes them (and their listeners) on release', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        const remote = new MockStream();
        const remoteTrack: any = {
            kind: 'video',
            id: 'remote-track',
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        };
        remote.tracks = [remoteTrack];
        act(() => {
            pc().ontrack?.({ track: remoteTrack, streams: [remote] });
        });
        expect(result.current.remoteStreams).toEqual([remote]);
        expect(remoteTrack.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));

        await act(async () => {
            await result.current.stopLive();
        });
        expect(remoteTrack.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
        expect(result.current.remoteStreams).toEqual([]);
    });

    it('silences remote audio/video tracks as soon as the call is left (no sound after leaving)', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        const remote = new MockStream();
        const remoteVideo: any = { kind: 'video', id: 'rv', enabled: true, stop: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() };
        const remoteAudio: any = { kind: 'audio', id: 'ra', enabled: true, stop: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() };
        remote.tracks = [remoteVideo, remoteAudio];
        act(() => {
            pc().ontrack?.({ track: remoteVideo, streams: [remote] });
        });

        await act(async () => {
            await result.current.stopLive();
        });

        expect(remoteAudio.enabled).toBe(false);
        expect(remoteAudio.stop).toHaveBeenCalled();
        expect(remoteVideo.enabled).toBe(false);
    });

    it('silences remote tracks on unmount too (back gesture without stopping)', async () => {
        const { result, unmount } = renderHook(() => useWebRTC());
        await startHost(result);
        const remote = new MockStream();
        const remoteVideo: any = { kind: 'video', id: 'rv', enabled: true, stop: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() };
        const remoteAudio: any = { kind: 'audio', id: 'ra', enabled: true, stop: jest.fn() };
        remote.tracks = [remoteVideo, remoteAudio];
        act(() => {
            pc().ontrack?.({ track: remoteVideo, streams: [remote] });
        });

        unmount();

        expect(remoteAudio.enabled).toBe(false);
        expect(remoteAudio.stop).toHaveBeenCalled();
    });
});

describe('useWebRTC - co-streamer and existing room', () => {
    it('joins: reserves, negotiates, and leaving disconnects once', async () => {
        const { result } = renderHook(() => useWebRTC());
        await act(async () => {
            await result.current.joinAsCoStreamer('room-9');
        });

        expect(api.reserveRoom).toHaveBeenCalledWith('room-9');
        expect(api.createRoom).not.toHaveBeenCalled();
        expect(api.sendOffer).toHaveBeenCalledWith('room-9', expect.any(String));

        await act(async () => {
            await result.current.stopLive();
        });
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
        expect(api.disconnectRoom).toHaveBeenCalledWith('room-9');
    });

    it('releases the reservation when joining fails', async () => {
        api.reserveRoom.mockRejectedValueOnce(Object.assign(new Error('room full'), { status: 403 }));
        const { result } = renderHook(() => useWebRTC());
        await act(async () => {
            await result.current.joinAsCoStreamer('room-9');
        });

        expect(result.current.state).toBe('error');
        expect(result.current.error).toBe('room full');
        expect(api.disconnectRoom).toHaveBeenCalledWith('room-9');
        expect(mockEnv.getUserMedia).not.toHaveBeenCalled();
    });

    it('releases everything when the camera fails after the reservation', async () => {
        mockEnv.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('busy'), { name: 'NotReadableError' }));
        const { result } = renderHook(() => useWebRTC());
        await act(async () => {
            await result.current.joinAsCoStreamer('room-9');
        });
        expect(result.current.errorCode).toBe('device');
        expect(api.disconnectRoom).toHaveBeenCalledTimes(1);
    });

    it('hosts an existing (scheduled) room without creating one', async () => {
        const { result } = renderHook(() => useWebRTC());
        await act(async () => {
            await result.current.hostExistingRoom('sched-1');
        });
        expect(api.createRoom).not.toHaveBeenCalled();
        expect(api.reserveRoom).not.toHaveBeenCalled();
        expect(api.sendOffer).toHaveBeenCalledWith('sched-1', expect.any(String));

        await act(async () => {
            await result.current.stopLive();
        });
        expect(api.disconnectRoom).toHaveBeenCalledWith('sched-1');
    });

    it('does not cancel a scheduled room whose start failed before the offer was accepted', async () => {
        mockEnv.getUserMedia.mockRejectedValueOnce(Object.assign(new Error('denied'), { name: 'NotAllowedError' }));
        const { result, unmount } = renderHook(() => useWebRTC());
        await act(async () => {
            await result.current.hostExistingRoom('sched-1');
        });
        unmount();
        expect(api.disconnectRoom).not.toHaveBeenCalled();
    });
});

describe('useWebRTC - local controls', () => {
    it('toggles microphone and camera tracks', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);

        act(() => result.current.toggleAudio());
        expect(result.current.isAudioMuted).toBe(true);
        expect(lastStream.getAudioTracks()[0].enabled).toBe(false);
        act(() => result.current.toggleAudio());
        expect(result.current.isAudioMuted).toBe(false);

        act(() => result.current.toggleVideo());
        expect(result.current.isVideoMuted).toBe(true);
        expect(lastStream.getVideoTracks()[0].enabled).toBe(false);
    });

    it('switches camera through the native track and flips the mirror flag', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        const switcher = jest.fn().mockResolvedValue(undefined);
        (lastStream.getVideoTracks()[0] as any)._switchCamera = switcher;

        await act(async () => {
            result.current.switchCamera();
        });
        expect(switcher).toHaveBeenCalledTimes(1);
        expect(result.current.isFrontCamera).toBe(false);
    });

    it('does not switch (nor reject) when the camera is turned off', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        const switcher = jest.fn().mockRejectedValue(new Error('switchCamera: camera is not running.'));
        (lastStream.getVideoTracks()[0] as any)._switchCamera = switcher;

        act(() => result.current.toggleVideo());
        await act(async () => {
            result.current.switchCamera();
        });

        expect(switcher).not.toHaveBeenCalled();
        expect(result.current.isFrontCamera).toBe(true);
    });

    it('swallows a native switch failure and keeps the camera flag unchanged', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        const switcher = jest.fn().mockRejectedValue(new Error('Error switching camera'));
        (lastStream.getVideoTracks()[0] as any)._switchCamera = switcher;

        await act(async () => {
            result.current.switchCamera();
        });

        expect(switcher).toHaveBeenCalledTimes(1);
        expect(result.current.isFrontCamera).toBe(true);
        // and the lock is released so the user can retry
        await act(async () => {
            result.current.switchCamera();
        });
        expect(switcher).toHaveBeenCalledTimes(2);
    });

    it('ignores a second tap while a switch is in flight', async () => {
        const { result } = renderHook(() => useWebRTC());
        await startHost(result);
        let finish: () => void = () => {};
        const switcher = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
        (lastStream.getVideoTracks()[0] as any)._switchCamera = switcher;

        await act(async () => {
            result.current.switchCamera();
            result.current.switchCamera();
        });
        expect(switcher).toHaveBeenCalledTimes(1);
        await act(async () => {
            finish();
        });
    });

    it('controls are safe no-ops without a stream', () => {
        const { result } = renderHook(() => useWebRTC());
        act(() => {
            result.current.toggleAudio();
            result.current.toggleVideo();
            result.current.switchCamera();
        });
        expect(result.current.isAudioMuted).toBe(false);
    });
});

describe('classifyError', () => {
    it.each([
        [{ name: 'NotAllowedError', message: 'x' }, 'permission'],
        [new Error('Permission denied by user'), 'permission'],
        [{ name: 'NotFoundError', message: 'x' }, 'device'],
        [{ name: 'UnauthorizedError', message: 'x' }, 'unauthorized'],
        [{ status: 409, message: 'x' }, 'conflict'],
        [new Error('boom'), 'generic'],
    ])('%j -> %s', (err, code) => {
        expect(classifyError(err, 'fallback').code).toBe(code);
    });

    it('falls back to the default message', () => {
        expect(classifyError({}, 'fallback').message).toBe('fallback');
    });
});

describe('isUdpCandidate', () => {
    it('keeps UDP candidates and drops TCP / malformed ones', () => {
        expect(isUdpCandidate('candidate:1 1 udp 2122260223 192.168.1.40 50001 typ host')).toBe(true);
        expect(isUdpCandidate('candidate:2 1 UDP 1686052607 203.0.113.4 50002 typ srflx')).toBe(true);
        expect(isUdpCandidate('candidate:3 1 tcp 1518280447 192.168.1.40 9 typ host tcptype active')).toBe(false);
        expect(isUdpCandidate('')).toBe(false);
        expect(isUdpCandidate(undefined)).toBe(false);
        expect(isUdpCandidate(null)).toBe(false);
    });
});
