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
