# Dena (`dena-app`)

Dena হলো Bengali loan, interest, usury, and munafa management app for personal lenders and small finance tracking.  

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white" alt="Capacitor 8" />
  <img src="https://img.shields.io/badge/Android-Supported-3DDC84?logo=android&logoColor=white" alt="Android Supported" />
</p>
<p align="center">
  <img src="https://img.shields.io/badge/WorkManager-androidx.work-4285F4" alt="Android WorkManager" />
  <img src="https://img.shields.io/badge/ESLint-Code%20Quality-4B32C3?logo=eslint&logoColor=white" alt="ESLint" />
  <img src="https://img.shields.io/badge/GitHub%20Actions-Release%20APK-2088FF?logo=githubactions&logoColor=white" alt="GitHub Actions Release APK" />
</p>

## Tech Stack

- `React 19` + `Vite 8`
- `Capacitor 8` (`@capacitor/android`, `@capacitor/core`)
- `Android WorkManager` (`androidx.work:work-runtime`)
- `ESLint` (code quality)
- `GitHub Actions` (Android signed APK build + release)

## PC-তে কী কী software লাগবে

- `Node.js` (LTS, ভাল হলে 22+)
- `npm` (Node এর সাথে থাকে)
- `Java JDK 21` (Android Gradle build এর জন্য)
- `Android Studio` (Android SDK + Build Tools + Platform Tools)
- `Git` (GitHub push/pull এর জন্য)

Windows হলে command চালাতে:

- `PowerShell` বা `CMD`

## কী কী আছে

- নতুন হিসাব, এডিট, মুছুন, পরিশোধিত/চলতি স্ট্যাটাস
- অটো মুনাফা সেটিংস (`5000 -> 500` টাইপ রুল)
- মুনাফা নেওয়ার ব্যবধান (দিন)
- অটো ব্যাকআপ, ম্যানুয়াল ব্যাকআপ, রিস্টোর
- প্রথমবার অ্যাপ খোলার সময় সেটিংস অটো ওপেন
- ছবি আপলোড, ক্রপ, বড় করে দেখা, ডাউনলোড

## লোকাল চালাতে

প্রথমে project clone করুন:

```bash
git clone https://github.com/onelifeproject/dena-app
cd dena-app
```

তারপর dependency install করে app চালান:

```bash
npm install
npm run dev
```

## Android build

```bash
npm run android:release
```

APK path:

- `android/app/build/outputs/apk/release/app-release.apk`

Debug build check:

```bash
cd android
gradlew.bat assembleDebug
```

## Version কোথায় বদলাবেন

ফাইল:

- `android/app/build.gradle`

`defaultConfig` এর ভিতরে:

- `versionCode` (প্রতি রিলিজে বাড়াতে হবে)
- `versionName` (যেমন: `2.7`)

## GitHub Actions release

Workflow:

- `.github/workflows/build-android.yml`

Push দিলে:

- signed APK build হয়
- artifact upload হয়
- `android/app/build.gradle` থেকে `versionName`/`versionCode` পড়ে
- `versionName` থেকে tag/release হয় (যেমন: `v3.8`)
- APK release asset হিসেবে attach হয় (যেমন: `Dena-v3.8.apk`)
- নতুন release তৈরি হলে `CHANGELOG.md` থেকে matching `## vX.Y` সেকশন GitHub release notes হিসেবে যায়

Release করার আগে `CHANGELOG.md`-এ নতুন ভার্সন সেকশন লিখে `versionName`/`versionCode` বাড়ান।

## ব্যাকআপ সম্পর্কে

- ম্যানুয়াল ব্যাকআপে পুরো অ্যাপ ডেটা JSON ফাইলে সেভ হয়
- রিস্টোর দিলে আগের ডেটা ফেরত আসে
- অটো ব্যাকআপ:
  - Settings থেকে ON/OFF
  - দিন সেট করা যায়
  - Android-এ `WorkManager` দিয়ে background check/run হয়

## দরকারি command

```bash
npm run lint
npm run build
```
