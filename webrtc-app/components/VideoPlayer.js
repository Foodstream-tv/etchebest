import { useEffect, useRef, useState } from "react";

export default function VideoPlayer() {
  const localVideoRef = useRef(null);
  const remoteVideosRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [pc, setPc] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [roomName, setRoomName] = useState("");

  useEffect(() => {
    const savedRoomId = localStorage.getItem("roomId");
    if (savedRoomId) setRoomId(savedRoomId);
  }, []);

  const createRoom = async () => {
    if (!roomName) return alert("Please enter a room name");

    try {
      const response = await fetch("https://supereloquently-idiophonic-millie.ngrok-free.dev/createRoom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName }),
      });

      const data = await response.json();
      if (data.roomId) {
        setRoomId(data.roomId);
        localStorage.setItem("roomId", data.roomId);
      }
    } catch (err) {
      console.error("Failed to create room:", err);
    }
  };

  const joinRoom = async () => {
    if (!roomId) return alert("Please enter a room ID");

    const peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        fetch(`https://supereloquently-idiophonic-millie.ngrok-free.dev/ice?roomId=${roomId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(event.candidate),
        }).catch((err) => console.error("Failed to send ICE candidate:", err));
      }
    };

    peerConnection.ontrack = (event) => {
      console.log("Receiving track:", event.track.kind);
      const stream = event.streams[0];
      const existingVideo = Array.from(remoteVideosRef.current.children).find(
        (vid) => vid.srcObject === stream
      );

      if (!existingVideo) {
        const newVideo = document.createElement("video");
        newVideo.srcObject = stream;
        newVideo.autoplay = true;
        newVideo.playsInline = true;
        remoteVideosRef.current.appendChild(newVideo);
      }
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      stream.getTracks().forEach((track) => {
        console.log(`Adding local track: ${track.kind}`);
        peerConnection.addTrack(track, stream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      const response = await fetch(`https://supereloquently-idiophonic-millie.ngrok-free.dev/webrtc?roomId=${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sdp: offer.sdp, type: offer.type }),
      });

      const data = await response.json();

      if (!data.sdp) return console.error("Failed to get SDP answer");
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription({ type: "answer", sdp: data.sdp })
      );

      setPc(peerConnection);
    } catch (err) {
      console.error("Failed to join room:", err);
    }
  };

  const leaveRoom = () => {
    if (pc) {
      pc.getSenders().forEach((sender) => pc.removeTrack(sender));
      pc.close();
      setPc(null);
      setLocalStream(null);
      remoteVideosRef.current.innerHTML = "";
      alert("You have left the room");
    }
  };

  return (
    <div>
      <input
        type="text"
        value={roomName}
        onChange={(e) => setRoomName(e.target.value)}
        placeholder="Enter room name"
      />
      <button onClick={createRoom}>Create Room</button>
      <button onClick={joinRoom}>Join Room</button>
      <button onClick={leaveRoom}>Leave Room</button>

      <h2>Your Stream:</h2>
      <video ref={localVideoRef} autoPlay muted playsInline style={{ width: "300px" }} />

      <h2>Remote Streams:</h2>
      <div ref={remoteVideosRef}></div>
    </div>
  );
}

// https://supereloquently-idiophonic-millie.ngrok-free.dev
