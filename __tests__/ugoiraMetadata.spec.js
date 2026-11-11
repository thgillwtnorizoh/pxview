import {
  parseUgoiraMetadata, getUgoiraFileName, UGOIRA_EXPORT_FORMATS,
} from '../src/common/helpers/ugoiraMetadata';

const payload = {
  ugoira_metadata: {
    zip_urls: { medium: 'https://example.com/source.zip' },
    frames: [
      { file: '000001.jpg', delay: 60 },
      { file: '000000.jpg', delay: 120 },
    ],
  },
};

describe('Ugoira download metadata', () => {
  test('preserves frame order and variable playback delays', () => {
    const { manifest } = parseUgoiraMetadata(payload, 123);
    expect(manifest.frames).toEqual(payload.ugoira_metadata.frames);
    expect(manifest.durationMs).toBe(180);
  });

  test('rejects unsafe paths, duplicate frames, and invalid delay values', () => {
    for (const frames of [
      [{ file: '../escape.jpg', delay: 10 }],
      [{ file: '1.jpg', delay: 10 }, { file: '1.jpg', delay: 20 }],
      [{ file: '1.jpg', delay: 0 }],
      [],
    ]) {
      expect(() => parseUgoiraMetadata({
        ugoira_metadata: { ...payload.ugoira_metadata, frames },
      }, 123)).toThrow();
    }
  });

  test('retains existing filename convention with the right extension', () => {
    expect(getUgoiraFileName('123_p0.png', UGOIRA_EXPORT_FORMATS.ZIP)).toBe('123_p0.zip');
    expect(() => getUgoiraFileName('123_p0.png', 'mp4')).toThrow();
  });
});
