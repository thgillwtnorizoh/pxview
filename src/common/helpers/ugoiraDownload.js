import { Platform } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import { unzip, zip } from 'react-native-zip-archive';
import pixiv from './apiClient';
import { parseUgoiraMetadata, UGOIRA_EXPORT_FORMATS } from './ugoiraMetadata';

// Independent workspaces prevent concurrent exports from clobbering each other.
let nextExportId = 0;

export default async function downloadUgoira({ workId, destination, format }) {
  if (format !== UGOIRA_EXPORT_FORMATS.ZIP) {
    throw new Error('Ugoira export format is not supported');
  }
  const response = await pixiv.ugoiraMetaData(workId);
  const { zipUrl, manifest } = parseUgoiraMetadata(response, workId);
  const { fs } = RNFetchBlob;
  nextExportId += 1;
  const workDir = `${fs.dirs.CacheDir}/pxviewr-ugoira-export-${workId}-${Date.now()}-${nextExportId}`;
  const sourceZip = `${workDir}/source.zip`;
  const framesDir = `${workDir}/frames`;
  const stagedArchive = `${workDir}/staged.zip`;

  try {
    await fs.mkdir(workDir);
    await fs.mkdir(framesDir);
    const downloaded = await RNFetchBlob.config({ path: sourceZip }).fetch(
      'GET', zipUrl, { referer: 'http://www.pixiv.net' },
    );
    const status = downloaded.info().status;
    if (status < 200 || status >= 300) {
      throw new Error(`Ugoira download failed (HTTP ${status})`);
    }
    await unzip(sourceZip, framesDir);
    // Do not silently export an incomplete animation.
    for (const frame of manifest.frames) {
      if (!(await fs.exists(`${framesDir}/${frame.file}`))) {
        throw new Error(`Ugoira frame is missing: ${frame.file}`);
      }
    }
    await fs.writeFile(
      `${framesDir}/animation.json`,
      JSON.stringify(manifest, null, 2), 'utf8',
    );
    await zip(framesDir, stagedArchive);
    const stat = await fs.stat(stagedArchive);
    if (!Number(stat.size)) {
      throw new Error('Ugoira archive is empty');
    }
    // Existing save behavior overwrites an identical filename.
    if (await fs.exists(destination)) {
      await fs.unlink(destination);
    }
    await fs.mv(stagedArchive, destination);
    if (Platform.OS === 'android') {
      try {
        await fs.scanFile([{ path: destination }]);
      } catch (err) {
        // Best effort; the saved file does not depend on media indexing.
      }
    }
    return destination;
  } finally {
    try {
      if (await fs.exists(workDir)) {
        await fs.unlink(workDir);
      }
    } catch (err) {
      // Cleanup failure must not hide the original error.
    }
  }
}
