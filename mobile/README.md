# etchebest
EIP

## Getting Started

To start the development server:
```bash
npx expo start
```

## Running on Device/Simulator

The `android/` and `ios/` folders are not committed: they are generated from `app.json` by `npx expo prebuild`
(`expo run:*` does it when they are missing). Native settings go in `app.json` or a config plugin, never in those
folders. After pulling a change to `app.json`, the plugins or the Expo SDK, regenerate them:
```bash
npx expo prebuild --clean
```

To run on Android:
```bash
npx expo run:android
```

To run on iOS:
```bash
npx expo run:ios
```

## Building the App

To build for production:
```bash
npx expo build:android
npx expo build:ios
```

## Re-running the Project

If you need to restart the development server:
```bash
npx expo start -c
```
