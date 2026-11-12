# PxView — Engineering Context

Last updated: 2026-11-11

## Standing project instructions

- Repository: https://github.com/thgillwtnorizoh/pxview
- Owner permits direct repository modifications for authorized work.
- After **each development task**, create or update this root `contexts.md` with implementation details, changed files, verification, blockers, and next steps.
- Preserve existing functionality and UI unless the task directly requires a change.
- Baseline: `master` at `ff75b0ac08e8d6621ba5413f285fe5585a8572be` (PxView R 5.3.0).
- Development branch: `feature/u01-ugoira-download`.
- Draft review PR: https://github.com/thgillwtnorizoh/pxview/pull/1
- U01-A implementation commits: `449992b95406eed51015087f9988c4133cb25728`, `24800b6c05850fb3b12f27aa4db75e38270d3061`, `e22a53cc33a127485dfe4f1cc28b902e15e0025c`, `b9a8fb315a771f5046dc54ce4e274bf7dc306401`.

## U01 mission

Goal: the existing download button recognizes Ugoira and exports the animation according to a persistent format preference in Save Image Settings. Exports must honor existing work names, creator folders, save locations, and notifications. Static illustrations and manga downloads must remain unchanged.

### Source audit

- `src/components/HOC/enhanceSaveImage.js` previously saved any image URL as `.png`, even when `workType === 'ugoira'`.
- `src/screens/Shared/Detail.js` already passes `workType` in header and long-press download actions; no change is required there.
- `src/common/sagas/ugoiraMeta.js` already calls `pixiv.ugoiraMetaData(illustId)` and exposes ZIP URL and individual frame delays.
- `src/components/UgoiraViewTouchable.js` already downloads and extracts Ugoira for display, independently of the export workflow.
- Existing `react-native-zip-archive@^5.0.2` supports native `zip` / `unzip` on Android and iOS.
- React Native 0.63.5 / Android target 29 are legacy. The original FFmpegKit is retired, and FFmpegKitNext (actively maintained) distributes native binaries as source-only builds. Native encoder feasibility is not yet established.

### U01-A implemented — ZIP source export with timing preservation

- Route Ugoira exports away from the image-only downloader without changing the original image/manga branch.
- Download the highest Pixiv API archive explicitly offered (usually the mobile API's **medium / 600x600**, or `zip_urls.original` if provided), unzip to a unique temporary directory, verify all requested frame files, write `animation.json` with `frames[].file` and each `frames[].delay` (milliseconds), then re-ZIP and save.
- Reject malformed metadata, duplicate or unsafe frame names, missing frames, unexpected HTTP status, and empty output archives.
- Create a separate temporary working directory per request; clean it in a `finally` block.
- Filename uses the existing image title/work ID preference, ending in `_p0.zip`; folder location follows existing creator-folder settings.
- Existing notifications announce start, success or failure. Existing filename overwrite semantics preserved.
- Adds `ugoiraExportFormat` to Redux Save Image Settings with default `zip`; persistence, backup and restore already serialize the settings object.
- Adds localized Ugoira format labels (en, ja, zh, zh-TW, zh-HK, zh-MO). The setting currently shows the **only implemented export format, Ugoira ZIP**; it is **not** labeled lossless or original-quality when the API returns medium frames.
- Enables iOS Files visibility for Documents exports; ZIP cannot be stored in the Photos camera roll.
- Adds unit tests for timing, frame ordering, unsafe/missing metadata, and extension handling.

### Changed files
- `src/common/helpers/ugoiraMetadata.js` (new)
- `src/common/helpers/ugoiraDownload.js` (new)
- `src/components/HOC/enhanceSaveImage.js`
- `src/common/constants/index.js`
- `src/common/reducers/saveImageSettings.js`
- `src/common/actions/saveImageSettings.js`
- `src/screens/MyPage/SaveImageSettings.js`
- `src/common/constants/strings/{en,ja,zh,zh-TW,zh-HK,zh-MO}.json`
- `ios/PxViewR/Info.plist`
- `__tests__/ugoiraMetadata.spec.js` (new)
- `contexts.md` (new)

### Verification / limits
- All 6 localization JSON files parsed successfully. Pure metadata parser executed in a V8 isolated harness: frame ordering, total duration, path rejection, duplicate rejection, filename extension checked. Downloader flow was executed in a mock filesystem using actual committed source, verifying archive creation, timing JSON, file move and cleanup, plus missing-frame failure and cleanup. These are **not** Jest or device integration tests.
- No npm install, Jest execution, Android/iOS build, or Pixiv-authenticated device test performed yet.
- **U01 is not complete.** Current code supports only ZIP + timing JSON. GIF, MP4, WebM are **not** available until native encoding is implemented and tested.
- Pixiv's mobile API often offers only `zip_urls.medium` (compressed 600x600 archive); U01-A does not fabricate the full-resolution 1920x1080 URL. Full-resolution acquisition remains a separate verified integration task.
- ZIP exports must be tested on Android/iOS including ZIP archive contents, iOS Files exposure, error handling, and Android scoped storage. Legacy Android 29 permissions may fail on modern Android versions.
- Output overwrite is not transactional: a complete staged ZIP is made before replacing a previous same-name destination; if final move fails after replacement, the previous file might be lost.
- Downloader has no explicit cancellation UI, matching the original save workflow.

### Follow-up
1. Run Jest and real Android/iOS ZIP export checks; fix device-specific issues and test normal image/manga regression.
2. Evaluate FFmpegKitNext integration, its LGPL obligations, required native binary builds, and compatibility with the legacy RN toolchain.
3. Implement and verify variable-frame-duration GIF/MP4/WebM converters; show each format as selectable only once demonstrably functional.
4. Add codec-specific photo/gallery behavior, robust cancellation/progress as needed, then perform U01 full acceptance testing.
5. Update `contexts.md` after every task.

## U01-B — CI baseline and ZIP regression verification (2026-11-11)

### Scope and current status
- Authorized to create Android and iOS GitHub Actions builds after successful test runs; platform build success is required for acceptance of each development task.
- No pre-existing `.github/workflows` directory or Actions runs existed at the beginning of U01-B.
- GitHub retired `macos-14` on **2026-11-02**; CI uses `macos-15-intel` for old native dependencies, with iOS simulator build and code signing disabled.
- Added `.github/workflows/pxview-ci.yml` with three jobs: JavaScript Jest tests, Android SDK 29 debug APK, and iOS simulator build. Builds depend on successful tests and run in parallel.
- Uses Node 14.21.3 and existing npm `package-lock.json` (v1), JDK 8 for Gradle 6.2/AGP 3.5.3, Android build-tools 29.0.2, CocoaPods and Xcode on a supported macOS 15 runner.
- Android Firebase `google-services.json` and iOS `GoogleService-Info.plist` are excluded from source control; CI generates **nonfunctional build-only dummy configurations**. Never use CI artifacts as configured production applications.
- Uploads the built Android debug APK and unsigned iOS simulator .app when successful, plus iOS build logs on failure. The simulator .app is not an installable signed IPA.

### Tests added
- `__tests__/ugoiraDownload.spec.js`: mocks network/file/archive calls; verifies frame order, variable-duration manifest, output file, missing-frame failure with previous export intact, HTTP errors, workspace cleanup, iOS media-scan distinction, and refusal of unsupported formats.
- `__tests__/saveImageSettings.spec.js`: defaults, retention of legacy settings, old backup compatibility, new setting restoration.
- `__tests__/saveImageRegression.spec.js`: exercises the actual existing HOC against mocked native dependencies to check single-image and multi-image PNG downloads, filename/folder settings, iOS camera-roll delivery, and new Ugoira dispatch without a preview-image fetch.
- Original `__tests__/ugoiraMetadata.spec.js` and existing auth-saga tests remain.

### Pending verification at time of commit
- Initial Actions runs triggered after CI introduction: [push #43039541460](https://github.com/thgillwtnorizoh/pxview/actions/runs/43039541460) and [PR #43039544618](https://github.com/thgillwtnorizoh/pxview/actions/runs/43039544618). Initial jobs entered dependency installation; tests/build results not yet verified. CI concurrency now shares a branch-based group to prevent expensive duplicate push/PR builds.
- The real Firebase integration is deliberately not tested by placeholder configs.
- No Android device or iOS simulator runtime verification of Ugoira ZIP export yet; compiling successfully is necessary but not sufficient.
- Avoid broad changes to Android Gradle, CocoaPods, native libraries and unrelated application source unless job logs demonstrate a specific blocker.

### CI execution log
- Initial GitHub Actions push and PR runs for `54875e5` completed with **test failure**. `npm ci` successfully installed 1,740 packages (around 411 seconds). Existing auth saga, Ugoira metadata and settings suites passed (31 assertions), while `ugoiraDownload.spec.js` failed during module initialization with `TypeError: Cannot read property 'DocumentDir' of undefined` from `rn-fetch-blob/fs.js`; its Jest mock was not in effect early enough. No Android or iOS build started because build jobs require passing tests.
- Fix: converted native-dependent test imports to explicit `require()` statements **after** `jest.mock()` registration in both Ugoira downloader and image/manga regression tests; runtime implementation code unchanged. Re-running CI.
- Initial evidence: https://github.com/thgillwtnorizoh/pxview/actions/runs/43039541460 and https://github.com/thgillwtnorizoh/pxview/actions/runs/43039544618.

### U01-B CI attempt #2 — test gate passed, native setup findings

- At `368b91f5816907b75165b87705490e32e93551e0`, GitHub Actions run [#43040932406](https://github.com/thgillwtnorizoh/pxview/actions/runs/43040932406) executed Jest with **5/5 suites and 39/39 tests passing**.
- The Android job failed **before Gradle**: `android-actions/setup-android@v3` installed Android cmdline-tools 16, which requires JDK 17, but Java 8 was already selected. The Android build itself was not executed.
- CI correction: Java 17 for SDK setup and SDK package installation, then Java 8 for Gradle 6.2 / AGP 3.5.3. The app Java/Gradle dependencies are left unchanged.
- The existing iOS Xcode project did not contain a shared `PxViewR` scheme (only the tvOS scheme); added a minimal shared application scheme to support `xcodebuild -workspace ... -scheme PxViewR` without changing native application sources.
- Added explicit iOS npm cache restore/save **after npm installation but before CocoaPods** to keep dependencies cached even when a later native build fails.
- These changes supersede the in-progress iOS job in the prior CI attempt; native build results must be obtained from the new commit.

### U01-B CI attempt #3 — diagnosed from completed Actions logs (2026-11-11)

- Evidence: [run #43042704928](https://github.com/thgillwtnorizoh/pxview/actions/runs/43042704928) at source `20f0f3512d73f9bc7ec668931aad6143a8c7fed5`.
- JavaScript regression tests **PASS: 5/5 suites, 39/39 tests**.
- **Android FAIL before Gradle**: `android-actions/setup-android@v3` default package list contains `tools`, which is retired; log: `Warning: Failed to find package 'tools'`. JDK 17 fixed the preceding SDK-manager error, but this new package-list blocker prevented actual Android app compilation.
- **iOS FAIL before Xcode build**: `pod install --repo-update` reached legacy `Flipper-Glog 0.3.6`, whose configure script defaulted to unsupported `-arch armv7` on Xcode 16.4: `C compiler cannot create executables`. This optional debugging tool is not essential to app runtime.
- Narrow fixes: specify `packages: 'platform-tools'` to the Android SDK setup action; skip only optional Flipper initialization in `ios/Podfile` when `CI=true`, retaining normal developer/local Flipper behavior; capture CocoaPods logs as failure artifacts.
- **No app runtime/source changes**. New Android and iOS Actions builds must execute again; successful Jest alone is insufficient for U01-B acceptance.

### U01-B CI retry after failed native builds (2026-11-11)
- Checked [run #43050954352](https://github.com/thgillwtnorizoh/pxview/actions/runs/43050954352) at `f21a284acda873ed5bcdc70bebd843abbeb6c45e`. JavaScript: **39/39 tests PASS**. Android: **FAIL** resolving `me.relex:photodraweeview:1.1.3` for `react-native-photo-view-ex` (JCenter-only legacy dependency). iOS: **FAIL** installing React Native's `glog 0.3.5` during `pod install`; its native configure script assumed `armv7` and the Xcode 16.4 SDK cannot compile it.
- Android scoped resolution fix: override only `me.relex:photodraweeview:1.1.3` to upstream `2.1.0` served by Maven Central. **Compatibility must be confirmed by Android build and runtime photo-view tests**; source compatibility has not been proven.
- iOS CI-only fix: set `PLATFORM_NAME=iphonesimulator` and `CURRENT_ARCH=x86_64` during CocoaPods install to avoid unsupported `armv7` in the React Native glog prepare script. No app runtime code modified.
- Do not claim passing Android/iOS builds until their next GitHub Actions run reports success; check any new blockers in job logs. Persistent npm caching may not prevent multi-minute reinstalls.

- Follow-up CI correction: `android/build.gradle` must declare `mavenCentral()` inside `allprojects.repositories`; the existing Maven Central declaration in `android/app/build.gradle` does not supply dependencies to the `:react-native-photo-view-ex` subproject. Scoped version substitution alone is insufficient without a repository that publishes `2.1.0`.

### U01-B CI attempt #5 — Xcode Yoga and Android Flipper blockers (2026-11-12)

- [Run #43056421345](https://github.com/thgillwtnorizoh/pxview/actions/runs/43056421345) at `287e46ccb3b637824187775d1f4237314cec0a91` finished: Jest **PASS 5/5 suites (39/39 tests)**; Android **FAIL** at `:app:debugRuntimeClasspath`: `com.facebook.fresco:flipper:2.4.0` and `com.facebook.fresco:stetho:2.4.0` unavailable via the legacy `com.facebook.flipper:flipper-fresco-plugin:0.87.0`; iOS **FAIL** compiling React Native 0.63.5 `Yoga.cpp:2285`: `-Werror,-Wbitwise-instead-of-logical` with Xcode 16.4.
- Android CI-only build workaround: guard three optional Flipper dependencies in `android/app/build.gradle` and exclude `src/debug/.../ReactNativeFlipper.java` from the CI debug source set under Gradle project flag `-PpxviewCiNoFlipper=true`. The production application's `MainApplication` uses reflection and gracefully tolerates a missing Flipper bootstrap. **Normal local builds retain all Flipper dependencies and source**; the CI APK therefore validates the app without the optional debugging UI, not the exact full developer-debug dependency set.
- iOS CI-only workaround: append targeted `-Wno-error=bitwise-instead-of-logical` to the `Yoga` CocoaPods target's `OTHER_CPLUSPLUSFLAGS` in `post_install`, preserving the legacy Yoga source and all other Clang warnings/errors.
- These are build-configuration edits, not Ugoira feature edits. Re-run tests and **both** GitHub Actions native builds. Do not claim app artifact success until Actions jobs and artifact uploads pass. Signed installable iOS IPA and device/runtime regression tests remain out of scope.

### U01-B CI attempt #6 (2026-11-12) — Android legacy annotations

- [Run #43131060440](https://github.com/thgillwtnorizoh/pxview/actions/runs/43131060440) at `6625dbfa36e96e2c0f79b3d88488906d65052c57`: Jest **PASS**, Android **FAIL** in `:react-native-photo-view-ex:compileDebugJavaWithJavac`: `android.support.annotation.NonNull`/`IntDef` symbols missing after AndroidX migration. This occurred after clearing the unavailable Flipper dependencies; `-PpxviewCiNoFlipper=true` reached Java compilation.
- iOS at the time of preparing this correction: CocoaPods **PASS**, Xcode progressed past the prior Yoga.cpp `-Werror` failure; final iOS job result pending.
- Targeted Android CI-only fix: after `npm ci`, rewrite the two confirmed `import android.support.annotation.` statements in the installed `react-native-photo-view-ex` Java sources to `androidx.annotation.`, and add `androidx.annotation:annotation:1.1.0` to that module's compile dependencies. Assert that exactly two files are rewritten; fail CI if upstream package structure changes.
- This is an **external native-library compatibility shim** in the GitHub Actions job; it does not modify Ugoira code or checked-in npm dependencies. A local developer build using an unpatched install may still need a durable dependency modernization. Further CI/native runtime verification remains required.

### U01-B CI attempt #6 final results — 2026-11-12

- [Run #43131060440](https://github.com/thgillwtnorizoh/pxview/actions/runs/43131060440) on `6625dbfa36e96e2c0f79b3d88488906d65052c57`: Jest **PASS**; Android **FAIL** compiling `react-native-photo-view-ex` legacy `android.support.annotation.NonNull`/`IntDef`; iOS **FAIL** Xcode 16.4 compiling `RNZipArchive`: `unsupported option '-G' for target x86_64/arm64-apple-ios9.0-simulator`.
- Earlier iOS `Yoga.cpp` error was cleared by the targeted CI-only `-Wno-error=bitwise-instead-of-logical` setting; CocoaPods installed successfully and Xcode compiled many pods before the next blocker.
- **iOS root cause directly verified against `mockingbot/react-native-zip-archive` tag `v5.0.2`, `RNZipArchive.podspec`**: `s.compiler_flags = '-GCC_PREPROCESSOR_DEFINITIONS="HAVE_INTTYPES_H ..."'`. Modern Clang treats this as a removed `-G` option. GitHub upstream issue #316 describes the same Xcode 16 failure; issue #317 notes removing this flag allows compiling without upgrading to a new major ZIP library.
- CI-only fix: after installing npm dependencies but before `pod install`, remove **only** the obsolete `s.compiler_flags` line from the installed `react-native-zip-archive/RNZipArchive.podspec`, failing fast if it no longer matches exactly one entry. No distribution dependency or app source updates. Verify that ZIP behavior works at runtime after native builds.
- The earlier prepared Android CI-only import adaptation for two `react-native-photo-view-ex` Java files is included in the same revision to avoid cancelling an active iOS job. New Actions jobs must be checked before acceptance.

## U01-B CI diagnosis — run #17 (2026-11-12; inspection only)

- Source: `ad359d70d7cb4f3e08aa3e6f577c161fa2f3469a` on `feature/u01-ugoira-download`; [run #43134528208](https://github.com/thgillwtnorizoh/pxview/actions/runs/43134528208). Independent inspection of GitHub Actions job logs (no code fixes or rebuilds in this diagnosis).
- Run history as inspected: 17 workflow runs (7 failure, 10 cancelled). Push and PR events trigger for the same branch; the branch-based `concurrency` group with `cancel-in-progress: true` cancels overlapping runs and runs superseded by later commits. Cancellations should not be counted as compiler/test failures.
- Latest Jest: **PASS, 5 suites / 39 tests**, `npm ci` and Jest completed in the JavaScript job.
- Latest Android debug: SDK setup, npm installation, previous `react-native-photo-view-ex` AndroidX CI shim all passed. `./gradlew ... :app:assembleDebug` then **FAILED** at `:react-native-share:compileDebugJavaWithJavac` with **19 Java errors**: legacy imports `android.support.annotation.NonNull/Nullable` and `android.support.v4.content.CursorLoader/FileProvider` missing from AndroidX build classpath. Exact examples: `node_modules/react-native-share/android/src/main/java/cl/json/RNSharePathUtil.java:12-14`, `RNShareModule.java:7`, `RNShareFileProvider.java:3`. This is a distinct legacy-library source incompatibility from the earlier photo-view failure; the fix needs to address all affected symbols and verify compile/runtime behavior, not blindly mask Java errors.
- Latest iOS simulator: npm installation and `pod install` passed, `RNZipArchive` `-G` CI fix succeeded. `xcodebuild` then **FAILED** compiling `ios/PxViewR/AppDelegate.m:12`: `'FlipperKit/FlipperClient.h' file not found`. Under `CI=true`, `ios/Podfile` intentionally omits `use_flipper!` but `ios/PxViewR.xcodeproj/project.pbxproj` still defines `FB_SONARKIT_ENABLED=1` for the Debug configuration; the guarded imports and `InitializeFlipper` block in `AppDelegate.m` still activate. Make CI's Flipper omission consistent with its preprocessor flags, ideally in a narrowly scoped/reversible way that preserves local debug behavior.
- Prior Android blockers, now passed or bypassed in CI: SDK tools/JDK version mismatch, retired Android SDK `tools` package, old JCenter `photodraweeview` artifact, optional Flipper dependency resolution, `react-native-photo-view-ex` AndroidX annotations. Prior iOS blockers, now passed or bypassed in CI: missing Xcode shared scheme, legacy glog armv7 setup, Yoga boolean bitwise `-Werror`, RNZipArchive obsolete `-G` compiler flag.
- Warnings such as Node 20 action-runtime deprecation and an optional `node-gyp` failure during successful `npm ci` do **not** explain the latest failing native steps.
- Next steps: (1) adapt/patch `react-native-share` source imports and classpath for AndroidX, (2) disable the iOS Flipper build macro when Flipper pods are disabled in CI, (3) run Jest first, (4) build Android debug and iOS simulator, and (5) verify native artifacts and actual Ugoira export on devices. Additional compatibility blockers are possible in this legacy stack and should be diagnosed from new logs rather than presumed resolved.
- This diagnosis did **not** change app code and did **not** verify native build success or device functionality.
