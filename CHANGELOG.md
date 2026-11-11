# Changelog

## [0.3.0](https://github.com/Foodstream-tv/etchebest/compare/v0.2.0...v0.3.0) (2026-11-11)


### Nouveautés

* **hls:** renditions have the size of their rung, whatever the source ([#398](https://github.com/Foodstream-tv/etchebest/issues/398)) ([d963ac8](https://github.com/Foodstream-tv/etchebest/commit/d963ac89ce63f6981ecba68229174d2b1b31f339))
* **live:** sliding-window live playlist, whitelisted HLS serving, SDP out of the served tree, orphan janitor ([#390](https://github.com/Foodstream-tv/etchebest/issues/390)) ([4ebe74a](https://github.com/Foodstream-tv/etchebest/commit/4ebe74a91dcd28d623b9b2f0190fc8ba29b1ae6c)), closes [#234](https://github.com/Foodstream-tv/etchebest/issues/234)
* **replays:** newest first, dates on cards, a recently added row and load more ([#393](https://github.com/Foodstream-tv/etchebest/issues/393)) ([c5978bf](https://github.com/Foodstream-tv/etchebest/commit/c5978bfccb0ee0a842ed44729afe31ff6d186b83))
* **server:** end the running lives on SIGTERM, then exit 0 ([#413](https://github.com/Foodstream-tv/etchebest/issues/413)) ([b164b1d](https://github.com/Foodstream-tv/etchebest/commit/b164b1defb2fe890fa0e89056c6aed7c16711ea0))
* **web:** a running live invites to cook with the chef; the live player behind a switch ([#415](https://github.com/Foodstream-tv/etchebest/issues/415)) ([0bc39f5](https://github.com/Foodstream-tv/etchebest/commit/0bc39f585caa9146cb7378c623792f1d05a6aa89))


### Corrections

* **hls:** check that a served live file is inside the live tree ([#399](https://github.com/Foodstream-tv/etchebest/issues/399)) ([459878e](https://github.com/Foodstream-tv/etchebest/commit/459878e1895f5c395a252c3bc41eea2dbacbd6d7))
* **hls:** no false error while FFmpeg has not written the master playlist yet ([#414](https://github.com/Foodstream-tv/etchebest/issues/414)) ([edb39d2](https://github.com/Foodstream-tv/etchebest/commit/edb39d2530dccfdb9487dcbf7f6606f1d0a34f32))
* **hls:** reject ".." in a requested live path, the check CodeQL recognizes ([#403](https://github.com/Foodstream-tv/etchebest/issues/403)) ([7bec098](https://github.com/Foodstream-tv/etchebest/commit/7bec0989c0ea260a4d98421104b9bdaebb778109))
* **live:** end a live outside the global lock ([#405](https://github.com/Foodstream-tv/etchebest/issues/405)) ([fc4f428](https://github.com/Foodstream-tv/etchebest/commit/fc4f428aa4091ff9ebb428fcebecbc4fe196e6c4))
* **live:** frozen first seconds, slow and lossy end of live, empty studio while ending ([#392](https://github.com/Foodstream-tv/etchebest/issues/392)) ([c99da3f](https://github.com/Foodstream-tv/etchebest/commit/c99da3fa7e28f8ffd1cb4b64af3f615e36ce51b7))
* **live:** reconcile lives on boot and end a live whose host does not come back ([#404](https://github.com/Foodstream-tv/etchebest/issues/404)) ([b3c63a1](https://github.com/Foodstream-tv/etchebest/commit/b3c63a1d9d24db35ff8db400984fa802fabfd7ad))
* **mobile:** default Studio slot is never refused near the hour ([#401](https://github.com/Foodstream-tv/etchebest/issues/401)) ([27f9095](https://github.com/Foodstream-tv/etchebest/commit/27f909587a1e45ba3ac3b153743b2d0c2682bd4d))
* **replay:** do not publish a replay whose master lists no rendition ([#408](https://github.com/Foodstream-tv/etchebest/issues/408)) ([88329b9](https://github.com/Foodstream-tv/etchebest/commit/88329b91162b2ec6c494c202f112ee3dd1520d7d))
* **web:** restore the session from a valid cookie and clear a refused one ([#391](https://github.com/Foodstream-tv/etchebest/issues/391)) ([633582d](https://github.com/Foodstream-tv/etchebest/commit/633582dc0f0ec5460dea2b0ff7e9ed5f4dda29bf))
* **webrtc:** hold renegotiations until the answer to a join is sent ([#407](https://github.com/Foodstream-tv/etchebest/issues/407)) ([11ea952](https://github.com/Foodstream-tv/etchebest/commit/11ea9523b7f05925dc0dd5fa5540dd366ef92d1e))


### Refactorisation

* **room:** fix the SonarQube warnings of room.go ([#406](https://github.com/Foodstream-tv/etchebest/issues/406)) ([a8efb72](https://github.com/Foodstream-tv/etchebest/commit/a8efb729c6486e434c9e802f2ae385331faa25e4))

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
