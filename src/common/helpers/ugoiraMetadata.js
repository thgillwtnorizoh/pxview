// Pure validation: never invent missing Pixiv Ugoira frames or frame durations.
export const UGOIRA_EXPORT_FORMATS = { ZIP: 'zip' };

export function parseUgoiraMetadata(response, illustId) {
  const metadata = response && response.ugoira_metadata;
  const urls = metadata && metadata.zip_urls;
  const sourceQuality = urls && urls.original ? 'original' : 'medium';
  const zipUrl = urls && (urls.original || urls.medium);
  const frames = metadata && metadata.frames;
  if (typeof zipUrl !== 'string' || !/^https:\/\//i.test(zipUrl) ||
      !Array.isArray(frames) || !frames.length) {
    throw new Error('Invalid Pixiv Ugoira metadata');
  }
  const seen = new Set();
  const normalizedFrames = frames.map(({ file, delay }) => {
    if (typeof file !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(file) ||
        file === '.' || file === '..' || file === 'animation.json' ||
        seen.has(file) || !Number.isFinite(delay) || delay <= 0) {
      throw new Error('Invalid Pixiv Ugoira frame metadata');
    }
    seen.add(file);
    return { file, delay };
  });
  return {
    zipUrl,
    manifest: {
      type: 'pixiv-ugoira',
      version: 1,
      illustId,
      sourceQuality,
      frames: normalizedFrames,
      durationMs: normalizedFrames.reduce((total, frame) => total + frame.delay, 0),
    },
  };
}

export function getUgoiraFileName(imageFileName, format) {
  if (format !== UGOIRA_EXPORT_FORMATS.ZIP) {
    throw new Error('Ugoira export format is not supported');
  }
  if (typeof imageFileName !== 'string' || !/\.png$/i.test(imageFileName)) {
    throw new Error('Invalid image filename');
  }
  return imageFileName.replace(/\.png$/i, '.zip');
}
