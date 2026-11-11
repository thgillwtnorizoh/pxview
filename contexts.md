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
