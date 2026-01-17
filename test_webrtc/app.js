const roomId = "40f87349-aa15-43b4-a958-788381b1a05d";
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJiMDFjZjMxOC03NTA4LTQ4MWUtOTBjMS0yMTViNmI1ZGRjNmIiLCJyb2xlIjoiQURNSU4iLCJleHAiOjE3NjY4MzUxNDd9.9OZ1wUh4dpyYoabS_tAwbjPwMKlEqIAcPbe5Htqo4ZI";
const baseURL = "http://localhost:8081";

async function pollRemoteICE() {
  const res = await fetch(`${baseURL}/api/ice?roomId=${roomId}`, {
    headers: { "Authorization": "Bearer " + token }
  });

  if (res.ok) {
    const candidates = await res.json();
    if (Array.isArray(candidates)) {
      for (const c of candidates) {
        try {
          await pc.addIceCandidate(c);
        } catch(e) {
          console.warn("Erreur ajout ICE candidate distante:", e);
        }
      }
    }
  }
  setTimeout(pollRemoteICE, 2000);
}

async function start() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  const localVideo = document.getElementById("localVideo");
  const remoteVideo = document.getElementById("remoteVideo");

  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

  stream.getTracks().forEach(track => pc.addTrack(track, stream));
  localVideo.srcObject = stream;

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onicecandidate = async (event) => {
    if (event.candidate) {
      await fetch(`${baseURL}/api/ice?roomId=${roomId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify(event.candidate)
      });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const resp = await fetch(`${baseURL}/api/webrtc?roomId=${roomId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + token
    },
    body: JSON.stringify(pc.localDescription)
  });

  const answer = await resp.json();

  await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });

  

  pollRemoteICE();
}

start();
