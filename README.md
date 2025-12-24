# etchebest

## What is Foodstream
Foodstream is an ongoing Epitech Innovation Project that aims to create an interactive cooking streaming platform. A main streamer can host a live cooking session and allow up to five co streamers to join in real time. While the host teaches the recipe, co streamers can follow along, share their screen or camera, and interact directly. Viewers can also watch the session without any limit.

## How WebRTC Fits In

WebRTC is used to manage all real time communication between the streamer and the co streamers. It provides low latency audio, video, and screen sharing, which makes the cooking session feel like a live interactive workshop. WebRTC handles peer connections, media capture, and data exchange so that participants can communicate smoothly without noticeable delay.

## How HLS Is Used

While WebRTC is ideal for real time interaction, it is not suited for large audiences. To make the stream available to unlimited viewers, Foodstream uses HLS. HLS delivers video as small segments that can be easily cached and distributed, making it scalable and reliable. Viewers watch the stream through a simple HTTP based playlist that their browser or player can load progressively.

## How FFmpeg Connects the Two

To bridge real time WebRTC streams with scalable HLS output, Foodstream uses FFmpeg. FFmpeg receives the live WebRTC media from the main streamer and converts it into an HLS format in real time. It generates the video segments and the playlist that viewers use to watch the stream. This setup allows the platform to offer low latency interaction for co streamers while still supporting a large number of viewers without performance issues.
