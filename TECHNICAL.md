# Foodstream — Technical Documentation

## Live Streaming Architecture: WebRTC & HLS

> This document describes the complete technical implementation of the live-streaming
> feature in the Foodstream (Etchebest) platform. It covers the end-to-end data flow
> from the streamer's camera to the viewer's screen, every protocol involved, and
> the implementation details of each component.

---

## Table of Contents

- [Foodstream — Technical Documentation](#foodstream--technical-documentation)
  - [Live Streaming Architecture: WebRTC \& HLS](#live-streaming-architecture-webrtc--hls)
  - [Table of Contents](#table-of-contents)
  - [1. High-Level Architecture](#1-high-level-architecture)
  - [2. Technology Stack](#2-technology-stack)
    - [Backend](#backend)
    - [Mobile / Web Frontend](#mobile--web-frontend)
  - [3. Protocol Primer: WebRTC vs HLS](#3-protocol-primer-webrtc-vs-hls)
    - [3.1 WebRTC (Web Real-Time Communication)](#31-webrtc-web-real-time-communication)
    - [3.2 HLS (HTTP Live Streaming)](#32-hls-http-live-streaming)
    - [3.3 Why Both?](#33-why-both)
  - [4. Infrastructure \& Deployment](#4-infrastructure--deployment)
    - [4.1 Docker Compose](#41-docker-compose)
    - [4.2 Why `network_mode: host`?](#42-why-network_mode-host)
    - [4.3 Dockerfile](#43-dockerfile)
    - [4.4 Port Allocation](#44-port-allocation)
  - [5. Backend Implementation](#5-backend-implementation)
    - [5.1 Room Lifecycle](#51-room-lifecycle)
    - [5.2 WebRTC Signaling](#52-webrtc-signaling)
    - [5.3 ICE Candidate Exchange](#53-ice-candidate-exchange)
    - [5.4 Media Track Handling (OnTrack)](#54-media-track-handling-ontrack)
    - [5.5 HLS Pipeline: WebRTC → FFmpeg → HLS](#55-hls-pipeline-webrtc--ffmpeg--hls)
      - [5.5.1 The UDP Relay Pattern](#551-the-udp-relay-pattern)
      - [5.5.2 Dynamic SDP Generation](#552-dynamic-sdp-generation)
      - [5.5.3 FFmpeg Command](#553-ffmpeg-command)
      - [5.5.4 Why Transcoding Is Needed](#554-why-transcoding-is-needed)
      - [5.5.5 The 500ms Delay](#555-the-500ms-delay)
    - [5.6 HLS Stream Manager](#56-hls-stream-manager)
    - [5.7 Disconnection \& Cleanup](#57-disconnection--cleanup)
  - [6. Mobile / Web Frontend Implementation](#6-mobile--web-frontend-implementation)
    - [6.1 Platform-Split Architecture](#61-platform-split-architecture)
    - [6.2 useWebRTC Hook](#62-usewebrtc-hook)
    - [6.3 Streaming Service (API Layer)](#63-streaming-service-api-layer)
    - [6.4 Live Rooms Screen](#64-live-rooms-screen)
    - [6.5 Live Streaming Screen (Streamer)](#65-live-streaming-screen-streamer)
    - [6.6 Live Viewer Screen (HLS Viewer)](#66-live-viewer-screen-hls-viewer)
    - [6.7 HLS Player Components](#67-hls-player-components)
      - [Web: `HLSPlayer.web.tsx` (hls.js)](#web-hlsplayerwebtsx-hlsjs)
      - [Native: `HLSPlayer.tsx` (expo-av)](#native-hlsplayertsx-expo-av)
  - [7. Data Flow Diagrams](#7-data-flow-diagrams)
    - [7.1 Complete Streaming Flow](#71-complete-streaming-flow)
    - [7.2 ICE Connectivity Establishment](#72-ice-connectivity-establishment)
  - [8. API Reference](#8-api-reference)
    - [Authentication](#authentication)
    - [Rooms](#rooms)
    - [WebRTC Signaling](#webrtc-signaling)
    - [HLS Streaming](#hls-streaming)
  - [9. Key Design Decisions \& Tradeoffs](#9-key-design-decisions--tradeoffs)
    - [9.1 SFU vs MCU vs Mesh](#91-sfu-vs-mcu-vs-mesh)
    - [9.2 In-Memory Room State](#92-in-memory-room-state)
    - [9.3 UDP Relay vs Raw Pipe](#93-udp-relay-vs-raw-pipe)
    - [9.4 Public HLS Endpoints](#94-public-hls-endpoints)
    - [9.5 Transcoding Cost](#95-transcoding-cost)
  - [10. Troubleshooting \& Debugging](#10-troubleshooting--debugging)
    - [10.1 Common Issues](#101-common-issues)
    - [10.2 Useful Debug Commands](#102-useful-debug-commands)
    - [10.3 Backend Log Indicators](#103-backend-log-indicators)
  - [File Index](#file-index)
    - [Backend (`backend/`)](#backend-backend)
    - [Mobile / Web (`mobile/`)](#mobile--web-mobile)

---

## 1. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         STREAMER (Browser / Mobile)                      │
│  getUserMedia() → camera + mic → MediaStream                            │
│  RTCPeerConnection → SDP offer → POST /api/webrtc                       │
│  ICE candidates → POST /api/ice                                         │
│  RTP audio (Opus) + video (VP8) → UDP → Backend                        │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                    WebRTC (RTP over UDP, DTLS-SRTP)
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                          BACKEND (Go + Pion)                             │
│                                                                          │
│  ┌─────────────┐    ┌──────────────────┐    ┌─────────────────────────┐ │
│  │  Pion WebRTC│───▶│  RTP Read Loop   │───▶│  localTrack.Write()     │ │
│  │  PeerConn   │    │  (per track)     │    │  → relay to co-streamers│ │
│  └─────────────┘    └───────┬──────────┘    └─────────────────────────┘ │
│                             │                                            │
│                   UDP relay (net.Conn.Write)                             │
│                             │                                            │
│                    ┌────────▼─────────┐                                  │
│                    │   FFmpeg process  │                                  │
│                    │   Reads RTP via   │                                  │
│                    │   SDP + UDP ports │                                  │
│                    │                   │                                  │
│                    │   VP8 → libx264   │                                  │
│                    │   Opus → AAC      │                                  │
│                    │   Output: HLS     │                                  │
│                    └────────┬──────────┘                                  │
│                             │                                            │
│                    ┌────────▼─────────┐                                  │
│                    │  ./hls/{roomId}/ │                                  │
│                    │  index.m3u8      │                                  │
│                    │  index0.ts       │                                  │
│                    │  index1.ts  ...  │                                  │
│                    └────────┬─────────┘                                  │
│                             │                                            │
│                    r.Static("/api/hls", "./hls")  ← Gin serves files     │
└───────────────────────────────┬──────────────────────────────────────────┘
                                │
                     HTTP GET /api/hls/{roomId}/index.m3u8
                                │
┌───────────────────────────────▼──────────────────────────────────────────┐
│                         VIEWER (Browser / Mobile)                        │
│                                                                          │
│  Web: hls.js parses .m3u8, fetches .ts segments, feeds to <video>       │
│  iOS: expo-av uses native AVPlayer (built-in HLS support)               │
│  Safari: native HLS via <video src="...m3u8">                           │
└──────────────────────────────────────────────────────────────────────────┘
```

There are **two distinct paths** for consuming a live stream:

| Path | Protocol | Role | Latency | Use Case |
|------|----------|------|---------|----------|
| **WebRTC** | RTP/UDP (DTLS-SRTP) | Co-streamer (participant) | ~200ms | Interactive co-streaming, bidirectional A/V |
| **HLS** | HTTP (TCP) | Viewer (spectator) | ~6-10s | Passive watching, scalable to many viewers |

---

## 2. Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Language | Go | 1.24 | Server-side logic |
| HTTP Framework | Gin | 1.11 | REST API routing, middleware, CORS |
| WebRTC | Pion WebRTC | v3.3.5 | SFU-style WebRTC handling |
| Database | PostgreSQL | 16-alpine | Room persistence, user data |
| ORM | GORM | 1.30 | Database access layer |
| Auth | JWT (golang-jwt) | v5.3 | Bearer token authentication |
| Transcoding | FFmpeg | 6.1.2 (Alpine) | VP8/Opus → H264/AAC → HLS |
| Containerization | Docker | Alpine-based | Deployment |

### Mobile / Web Frontend

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Framework | Expo (React Native) | SDK 54 | Cross-platform mobile + web |
| Router | expo-router | ~6.0 | File-based routing |
| WebRTC (native) | react-native-webrtc | 124.0.7 | Native iOS/Android WebRTC |
| WebRTC (web) | Browser native APIs | — | Browser `RTCPeerConnection` |
| HLS Player (web) | hls.js | 1.6.15 | HLS playback on Chrome/Firefox |
| HLS Player (native) | expo-av | 16.0.8 | Native HLS playback (AVPlayer) |
| Language | TypeScript | 5.3 | Type-safe frontend code |
| Bundler | Metro | — | React Native bundler (Expo) |

---

## 3. Protocol Primer: WebRTC vs HLS

### 3.1 WebRTC (Web Real-Time Communication)

WebRTC enables **peer-to-peer** (or server-relayed) real-time audio/video with sub-second latency.

**Key components:**

- **SDP (Session Description Protocol)**: Text-based format describing media capabilities, codecs, and transport parameters. Exchanged as "offer" and "answer" between peers.
- **ICE (Interactive Connectivity Establishment)**: Framework for NAT traversal. Gathers local, reflexive (STUN), and relayed (TURN) candidates to find a working network path.
- **STUN (Session Traversal Utilities for NAT)**: Server that tells a client its public IP:port mapping. We use Google's public STUN server (`stun:stun.l.google.com:19302`).
- **DTLS-SRTP**: Encrypted transport for media. DTLS negotiates keys, SRTP encrypts RTP packets.
- **RTP (Real-time Transport Protocol)**: Carries the actual audio/video data in UDP packets. Each packet has a payload type (PT) identifying the codec.

**Codec negotiation:**
The browser offers codecs it supports (VP8, H264, Opus, etc.) in the SDP offer. The server (Pion) selects which to use via `RegisterDefaultCodecs()`, which registers all standard codecs. The SDP answer confirms the negotiated codecs.

In our setup:

- **Audio**: Opus (PT 111), 48 kHz, 2 channels
- **Video**: VP8 (PT 96), 90 kHz clock rate

### 3.2 HLS (HTTP Live Streaming)

HLS is Apple's adaptive streaming protocol, now universally supported. It works over standard HTTP.

**How it works:**

1. A **media encoder** (FFmpeg) segments live video into small `.ts` (MPEG-TS) files, typically 2-6 seconds each.
2. A **playlist file** (`index.m3u8`) lists the available segments and is continually updated.
3. The **client** polls the playlist every segment duration, discovers new segments, downloads and plays them sequentially.

**Key parameters in our configuration:**

```
-hls_time 2          → each segment is ~2 seconds
-hls_list_size 5     → playlist keeps the 5 most recent segments
-hls_flags delete_segments → old segments are deleted from disk
```

**Latency breakdown:**

- Encoding latency: ~0.5s (ultrafast preset)
- Segment duration: 2s (need at least 1 full segment before playback)
- Client buffer: hls.js buffers `liveSyncDurationCount=3` segments
- **Total: ~6-10 seconds end-to-end**

### 3.3 Why Both?

| Concern | WebRTC | HLS |
|---------|--------|-----|
| Latency | ~200ms | ~6-10s |
| Scalability | Limited (each peer = server resources) | Unlimited (static HTTP files, CDN-friendly) |
| Interactivity | Bidirectional (cam + mic) | Unidirectional (watch only) |
| NAT traversal | Complex (ICE/STUN/TURN) | None (HTTP) |
| Browser support | Needs WebRTC API | Universal |

We use **WebRTC for participants** (interactive co-streaming) and **HLS for viewers** (scalable passive watching).

---

## 4. Infrastructure & Deployment

### 4.1 Docker Compose

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: db-foodstream
    network: back-network (bridge)

  backend:
    container_name: backend-foodstream
    build: ./backend
    network_mode: host          # ← Critical for WebRTC
    environment:
      STUN_SERVER_URL: stun:stun.l.google.com:19302
      WEBRTC_IP: 127.0.0.1     # ← NAT1To1 IP for ICE candidates
```

### 4.2 Why `network_mode: host`?

WebRTC relies on UDP packets flowing between the browser and the server. Docker's default bridge network performs NAT on these packets, which breaks ICE connectivity because:

1. The server advertises its container IP (e.g., `172.17.0.2`) in ICE candidates
2. The browser can't reach that private IP

With `network_mode: host`, the container shares the host's network stack directly:

- The server binds to the host's interfaces
- ICE candidates use the host's real IP
- UDP ports 50000-50100 are directly accessible
- The backend connects to PostgreSQL via `127.0.0.1` (since both are on host network)

### 4.3 Dockerfile

```dockerfile
FROM golang:1.24.6-alpine AS build
WORKDIR /foodstream
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o etchebest ./cmd/server/main.go
RUN apk add --no-cache ffmpeg    # ← FFmpeg for HLS transcoding
CMD ["./etchebest"]
```

FFmpeg is installed in the same container as the Go server because:

- The Go process spawns FFmpeg as a child process (`os/exec`)
- They communicate via local UDP (localhost)
- HLS files are written to `./hls/` and served by Gin's `r.Static()` from the same container

### 4.4 Port Allocation

| Port | Service | Protocol |
|------|---------|----------|
| 8081 | Go HTTP API (Gin) | TCP |
| 8082 | Metro bundler (Expo dev) | TCP |
| 5432 | PostgreSQL | TCP |
| 50000-50100 | WebRTC media (Pion) | UDP |
| Dynamic (46000-65535) | FFmpeg RTP relay | UDP (localhost only) |

---

## 5. Backend Implementation

### 5.1 Room Lifecycle

**File:** `backend/internal/modules/room/model.go`

```go
type Room struct {
    ID              string                    // UUID, primary key
    Name            string                    // Human-readable room name
    Host            string                    // User ID of the creator
    Participants    pq.StringArray            // User IDs allowed to co-stream (WebRTC)
    Viewers         int                       // Spectator count
    MaxParticipants int                       // Default: 5
    // Runtime fields (not persisted to DB):
    Connections     []PeerConnection          // Active WebRTC peer connections
    Tracks          []*TrackInfo              // Active media tracks
    PendingICE      []webrtc.ICECandidateInit // ICE candidates buffered before PC exists
    HLSWriter       *hls.HLSWriter            // UDP connections to FFmpeg
}
```

**In-memory registry** (`room.go`):

```go
var liveRooms = make(map[string]*Room)
```

Rooms are persisted in PostgreSQL for metadata but their **runtime state** (connections, tracks, HLS writer) is held in-memory. The `liveRooms` map ensures all handlers share the same `*Room` pointer for a given room ID.

**Room creation flow:**

1. `POST /api/rooms` — Creates room in DB, registers in `liveRooms`, returns `roomId`
2. The creator is automatically added as the first participant
3. Other users can reserve a spot via `POST /api/rooms/:roomId/reserve`

### 5.2 WebRTC Signaling

**File:** `backend/internal/modules/room/room.go` → `HandleWebRTC()`

**Endpoint:** `POST /api/webrtc?roomId={uuid}`

This is the core signaling endpoint. It performs the SDP offer/answer exchange that establishes the WebRTC connection.

**Step-by-step flow:**

```
Browser                          Backend (Pion)
   │                                  │
   │  1. POST /api/webrtc             │
   │     Body: { type:"offer",        │
   │             sdp: "v=0\r\n..." }  │
   │────────────────────────────────▶ │
   │                                  │
   │     2. Verify JWT + participant  │
   │     3. Create SettingEngine:     │
   │        - SetNAT1To1IPs(["127.0.0.1"])
   │        - SetEphemeralUDPPortRange(50000,50100)
   │     4. Create MediaEngine:       │
   │        - RegisterDefaultCodecs() │
   │     5. NewPeerConnection(config) │
   │     6. Add existing tracks       │
   │     7. SetRemoteDescription(offer)
   │     8. Flush pending ICE cands   │
   │     9. CreateAnswer()            │
   │    10. SetLocalDescription()     │
   │    11. Wait GatheringComplete    │
   │    12. Return full SDP answer    │
   │                                  │
   │  Response: { sdp: "v=0\r\n..." } │
   │◀────────────────────────────────│
```

**Critical configuration details:**

```go
settingEngine.SetNAT1To1IPs([]string{webrtcIP}, webrtc.ICECandidateTypeHost)
```

This tells Pion to replace its local IPs in ICE candidates with the configured IP (127.0.0.1 for local dev). Without this, Pion would advertise Docker-internal IPs.

```go
settingEngine.SetEphemeralUDPPortRange(50000, 50100)
```

Restricts UDP ports used by Pion. Important for firewall rules and Docker port mapping.

```go
mediaEngine.RegisterDefaultCodecs()
```

Registers all standard WebRTC codecs (VP8, VP9, H264, Opus, G722, PCMU, PCMA, etc.). Without this, Pion rejects the SDP offer because it doesn't know any codecs.

```go
gatherComplete := webrtc.GatheringCompletePromise(peerConnection)
// ... SetLocalDescription ...
<-gatherComplete
```

Waits until all ICE candidates are gathered before returning the SDP answer. This embeds candidates directly in the SDP ("trickle ICE" is also supported via the `/api/ice` endpoint, but embedding ensures connectivity even if trickle candidates arrive late).

### 5.3 ICE Candidate Exchange

**Endpoint:** `POST /api/ice?roomId={uuid}`

ICE candidates are connectivity checks. The browser discovers its own network addresses (local, STUN-reflected, TURN-relayed) and sends them to the server. The server also discovers its candidates and embeds them in the SDP answer.

```go
func HandleICECandidate(db *gorm.DB) gin.HandlerFunc {
    // Parse webrtc.ICECandidateInit directly (flat format)
    var candidate webrtc.ICECandidateInit
    c.ShouldBindJSON(&candidate)

    // If no peer connection exists yet, buffer the candidate
    if len(room.Connections) == 0 {
        room.PendingICE = append(room.PendingICE, candidate)
        return
    }

    // Otherwise add to all existing connections
    for _, pc := range room.Connections {
        pc.PeerCon.AddICECandidate(candidate)
    }
}
```

**Candidate format** (sent from browser):

```json
{
    "candidate": "candidate:3056975322 1 udp 2122260223 172.19.0.1 50771 typ host ...",
    "sdpMLineIndex": 0,
    "sdpMid": "0"
}
```

**Race condition handling:** ICE candidates from the browser may arrive before the peer connection is created (the SDP exchange takes ~60ms). The `PendingICE` buffer stores these early candidates and flushes them after `SetRemoteDescription()`.

### 5.4 Media Track Handling (OnTrack)

**File:** `backend/internal/modules/room/room.go` → inside `HandleWebRTC()`

When the WebRTC connection is established and the browser starts sending media, Pion fires `OnTrack` for each media track (audio and video).

```go
peerConnection.OnTrack(func(track *webrtc.TrackRemote, receiver *webrtc.RTPReceiver) {
    // 1. Extract codec information
    codec := track.Codec()
    ci := &hls.CodecInfo{
        PayloadType: uint8(codec.PayloadType),  // e.g., 111 for Opus, 96 for VP8
        CodecName:   "VP8",                      // extracted from "video/VP8"
        ClockRate:   codec.ClockRate,            // 48000 for Opus, 90000 for VP8
        Channels:    codec.Channels,             // 2 for Opus stereo
        FmtpLine:    codec.SDPFmtpLine,          // "minptime=10;useinbandfec=1"
    }

    // 2. Track counting — wait for both audio + video
    if trackCount >= 2 && room.HLSWriter == nil {
        writer, _, _ := hls.Start(roomID, audioCodec, videoCodec)
        room.HLSWriter = writer
    }

    // 3. Create a local track for relaying to co-streamers
    localTrack := webrtc.NewTrackLocalStaticRTP(...)

    // 4. Start RTP read loop (goroutine per track)
    go func() {
        buf := make([]byte, 1500)  // MTU-sized buffer
        for {
            n, _, _ := track.Read(buf)

            // Relay to other WebRTC peers
            localTrack.Write(buf[:n])

            // Relay to FFmpeg via UDP
            if cachedWriter != nil {
                if track.Kind() == Audio {
                    cachedWriter.AudioConn.Write(buf[:n])
                } else {
                    cachedWriter.VideoConn.Write(buf[:n])
                }
            }
        }
    }()
})
```

**Key details:**

- Each track gets its own goroutine running a tight `Read → Write` loop
- The buffer is 1500 bytes (standard MTU) — one RTP packet per read
- The same RTP packet is written to **two destinations**: other WebRTC peers (via `localTrack`) and FFmpeg (via UDP)
- The `cachedWriter` pattern avoids acquiring a mutex on every packet (~hundreds per second)

### 5.5 HLS Pipeline: WebRTC → FFmpeg → HLS

**File:** `backend/internal/hls/streamer.go`

This is the most complex subsystem. It bridges the real-time WebRTC world to the file-based HLS world using FFmpeg.

#### 5.5.1 The UDP Relay Pattern

**Why not pipe RTP to FFmpeg's stdin?**
FFmpeg's RTP demuxer (`-f rtp`) requires a **network socket with SDP metadata**, not raw bytes on stdin. The RTP demuxer needs to know codec parameters (payload type, clock rate, etc.) from an SDP description to interpret the packets. Piping raw RTP to stdin (`-f rtp -i pipe:0`) fails silently.

**Solution: Local UDP relay**

```
┌─────────────┐     UDP (localhost)      ┌─────────────────┐
│ Go OnTrack  │ ─── audioConn.Write() ──▶│ FFmpeg           │
│ goroutine   │     port 46605           │ Listens on ports │
│             │                          │ from SDP file    │
│             │ ─── videoConn.Write() ──▶│                  │
│             │     port 43744           │                  │
└─────────────┘                          └─────────────────┘
```

1. **Pick two free UDP ports** by briefly binding to `127.0.0.1:0`, noting the port, and closing.
2. **Write an SDP file** describing the two media streams with their ports and codecs.
3. **Launch FFmpeg** with `-protocol_whitelist file,udp,rtp -i stream.sdp`.
4. **Wait 500ms** for FFmpeg to bind the UDP ports.
5. **Open UDP connections** (`net.Dial("udp4", "127.0.0.1:<port>")`) to send RTP packets.

#### 5.5.2 Dynamic SDP Generation

The SDP file is generated dynamically from the actual negotiated codec parameters:

```
v=0
o=- 0 0 IN IP4 127.0.0.1
s=WebRTC to HLS
c=IN IP4 127.0.0.1
t=0 0
m=audio 46605 RTP/AVP 111
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
m=video 43744 RTP/AVP 96
a=rtpmap:96 VP8/90000
```

This SDP tells FFmpeg:

- Audio is Opus on port 46605, payload type 111, 48kHz, 2 channels
- Video is VP8 on port 43744, payload type 96, 90kHz clock rate

The codec info is extracted from Pion's `track.Codec()` in the `OnTrack` callback, so it adapts to whatever codecs the browser and Pion negotiated.

#### 5.5.3 FFmpeg Command

```bash
ffmpeg \
    -loglevel warning \
    -fflags +genpts \
    -analyzeduration 10000000 \
    -probesize 5000000 \
    -protocol_whitelist file,udp,rtp \
    -i stream.sdp \
    # Audio transcoding
    -c:a aac -b:a 128k -ar 48000 -ac 2 \
    # Video transcoding
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -g 30 -sc_threshold 0 \
    -b:v 1500k -maxrate 1500k -bufsize 3000k \
    -pix_fmt yuv420p \
    # HLS output
    -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments \
    ./hls/{roomId}/index.m3u8
```

**Flag explanations:**

| Flag | Value | Purpose |
|------|-------|---------|
| `-fflags +genpts` | — | Generate presentation timestamps from RTP packets (RTP uses its own clock) |
| `-analyzeduration` | 10000000 (10s) | Time to analyze input stream to detect codec params. VP8 over RTP needs time to receive keyframes and determine resolution. Default of 0 causes "unspecified size" errors |
| `-probesize` | 5000000 (5MB) | Amount of data to probe. Larger = better detection, slower start |
| `-protocol_whitelist` | file,udp,rtp | Allow SDP file reading (`file`), UDP socket binding (`udp`), and RTP parsing (`rtp`) |
| `-c:a aac` | — | Transcode Opus → AAC (HLS requires AAC audio) |
| `-c:v libx264` | — | Transcode VP8 → H.264 (HLS requires H.264 video) |
| `-preset ultrafast` | — | Fastest encoding (lowest CPU, larger files, acceptable for live) |
| `-tune zerolatency` | — | Removes encoder latency (no B-frames, no lookahead) |
| `-g 30` | — | GOP (Group of Pictures) size = 30 frames. Keyframe every ~1s at 30fps |
| `-sc_threshold 0` | — | Disable scene change detection (ensures consistent keyframe interval) |
| `-pix_fmt yuv420p` | — | Force YUV 4:2:0 pixel format (maximum compatibility with players) |
| `-hls_time 2` | — | Target segment duration: 2 seconds |
| `-hls_list_size 5` | — | Keep 5 segments in playlist (10s rolling window) |
| `-hls_flags delete_segments` | — | Delete old `.ts` files from disk (prevents disk fill) |

#### 5.5.4 Why Transcoding Is Needed

WebRTC codecs ≠ HLS codecs:

| Layer | WebRTC (input) | HLS (output) | Why |
|-------|---------------|--------------|-----|
| Video | VP8 | H.264 (libx264) | HLS spec requires H.264 or H.265. VP8 is not supported in MPEG-TS containers |
| Audio | Opus | AAC | HLS spec requires AAC. Opus is not supported in MPEG-TS |
| Container | RTP packets | MPEG-TS (.ts) | HLS segments must be MPEG Transport Stream |

#### 5.5.5 The 500ms Delay

```go
if err := cmd.Start(); err != nil { ... }
time.Sleep(500 * time.Millisecond)
audioConn, _ := net.Dial("udp4", ...)
videoConn, _ := net.Dial("udp4", ...)
```

After `cmd.Start()`, FFmpeg needs time to:

1. Parse the SDP file
2. Create UDP sockets and bind to the specified ports
3. Start its input thread

Without this delay, Go starts sending RTP packets before FFmpeg has bound the ports. UDP is connectionless — the packets are simply lost (no error). If the first keyframe is lost, FFmpeg never determines the video resolution, resulting in a black screen.

### 5.6 HLS Stream Manager

**File:** `backend/internal/hls/manager.go`

A simple registry tracking active HLS streams per room:

```go
var streams = make(map[string]*Stream)

type Stream struct {
    RoomID string
    Stop   func()  // Cleanup: close UDP conns + kill FFmpeg
}

func IsRunning(roomID string) bool    // Check before starting a duplicate
func RegisterToStream(roomID, stop)   // Called by Start()
func StopStream(roomID string)        // Kill FFmpeg, delete files, remove from map
```

`StopStream` performs full cleanup:

1. Calls `stop()` → closes `AudioConn` + `VideoConn`, kills FFmpeg process
2. `os.RemoveAll("./hls/" + roomID)` → removes the `.m3u8` and `.ts` files

### 5.7 Disconnection & Cleanup

**Endpoint:** `POST /api/rooms/:roomId/disconnect`

**Also triggered by:** `OnConnectionStateChange` when state becomes `disconnected`/`failed`/`closed`

```
Cleanup sequence:
1. Close all WebRTC peer connections (remove tracks, close)
2. Remove connection from room.Connections[]
3. If last connection leaves:
   a. hls.StopStream(roomID)  → kill FFmpeg, delete HLS files
   b. removeLiveRoom(roomID)  → remove from in-memory registry
   c. DeleteRoomById(db, roomID) → remove from PostgreSQL
```

---

## 6. Mobile / Web Frontend Implementation

### 6.1 Platform-Split Architecture

The app runs on **three platforms** (iOS, Android, Web) from a single codebase using Metro's platform extensions:

```
utils/
  webrtc.ts          ← Default (SSR safe): exports undefined stubs
  webrtc.native.ts   ← iOS/Android: re-exports react-native-webrtc
  webrtc.web.tsx     ← Web: exports browser globals (RTCPeerConnection, etc.)

components/
  StreamView.tsx     ← Default: re-exports native
  StreamView.native.tsx ← iOS/Android: RTCView from react-native-webrtc
  StreamView.web.tsx    ← Web: <video> element with srcObject

  HLSPlayer.tsx      ← iOS/Android: expo-av Video component
  HLSPlayer.web.tsx  ← Web: hls.js library
```

**Metro resolution order:**

1. `.web.tsx` for web builds
2. `.native.tsx` for iOS/Android builds
3. `.tsx` as fallback (also used during SSR)

### 6.2 useWebRTC Hook

**File:** `mobile/hooks/useWebRTC.ts`

A custom React hook that encapsulates the entire WebRTC lifecycle:

```typescript
export function useWebRTC(): UseWebRTCReturn {
    state: StreamingState;      // 'idle' | 'creating' | 'connecting' | 'live' | 'error' | 'disconnected'
    roomId: string | null;
    localStream: MediaStream;   // Camera + mic
    remoteStreams: MediaStream[]; // From co-streamers
    error: string | null;
    startLive(roomName): Promise<void>;
    joinAsCoStreamer(roomId): Promise<void>;
    stopLive(): Promise<void>;
}
```

**`startLive` flow:**

```
1. setState('creating')
2. POST /api/rooms → get roomId
3. setState('connecting')
4. getUserMedia({ audio: true, video: { 1280x720, 30fps } })
5. new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] })
6. stream.getTracks().forEach(track => pc.addTrack(track, stream))
7. pc.onicecandidate → POST /api/ice (trickle ICE)
8. pc.ontrack → collect remote streams
9. pc.onconnectionstatechange → update state to 'live' when connected
10. offer = pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
11. pc.setLocalDescription(offer)
12. POST /api/webrtc → get SDP answer
13. pc.setRemoteDescription(answer)
14. Flush ICE candidate queue
```

**`joinAsCoStreamer` flow:**
Same as `startLive` but skips room creation, calls `POST /api/rooms/:roomId/reserve` instead.

**`stopLive` flow:**

```
1. pc.close()
2. localStream.getTracks().forEach(t => t.stop())
3. POST /api/rooms/:roomId/disconnect
4. Reset all state
```

**SSR safety:** The hook lazily resolves `RTCPeerConnection` and `mediaDevices` at call time, not import time. During SSR (server-side rendering for expo-router), these browser globals don't exist, so the imported stubs from `webrtc.ts` are `undefined`. The hook falls back to `globalThis.RTCPeerConnection` which is available in the browser at runtime.

### 6.3 Streaming Service (API Layer)

**File:** `mobile/services/streaming.ts`

Thin wrappers around `fetch()` with JWT authentication:

```typescript
// Room management
createRoom(name) → POST /api/rooms → { roomId, message }
reserveRoom(roomId) → POST /api/rooms/:roomId/reserve
disconnectRoom(roomId) → POST /api/rooms/:roomId/disconnect
getRooms() → GET /api/rooms → RoomInfo[]

// WebRTC signaling
sendOffer(roomId, sdp) → POST /api/webrtc?roomId=... → { sdp }
sendICECandidate(roomId, candidate) → POST /api/ice?roomId=...

// HLS
getHLSUrl(roomId) → string: "http://localhost:8081/api/hls/{roomId}/index.m3u8"
```

All requests include `Authorization: Bearer <jwt>` headers (except HLS URLs, which are fetched by the video player without auth headers — the HLS route is public on the backend).

### 6.4 Live Rooms Screen

**File:** `mobile/app/live-rooms.tsx`

Lists all active live streams. Each room card shows:

- Room name with live indicator dot
- Participant count / max (e.g., "2/5 streamers")
- Viewer count

**Two actions per room:**

- **"Regarder"** → navigates to `/live-viewer?roomId=...&roomName=...` (HLS)
- **"Rejoindre"** → navigates to `/live-streaming?roomId=...&mode=join` (WebRTC co-stream)

**FAB button** → navigates to `/live-streaming?mode=host` (create new live)

### 6.5 Live Streaming Screen (Streamer)

**File:** `mobile/app/live-streaming.tsx`

The streamer UI for hosts and co-streamers:

- Displays local camera preview via `StreamView`
- Shows remote co-streamer streams as picture-in-picture overlays
- Status badge: Prêt → Création → Connexion → 🔴 EN DIRECT
- "Lancer le live" button (host) or auto-join (co-streamer mode)
- "Arrêter" button to disconnect

### 6.6 Live Viewer Screen (HLS Viewer)

**File:** `mobile/app/live-viewer.tsx`

Passive viewing experience:

- Constructs HLS URL: `http://localhost:8081/api/hls/{roomId}/index.m3u8`
- Renders `<HLSPlayer>` component (platform-split)
- Error handling with retry button
- LIVE badge and room name in header
- Footer: "Vous regardez en mode spectateur (HLS)"

### 6.7 HLS Player Components

#### Web: `HLSPlayer.web.tsx` (hls.js)

```typescript
// 1. Check hls.js support
if (Hls.isSupported()) {
    const hls = new Hls({
        enableWorker: true,          // Use Web Worker for parsing
        lowLatencyMode: true,        // Aggressive live-edge seeking
        maxBufferLength: 10,         // Max 10s buffer ahead
        maxMaxBufferLength: 20,      // Absolute max buffer
        liveSyncDurationCount: 3,    // Sync to 3 segments from live edge
        liveMaxLatencyDurationCount: 6, // Max 6 segments behind live
    });
    hls.loadSource(uri);             // Fetch .m3u8
    hls.attachMedia(videoElement);   // Bind to <video>

    hls.on(MANIFEST_PARSED, () => video.play());
    hls.on(ERROR, (_, data) => {
        if (data.fatal) {
            if (NETWORK_ERROR) hls.startLoad();   // Retry on network issues
            if (MEDIA_ERROR) hls.recoverMediaError(); // Recover media decode errors
        }
    });
}
// 2. Safari fallback (native HLS support)
else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    video.src = uri;
}
```

**Why hls.js?** Chrome, Firefox, and Edge don't support HLS natively. Only Safari has built-in HLS support via its `<video>` element. hls.js is a JavaScript library that parses `.m3u8` playlists, fetches `.ts` segments, transmuxes them using MSE (Media Source Extensions), and feeds them to a standard `<video>` element.

#### Native: `HLSPlayer.tsx` (expo-av)

```typescript
<Video
    source={{ uri }}
    resizeMode={ResizeMode.CONTAIN}
    shouldPlay
    useNativeControls
    onLoad={() => setLoading(false)}
    onError={(err) => onError?.(err)}
/>
```

On iOS, `expo-av` uses `AVPlayer` which has native HLS support. On Android, it uses `ExoPlayer` which also supports HLS natively.

---

## 7. Data Flow Diagrams

### 7.1 Complete Streaming Flow

```
                   STREAMER                                    BACKEND                                    VIEWER
                      │                                           │                                         │
    getUserMedia()    │                                           │                                         │
    ◄─ camera+mic ───┤                                           │                                         │
                      │  POST /api/rooms                          │                                         │
                      │──────────────────────────────────────────▶│ CreateRoom() → DB                       │
                      │◀─────────────── { roomId } ──────────────│                                         │
                      │                                           │                                         │
                      │  POST /api/webrtc (SDP offer)             │                                         │
                      │──────────────────────────────────────────▶│ NewPeerConnection()                     │
                      │                                           │ SetRemoteDescription(offer)              │
                      │                                           │ CreateAnswer()                           │
                      │                                           │ GatherICECandidates()                    │
                      │◀─────────────── { SDP answer } ──────────│                                         │
                      │                                           │                                         │
                      │  POST /api/ice (trickle)                  │                                         │
                      │──────────────────────────────────────────▶│ AddICECandidate()                       │
                      │                                           │                                         │
                      ├═══════════════ ICE Connected ═════════════╡                                         │
                      │                                           │                                         │
                      │  RTP(Opus) + RTP(VP8) ═══ UDP ═══════════▶│                                         │
                      │                                           │ OnTrack(audio) → audioCodec              │
                      │                                           │ OnTrack(video) → videoCodec              │
                      │                                           │                                         │
                      │                                           │ if trackCount>=2:                        │
                      │                                           │   hls.Start()                            │
                      │                                           │   1. Pick 2 free UDP ports               │
                      │                                           │   2. Write SDP file                      │
                      │                                           │   3. Launch FFmpeg                       │
                      │                                           │   4. Sleep(500ms)                        │
                      │                                           │   5. Open UDP connections                │
                      │                                           │                                         │
                      │                                           │ RTP loop:                                │
                      │                                           │   track.Read(buf)                        │
                      │                                           │   audioConn.Write(buf) ─▶ FFmpeg         │
                      │                                           │   videoConn.Write(buf) ─▶ FFmpeg         │
                      │                                           │                                         │
                      │                                           │ FFmpeg:                                  │
                      │                                           │   VP8 → H.264 (libx264)                 │
                      │                                           │   Opus → AAC                             │
                      │                                           │   → ./hls/{roomId}/index.m3u8            │
                      │                                           │   → ./hls/{roomId}/index0.ts             │
                      │                                           │                                         │
                      │                                           │                         GET /api/rooms   │
                      │                                           │◀────────────────────────────────────────│
                      │                                           │──────────────── [rooms] ────────────────▶│
                      │                                           │                                         │
                      │                                           │           GET /api/hls/{roomId}/index.m3u8
                      │                                           │◀────────────────────────────────────────│
                      │                                           │─────────── .m3u8 playlist ──────────────▶│
                      │                                           │                                         │
                      │                                           │           GET /api/hls/{roomId}/indexN.ts│
                      │                                           │◀────────────────────────────────────────│
                      │                                           │──────────── .ts segment ────────────────▶│
                      │                                           │                                         │
                      │                                           │                        (polls every 2s) │
                      │                                           │                        hls.js → <video>  │
```

### 7.2 ICE Connectivity Establishment

```
Browser                     STUN Server                    Backend (Pion)
   │                            │                              │
   │  STUN Binding Request      │                              │
   │───────────────────────────▶│                              │
   │◀─── Public IP:Port ────────│                              │
   │                            │                              │
   │  Local candidates:         │                              │
   │  - host 192.168.0.172:37209│                              │
   │  - host 172.19.0.1:50771   │                              │
   │  - srflx 27.113.30.12:50771│                              │
   │                            │                              │
   │  POST /api/ice             │                              │
   │─────────────────────────────────────────────────────────▶│
   │                            │                              │
   │                            │  Server candidates (in SDP): │
   │                            │  - host 127.0.0.1:50089      │
   │                            │  - host 127.0.0.1:50063      │
   │                            │  - srflx 27.113.30.12:50019  │
   │                            │                              │
   │  ICE connectivity checks (STUN Binding on each pair)     │
   │◀════════════════════════════════════════════════════════▶│
   │                            │                              │
   │  Best pair selected → DTLS handshake → SRTP established  │
   │═══════════════════ Media flows ═══════════════════════════│
```

---

## 8. API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/register` | No | Register new user |
| POST | `/api/login` | No | Login, returns JWT |

### Rooms

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rooms` | JWT | List all active rooms |
| POST | `/api/rooms` | JWT | Create a new room |
| POST | `/api/rooms/:roomId/reserve` | JWT | Reserve a co-streamer spot |
| POST | `/api/rooms/participant` | JWT | Add participant to room |
| POST | `/api/rooms/:roomId/disconnect` | JWT | Disconnect and cleanup |

### WebRTC Signaling

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/webrtc?roomId=` | JWT | SDP offer/answer exchange |
| POST | `/api/ice?roomId=` | JWT | Trickle ICE candidate |

### HLS Streaming

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/hls/{roomId}/index.m3u8` | **No** | HLS playlist (public) |
| GET | `/api/hls/{roomId}/indexN.ts` | **No** | HLS segment (public) |

> **Note:** HLS endpoints are public because `<video>` elements and hls.js cannot send Authorization headers with segment requests. The route is defined outside the auth middleware in `routes.go`: `r.Static("/api/hls", "./hls")`.

---

## 9. Key Design Decisions & Tradeoffs

### 9.1 SFU vs MCU vs Mesh

We use an **SFU (Selective Forwarding Unit)** pattern:

- The server receives media from each sender and forwards it to all receivers
- No server-side mixing (MCU) — each receiver gets individual tracks
- Scales better than mesh (where each peer connects to every other peer)

### 9.2 In-Memory Room State

Room runtime state (connections, tracks, HLS writer) is kept **in-memory** rather than in the database because:

- WebRTC peer connections are Go objects — they can't be serialized to a database
- RTP packet forwarding happens thousands of times per second — database access would be prohibitively slow
- Tradeoff: state is lost on server restart (rooms must be recreated)

### 9.3 UDP Relay vs Raw Pipe

Using local UDP ports to feed FFmpeg instead of stdin piping because:

- FFmpeg's RTP demuxer requires SDP metadata to interpret RTP packets
- SDP references UDP ports, not file descriptors
- UDP relay is the standard approach for RTP → FFmpeg workflows
- Tradeoff: a few initial packets may be lost (before FFmpeg binds ports), but the 500ms delay mitigates this

### 9.4 Public HLS Endpoints

HLS segments are served without authentication because:

- Browser `<video>` elements don't support custom headers
- hls.js uses `XMLHttpRequest` internally for fetching segments, but adding auth headers requires custom loaders
- For a cooking live stream platform, viewer authentication adds complexity without proportional benefit
- **Future improvement:** Token-based HLS auth (token.go already has the infrastructure for `GenerateToken` / `ValidateToken`)

### 9.5 Transcoding Cost

VP8 → H.264 transcoding is CPU-intensive. Alternatives considered:

- **Direct H.264 from browser**: Some browsers prefer VP8 (Firefox). Forcing H.264 limits browser compatibility.
- **VP8 in HLS**: Not supported by the MPEG-TS container format.
- **CMAF with VP8**: Experimental, poor player support.
- **Current approach**: Accept the CPU cost of transcoding. `ultrafast` preset minimizes it at the expense of larger files.

---

## 10. Troubleshooting & Debugging

### 10.1 Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| ICE connection fails | Docker bridge NAT | Use `network_mode: host` |
| No codecs negotiated | Missing `RegisterDefaultCodecs()` | Add before `NewPeerConnection()` |
| HLS 404 | FFmpeg not producing files | Check FFmpeg stderr in docker logs |
| Black screen in viewer | FFmpeg can't detect video resolution | Increase `-analyzeduration` and `-probesize` |
| HLS options "not used for any stream" | FFmpeg probe failed (0 duration) | Add `-analyzeduration 10000000` |
| ICE candidates arrive before PC | Race condition | Buffer in `PendingICE`, flush after `SetRemoteDescription` |
| Chrome can't play HLS | Chrome has no native HLS support | Use hls.js library |
| `requireNativeComponent` error on web | react-native-webrtc imported on web | Platform-split files (`.native.ts` / `.web.tsx`) |

### 10.2 Useful Debug Commands

```bash
# Backend logs (live tail)
docker logs -f --since=60s backend-foodstream

# Check if FFmpeg is running inside container
docker exec backend-foodstream ps aux | grep ffmpeg

# List HLS files
docker exec backend-foodstream ls -la ./hls/

# Check HLS segment content
docker exec backend-foodstream ls -la ./hls/{roomId}/

# Inspect FFmpeg SDP file
docker exec backend-foodstream cat ./hls/{roomId}/stream.sdp

# Check UDP port binding
docker exec backend-foodstream ss -ulnp | grep ffmpeg

# Test HLS URL directly
curl -s http://localhost:8081/api/hls/{roomId}/index.m3u8

# Check WebRTC UDP ports
docker exec backend-foodstream ss -ulnp | grep 50
```

### 10.3 Backend Log Indicators

**Healthy connection:**

```
connection state has changed: connecting
ICE candidate gathered: udp4 host 127.0.0.1:50089
ICE gathering complete
Answer SDP type=answer length=3884
connection state has changed: connected
track received: audio codec=audio/opus PT=111
track received: video codec=video/VP8 PT=96
starting HLS stream for room {uuid}
[HLS] audio UDP port=46605  video UDP port=43744
[HLS] FFmpeg started (PID 84) for room {uuid}
```

**Unhealthy - FFmpeg probe failure (black screen):**

```
[sdp @ 0x...] Keyframe missing
[sdp @ 0x...] Could not find codec parameters for stream 1 (Video: vp8): unspecified size
Consider increasing the value for the 'analyzeduration'
[out#0/hls] Codec AVOption preset has not been used for any stream
[mpegts] frame size not set
```

---

## File Index

### Backend (`backend/`)

| File | Purpose |
|------|---------|
| `cmd/server/main.go` | Entry point, env vars, DB migration, route setup |
| `internal/routes/routes.go` | All API route definitions |
| `internal/middleware/auth.go` | JWT authentication middleware |
| `internal/middleware/cors.go` | CORS headers (Allow-Origin: *) |
| `internal/modules/room/model.go` | Room struct definition |
| `internal/modules/room/room.go` | Room CRUD, WebRTC signaling, ICE handling, track management |
| `internal/hls/streamer.go` | FFmpeg process management, UDP relay, SDP generation |
| `internal/hls/manager.go` | Stream registry (start/stop/isRunning) |
| `internal/hls/token.go` | HLS access token generation/validation (reserved for future use) |

### Mobile / Web (`mobile/`)

| File | Purpose |
|------|---------|
| `hooks/useWebRTC.ts` | WebRTC lifecycle hook (create/join/stop) |
| `services/streaming.ts` | API client (rooms, signaling, HLS URL) |
| `services/auth.ts` | Authentication service (token storage) |
| `config/env.ts` | API base URL configuration |
| `app/live-rooms.tsx` | Room listing screen |
| `app/live-streaming.tsx` | Streamer screen (host/co-streamer) |
| `app/live-viewer.tsx` | HLS viewer screen |
| `components/HLSPlayer.tsx` | Native HLS player (expo-av) |
| `components/HLSPlayer.web.tsx` | Web HLS player (hls.js) |
| `components/StreamView.native.tsx` | Native WebRTC video (RTCView) |
| `components/StreamView.web.tsx` | Web WebRTC video (`<video srcObject>`) |
| `utils/webrtc.ts` | WebRTC stubs (SSR safe default) |
| `utils/webrtc.native.ts` | Native WebRTC exports (react-native-webrtc) |
| `utils/webrtc.web.tsx` | Web WebRTC exports (browser globals) |
