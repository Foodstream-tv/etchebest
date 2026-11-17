---
title:          Beta Test Plan
subtitle:       FoodStream - Interactive Cooking Streaming Platform
author:         FoodStream Team
module:         G-EIP-700
version:        1.0
---

## **1. Project Context**

**FoodStream** is an ongoing Epitech Innovation Project that aims to create an interactive cooking streaming platform. The platform enables culinary enthusiasts to connect through live cooking sessions in a unique and collaborative way.

### How it works

- **Host Streaming**: A main streamer (Chef) can host a live cooking session, teaching recipes in real-time
- **Co-Streamers**: Up to five co-streamers can join the session to follow along, share their screen or camera, and interact directly with the host
- **Viewers**: Unlimited viewers can watch live sessions or replays without restrictions
- **Discovery**: Users can explore cuisines by country, category, trending dishes, and featured chefs
- **Social Features**: Users can follow chefs, save favorite recipes, and build their cooking profile

### Technical Architecture

- **WebRTC**: Powers real-time communication between the streamer and co-streamers with low-latency audio, video, and screen sharing
- **HLS (HTTP Live Streaming)**: Enables scalable delivery to unlimited viewers through segmented video streaming
- **FFmpeg**: Bridges WebRTC and HLS by converting live WebRTC streams into HLS format for broad distribution
- **Mobile App**: Built with React Native (Expo) for iOS and Android
- **Backend**: Go-based API with PostgreSQL database

---

## **2. User Roles**

The following roles will be involved in beta testing:

|   **Role Name**   | **Description**                                                                                                    |
|-------------------|--------------------------------------------------------------------------------------------------------------------|
| Viewer            | Can register, login, browse, search, watch lives/replays, follow/unfollow chefs, save favorites, and view profile. |
| Chef (Streamer)   | Can create/join rooms, start/end live sessions, manage stream settings, and interact with co-streamers.            |
| Co-Streamer       | Can join rooms as participants, share camera/screen, interact in live sessions.                                    |
| Admin             | Can view/manage all users, moderate content, and access all endpoints.                                             |

---

## **3. Feature Table**

All of the listed features will be demonstrated during the beta presentation:

| **Feature ID** | **User Role** | **Feature Name**     | **Short Description**                                        |
|----------------|---------------|----------------------|--------------------------------------------------------------|
| F1             | Everyone      | Create an account    | A new user registers with their email and profile details.   |
| F2             | Everyone      | Log in to the app    | A user authenticates to access their personalized dashboard. |
| F3             | Everyone      | Browse the home feed | Explore live sessions, upcoming events, and featured chefs.  |
| F4             | Everyone      | Search for content   | Search for specific live streams by dish name or chef.       |
| F5             | Everyone      | Filter live streams  | Narrow down live sessions by culinary tags or countries.     |
| F6             | Viewer        | Watch a live stream  | Join an ongoing cooking session and view the live HLS feed.  |
| F7             | Viewer        | Follow a chef        | Subscribe to a chef's profile to see their future updates.   |
| F8             | Viewer        | Manage profile       | View and update personal information and preferences.        |
| F9             | Chef          | Host a live stream   | Start a real-time broadcast with camera and audio.           |
| F10            | Chef          | Schedule a room      | Reserve a future time slot for a cooking session.            |
| F11            | Co-Streamer   | Join as participant  | Connect to a Chef's live room to share camera or screen.     |
| F12            | Chef/Co-Str   | Disconnect stream    | Properly exit a room and terminate the live broadcast.       |
| F13            | Admin         | Moderate users       | View a list of all users and manage account statuses.        |

---

## **4. Success Criteria**

| **Feature ID** | **Key Success Criteria**                    | **Indicator/Metric**         | **Result** |
|----------------|---------------------------------------------|------------------------------|------------|
| F1             | Registration creates user in DB             | 20 attempts, 0 failures      |            |
| F2             | Login returns valid JWT token               | 25 attempts, 0 failures      |            |
| F3             | Home feed returns featured/upcoming/chefs   | 20 calls, all sections present |            |
| F4             | Search returns relevant lives               | 30 queries, <2s response     |            |
| F5             | Filters narrow lives by tag/country         | 15 filter tests, all correct |            |
| F6             | Live stream is viewable via HLS             | 15 viewers, average latency < 10s |            |
| F7             | Follow action persists in DB                | 10 follows, all persisted    |            |
| F8             | Profile updates are saved                   | 10 updates, all reflected    |            |
| F9             | Host can create/join room and start WebRTC  | 10 sessions, 90% success     |            |
| F10            | Room reservation persists | 10 reserves, all successful | |
| F11            | Co-Streamer joins as participant | 10 joins, all reflected | |
| F12            | Disconnect cleans up room | 10 disconnects, no leaks | |
| F13            | Admin can list all users | 5 calls, all users returned | |

---
