# RCT Application — Android

> **Status: not yet built.** `apps/mobile` is reserved for the Expo project.
> This document records the agreed approach and the exact commands that will
> produce an APK, so the build path is settled before the code lands.

---

## Approach

**Expo (React Native) with the bare workflow available when needed.**

Chosen over native Kotlin because the mobile app talks to the same Supabase
project and reuses `packages/types`, so ticket statuses, SLA states and
transition rules cannot drift between web and mobile. A native rewrite would
duplicate every screen and every API call for no functional gain.

- Package name: `com.rct.application`
- Application name: **RCT Application**
- Minimum SDK: 24 (Android 7.0) — covers effectively the whole field fleet
- Target SDK: 35

---

## Planned scope

**Engineer (the priority — this is a field tool)**

- Sign in, biometric unlock for subsequent launches
- Today's jobs, sorted by SLA urgency
- Ticket detail with the full timeline
- Accept / start travel / arrived / start work / pause / complete
- Camera capture for before-and-after photos, uploaded straight to Storage
- Parts and materials capture
- Diagnosis and work-performed entry
- On-screen customer signature capture
- Resolve and close, triggering the service report

**Customer**

- Raise a complaint, with photo attachment
- Track ticket status and timeline
- Comment on a ticket
- View and download the service report
- Rate a completed visit

**Management**

- Dashboard summary
- Open and breached ticket lists
- Approve and reassign

---

## Once the project exists

### Prerequisites

- Node.js 20+
- **Android Studio** with SDK Platform 35 and Build-Tools 35
- **JDK 17** (Android Gradle Plugin 8 requires it; JDK 21 also works)
- `ANDROID_HOME` set to your SDK location

### Install and configure

```bash
cd apps/mobile
npm install
cp ../../.env.example .env
```

Fill in:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_API_URL=https://your-deployment.vercel.app
```

Only the anon key ever reaches the device. The service role key must never
be bundled into a mobile application — anyone can extract strings from an
APK, and that key bypasses Row Level Security entirely.

### Run in development

```bash
npx expo start            # then press 'a' for an Android device or emulator
npx expo start --tunnel   # if the phone is not on the same network
```

---

## Building the APK

### Local Gradle build (no Expo account needed)

```bash
cd apps/mobile

# Generate the native android/ directory from app.json
npx expo prebuild --platform android --clean

cd android

# Debug APK — installable immediately, no signing configuration required
./gradlew assembleDebug
# Output: android/app/build/outputs/apk/debug/app-debug.apk

# Release APK — requires a signing keystore, see below
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk

# Android App Bundle, for Google Play
./gradlew bundleRelease
# Output: android/app/build/outputs/bundle/release/app-release.aab
```

On Windows use `gradlew.bat` instead of `./gradlew`.

Rename the artefact for distribution:

```bash
cp android/app/build/outputs/apk/debug/app-debug.apk ./RCT-Application-debug.apk
```

### EAS Build (Expo's cloud builders)

```bash
npm i -g eas-cli
eas login
eas build:configure

eas build --platform android --profile preview     # APK
eas build --platform android --profile production  # AAB for Play
```

`eas.json`:

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" },
      "distribution": "internal"
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

EAS manages the signing keystore for you, which is convenient but means Expo
holds the upload key. For a keystore you control, use the local Gradle build.

---

## Release signing

**No signing keys are included in this repository, and none should be
invented.** Generate your own and keep it somewhere it cannot be lost — if
the upload key for a published app is lost, you cannot ship updates to
existing installs without Google's key-reset process.

### 1. Generate a keystore

```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore rct-release.keystore \
  -alias rct-release \
  -keyalg RSA -keysize 2048 -validity 10000
```

Answer the prompts with the real company details. Store the keystore and
both passwords in your password manager. **Do not commit the keystore.**

### 2. Point Gradle at it

Create `apps/mobile/android/gradle.properties` (this file is gitignored):

```properties
RCT_UPLOAD_STORE_FILE=rct-release.keystore
RCT_UPLOAD_KEY_ALIAS=rct-release
RCT_UPLOAD_STORE_PASSWORD=********
RCT_UPLOAD_KEY_PASSWORD=********
```

Place the keystore at `apps/mobile/android/app/rct-release.keystore` and add
to `android/app/build.gradle`:

```gradle
android {
    signingConfigs {
        release {
            if (project.hasProperty('RCT_UPLOAD_STORE_FILE')) {
                storeFile     file(RCT_UPLOAD_STORE_FILE)
                storePassword RCT_UPLOAD_STORE_PASSWORD
                keyAlias      RCT_UPLOAD_KEY_ALIAS
                keyPassword   RCT_UPLOAD_KEY_PASSWORD
            }
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            shrinkResources true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. Build and verify

```bash
cd apps/mobile/android
./gradlew assembleRelease

# Confirm the APK is signed
$ANDROID_HOME/build-tools/35.0.0/apksigner verify --verbose \
  app/build/outputs/apk/release/app-release.apk
```

---

## Permissions

Request only what is actually used, and only at the point of use:

| Permission | Why | When requested |
|---|---|---|
| `CAMERA` | Before-and-after photographs on site | When the engineer taps "Add photo" |
| `READ_MEDIA_IMAGES` | Attaching an existing photo | When the engineer taps "Choose from gallery" |
| `ACCESS_FINE_LOCATION` | Stamping a site-visit checkpoint | When the engineer taps "Arrived on site" |
| `INTERNET` | API access | Implicit |
| `POST_NOTIFICATIONS` | Assignment and SLA alerts | On first sign-in |

**Location is captured only at explicit stage transitions.** There is no
background location tracking, no foreground service, and no continuous
polling. This matches the specification and avoids the Play Store
background-location declaration process entirely.

---

## App icon and splash screen

Place in `apps/mobile/assets/`:

| File | Size | Purpose |
|---|---|---|
| `icon.png` | 1024×1024 | Base application icon |
| `adaptive-icon.png` | 1024×1024 | Android adaptive foreground (keep artwork inside the central 66%) |
| `splash.png` | 1284×2778 | Launch screen |
| `notification-icon.png` | 96×96 | White-on-transparent status bar icon |

`app.json`:

```json
{
  "expo": {
    "name": "RCT Application",
    "slug": "rct-application",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0F172A"
    },
    "android": {
      "package": "com.rct.application",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0F172A"
      },
      "permissions": [
        "CAMERA",
        "ACCESS_FINE_LOCATION",
        "READ_MEDIA_IMAGES",
        "POST_NOTIFICATIONS"
      ]
    }
  }
}
```

Increment `versionCode` on every upload to Play — Google rejects a duplicate.

---

## Troubleshooting

**`SDK location not found`** — set `ANDROID_HOME`, or create
`android/local.properties` containing `sdk.dir=/path/to/Android/sdk`.

**`Could not determine java version`** — Gradle is picking up the wrong JDK.
Set `JAVA_HOME` to a JDK 17 or 21 installation.

**Build succeeds, app crashes on launch** — almost always missing
`EXPO_PUBLIC_*` variables. They are inlined at build time, so a `.env`
added after the build has no effect. Rebuild.

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** — a debug and a release APK cannot
coexist. Uninstall the existing app first.

**Signature capture feels laggy** — ensure the canvas view sets
`touch-action: none` equivalent and that the gesture handler is not being
re-created on every render.
