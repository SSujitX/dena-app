# Android Release Signing Setup

Use this once to make all future APK/AAB updates install over previous versions without package conflict.

## Current app capability snapshot

The Android build currently includes (see `.agents/AGENTS.md` for full domain rules):

- **হিসাব রক্ষক** — Bengali loan/munafa tracker (`com.dena.app`, currently v3.8 / versionCode 28)
- Fixed **কিস্তি** schedule from `startDate + n×interval` (Asia/Dhaka); munafa joma covers oldest unpaid slot
- Loan add/edit with optional document proof (camera/gallery, crop, WebP compression)
- Loan details + payment history; JPG proof save to `Documents/Dena/`
- Responsive Settings: backup/restore, auto backup (WorkManager), munafa preset + interval, in-app APK update
- Kisti reminder notifications via `getLoanDueState()`
- Dynamic footer year range in Bengali digits

## Why this matters

Android accepts app updates only when both are true:

1. Same `applicationId` (currently `com.dena.app`)
2. Same signing key (keystore + alias)

If signing key changes, Android shows package conflict / app not installed.

## No GitHub secrets required (repo signing)

This repo is configured to sign release builds in GitHub Actions using files committed in the repository (private repo use case).

Required files in repo:

- `android/keystore/signing.properties.example`
- `android/keystore/signing.properties`
- `android/keystore/dena-release.keystore`

## Create your keystore once (local)

Run in PowerShell:

```powershell
keytool -genkeypair -v -keystore dena-release.keystore -alias dena -keyalg RSA -keysize 2048 -validity 10000
```

You will choose:

- keystore password
- key alias (`dena` or your chosen alias)
- key password

Save this keystore safely. Never lose it.

## Configure local signing file

Create `android/keystore/signing.properties` using this format:

```properties
storeFile=keystore/dena-release.keystore
storePassword=YOUR_KEYSTORE_PASSWORD
keyAlias=dena
keyPassword=YOUR_KEY_PASSWORD
```

Place your keystore file at:

- `android/keystore/dena-release.keystore`

## Build outputs

GitHub workflow builds signed release APK:

- Artifact name: `Dena-Android-v<versionName>-<versionCode>`
- APK filename: `Dena-v<versionName>.apk`

You can still build locally with the same signing files:

```powershell
npm run build
npx cap sync android
cd android
.\gradlew clean assembleRelease
```

Release outputs:

- `android/app/build/outputs/apk/release/app-release.apk`

## Build environment notes (important)

- CI uses Java 21 (`actions/setup-java`) and Gradle wrapper from the repo.
- Prefer Java 21 locally for Android release tasks.
- If local build shows `Unsupported class file major version 70`, your local JDK is too new for current Gradle/AGP pairing; switch local JAVA_HOME to JDK 21.
- `flatDir` repository warning has been removed from `android/app/build.gradle` (no local `.aar/.jar` libs currently used).

## Versioning rule per release

Before push / CI release:

1. Add a `## vX.Y (...)` section to `CHANGELOG.md` (must match `versionName`).
2. In `android/app/build.gradle`, bump:
   - `versionCode` by +1 each release
   - `versionName` as semantic version (`3.8`, `3.9`, etc.)

GitHub Actions reads that changelog section into the release notes when creating a new tag.

Do not change `applicationId` after public install.
