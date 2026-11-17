# Changelog

## [0.3.0](https://github.com/Foodstream-tv/etchebest/compare/v0.2.0...v0.3.0) (2026-11-17)


### Nouveautés

* **hls:** renditions have the size of their rung, whatever the source ([#398](https://github.com/Foodstream-tv/etchebest/issues/398)) ([cde8c12](https://github.com/Foodstream-tv/etchebest/commit/cde8c128aba1f4fd431169b01f8335ad0094f793))
* **live:** sliding-window live playlist, whitelisted HLS serving, SDP out of the served tree, orphan janitor ([#390](https://github.com/Foodstream-tv/etchebest/issues/390)) ([27f60e8](https://github.com/Foodstream-tv/etchebest/commit/27f60e8a11be4e2dca62852f8593473b7c58b462)), closes [#234](https://github.com/Foodstream-tv/etchebest/issues/234)
* **replays:** newest first, dates on cards, a recently added row and load more ([#393](https://github.com/Foodstream-tv/etchebest/issues/393)) ([e8c99d3](https://github.com/Foodstream-tv/etchebest/commit/e8c99d38784bf4d7110709ee68722ff291b010f0))
* **server:** end the running lives on SIGTERM, then exit 0 ([#413](https://github.com/Foodstream-tv/etchebest/issues/413)) ([696af45](https://github.com/Foodstream-tv/etchebest/commit/696af4595e35750a813d9b707073819f6c233240))
* **web:** a running live invites to cook with the chef; the live player behind a switch ([#415](https://github.com/Foodstream-tv/etchebest/issues/415)) ([d28b3fa](https://github.com/Foodstream-tv/etchebest/commit/d28b3fad8a08d9d25daf061da863b79c0080aa67))


### Corrections

* **api:** bound request bodies, buffered ICE candidates and chat messages ([#426](https://github.com/Foodstream-tv/etchebest/issues/426)) ([04f5f07](https://github.com/Foodstream-tv/etchebest/commit/04f5f07d812ee4f4c93b5a068b85660e512c5b5e))
* **api:** keep drafts and withdrawn replays out of the public lists ([#430](https://github.com/Foodstream-tv/etchebest/issues/430)) ([bf55b47](https://github.com/Foodstream-tv/etchebest/commit/bf55b47da3eb7d6ff3788a3f159aa99007498673))
* **auth:** end the sessions issued before a password change or reset ([#429](https://github.com/Foodstream-tv/etchebest/issues/429)) ([6d2e87d](https://github.com/Foodstream-tv/etchebest/commit/6d2e87dc6f03eeb17107c57cd857a790477afa31))
* **auth:** tighten the account verification endpoint ([#427](https://github.com/Foodstream-tv/etchebest/issues/427)) ([c3684bd](https://github.com/Foodstream-tv/etchebest/commit/c3684bd76cd7787499e847883709d4ad1e1bf050))
* **auth:** verify the Google token of the mobile sign-in ([#425](https://github.com/Foodstream-tv/etchebest/issues/425)) ([280708f](https://github.com/Foodstream-tv/etchebest/commit/280708fbc76c45cc45aff3d05ab84dce344cdf52))
* **hls:** check that a served live file is inside the live tree ([#399](https://github.com/Foodstream-tv/etchebest/issues/399)) ([b6f21fb](https://github.com/Foodstream-tv/etchebest/commit/b6f21fb98b669bdf87923e3729c81dd57d165a91))
* **hls:** no false error while FFmpeg has not written the master playlist yet ([#414](https://github.com/Foodstream-tv/etchebest/issues/414)) ([0d9f97c](https://github.com/Foodstream-tv/etchebest/commit/0d9f97cef277486407e8faf6cb395c1a3f3a8eec))
* **hls:** reject ".." in a requested live path, the check CodeQL recognizes ([#403](https://github.com/Foodstream-tv/etchebest/issues/403)) ([a5c5a50](https://github.com/Foodstream-tv/etchebest/commit/a5c5a509418bef27ed721d76f31b5d2c7f5cfffc))
* **live:** end a live outside the global lock ([#405](https://github.com/Foodstream-tv/etchebest/issues/405)) ([4a52e5f](https://github.com/Foodstream-tv/etchebest/commit/4a52e5f02edb1fc4da8e2e3a1e34924eae512830))
* **live:** frozen first seconds, slow and lossy end of live, empty studio while ending ([#392](https://github.com/Foodstream-tv/etchebest/issues/392)) ([1a6ff08](https://github.com/Foodstream-tv/etchebest/commit/1a6ff08fc03fb0da854a18b61efa54d89f8df966))
* **live:** reconcile lives on boot and end a live whose host does not come back ([#404](https://github.com/Foodstream-tv/etchebest/issues/404)) ([67568f4](https://github.com/Foodstream-tv/etchebest/commit/67568f48e11635a748f539bce9ac615afd74e29d))
* **mobile:** default Studio slot is never refused near the hour ([#401](https://github.com/Foodstream-tv/etchebest/issues/401)) ([bac2fd6](https://github.com/Foodstream-tv/etchebest/commit/bac2fd65490de2e9e884d6134162817c52ffe984))
* **mobile:** default the Google web client to the project's own client ([#428](https://github.com/Foodstream-tv/etchebest/issues/428)) ([b196084](https://github.com/Foodstream-tv/etchebest/commit/b196084d4e687993f152ca3c49b8293f6fcf945b))
* **replay:** do not publish a replay whose master lists no rendition ([#408](https://github.com/Foodstream-tv/etchebest/issues/408)) ([194a834](https://github.com/Foodstream-tv/etchebest/commit/194a834a75cf565991a4f6043c7bab1818170116))
* **web:** restore the session from a valid cookie and clear a refused one ([#391](https://github.com/Foodstream-tv/etchebest/issues/391)) ([996c70c](https://github.com/Foodstream-tv/etchebest/commit/996c70cb615095e0ae8637cafead54a26e11b167))
* **webrtc:** hold renegotiations until the answer to a join is sent ([#407](https://github.com/Foodstream-tv/etchebest/issues/407)) ([c05470d](https://github.com/Foodstream-tv/etchebest/commit/c05470da37f175fa2f504dfc022931616d767c3b))


### Performances

* **web:** compress the heavy images of the web front ([#422](https://github.com/Foodstream-tv/etchebest/issues/422)) ([dbd562c](https://github.com/Foodstream-tv/etchebest/commit/dbd562c60ba4d35776909df0a007a73736ae8d1b))


### Refactorisation

* **room:** fix the SonarQube warnings of room.go ([#406](https://github.com/Foodstream-tv/etchebest/issues/406)) ([32cb27a](https://github.com/Foodstream-tv/etchebest/commit/32cb27a2bca83a7ab38aecddfcca75b1d4e21bfa))


### Documentation

* contributor guide for the private backlog, and ignore every local env file ([#424](https://github.com/Foodstream-tv/etchebest/issues/424)) ([594306e](https://github.com/Foodstream-tv/etchebest/commit/594306e5659c20ef793fc12486d8cbc67024ae58))
* **readme:** drop the pointer to the open production issues ([#423](https://github.com/Foodstream-tv/etchebest/issues/423)) ([f930d36](https://github.com/Foodstream-tv/etchebest/commit/f930d36f1c91953198a8f5fbde581098a5a0a607))

## [0.2.0](https://github.com/Foodstream-tv/etchebest/compare/v0.1.2...v0.2.0) (2026-11-04)


### Nouveautés

* **mobile:** studio form in steps with progress, motion and utensils ([#343](https://github.com/Foodstream-tv/etchebest/issues/343)) ([7973c94](https://github.com/Foodstream-tv/etchebest/commit/7973c94f52bd1f46a391933d90c95b3e3bd14863))

## [0.1.2](https://github.com/Foodstream-tv/etchebest/compare/v0.1.1...v0.1.2) (2026-10-25)


### Corrections

* **security:** chemins HLS limités au dossier de la room, texte utilisateur nettoyé dans les e-mails ([#373](https://github.com/Foodstream-tv/etchebest/issues/373)) ([16f2e53](https://github.com/Foodstream-tv/etchebest/commit/16f2e533f45f652ecce8f94e3516bd3c29ff17b1))

## [0.1.1](https://github.com/Foodstream-tv/etchebest/compare/v0.1.0...v0.1.1) (2026-10-25)


### Corrections

* **backend:** image Docker en Go 1.26, et build des images Docker en CI ([#372](https://github.com/Foodstream-tv/etchebest/issues/372)) ([eb5b5a2](https://github.com/Foodstream-tv/etchebest/commit/eb5b5a2f497ba773a51483f3f0862d35948bd93a))
* **web:** un seul gestionnaire de paquets (npm), Next 16.4.3 dans l'image Docker ([#370](https://github.com/Foodstream-tv/etchebest/issues/370)) ([5393a90](https://github.com/Foodstream-tv/etchebest/commit/5393a9002ce6fdcb9add2df7e7ca59f6fdfdb284))
