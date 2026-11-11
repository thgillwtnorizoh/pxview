import { Platform } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import { unzip, zip } from 'react-native-zip-archive';
import pixiv from '../src/common/helpers/apiClient';
import downloadUgoira from '../src/common/helpers/ugoiraDownload';

jest.mock('rn-fetch-blob', () => ({
  fs: {
    dirs: { CacheDir: '/cache' },
    mkdir: jest.fn(),
    exists: jest.fn(),
    writeFile: jest.fn(),
    stat: jest.fn(),
    mv: jest.fn(),
    unlink: jest.fn(),
    scanFile: jest.fn(),
  },
  config: jest.fn(),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(),
  zip: jest.fn(),
}));

jest.mock('../src/common/helpers/apiClient', () => ({
  __esModule: true,
  default: { ugoiraMetaData: jest.fn() },
}));

describe('Ugoira ZIP download integration', () => {
  const fs = RNFetchBlob.fs;
  let files;
  let originalPlatform;

  beforeAll(() => {
    originalPlatform = Platform.OS;
  });

  afterAll(() => {
    Platform.OS = originalPlatform;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
    files = new Map();
    pixiv.ugoiraMetaData.mockResolvedValue({
      ugoira_metadata: {
        zip_urls: { medium: 'https://example.invalid/frames.zip' },
        frames: [
          { file: '001.jpg', delay: 55 },
          { file: '000.jpg', delay: 120 },
        ],
      },
    });
    fs.mkdir.mockImplementation(async (path) => {
      files.set(path, { directory: true });
    });
    fs.exists.mockImplementation(async (path) => files.has(path));
    fs.writeFile.mockImplementation(async (path, data) => {
      files.set(path, { data });
    });
    fs.stat.mockImplementation(async (path) => ({
      size: files.has(path) ? 1024 : 0,
    }));
    fs.unlink.mockImplementation(async (path) => {
      [...files.keys()].forEach((key) => {
        if (key === path || key.startsWith(`${path}/`)) files.delete(key);
      });
    });
    fs.mv.mockImplementation(async (from, to) => {
      if (!files.has(from)) throw new Error('Missing output');
      files.set(to, files.get(from));
      files.delete(from);
    });
    fs.scanFile.mockResolvedValue(undefined);
    RNFetchBlob.config.mockImplementation(({ path }) => ({
      fetch: jest.fn(async () => {
        files.set(path, { data: 'zip bytes' });
        return { info: () => ({ status: 200 }) };
      }),
    }));
    unzip.mockImplementation(async (source, dest) => {
      files.set(`${dest}/001.jpg`, { data: 'frame 1' });
      files.set(`${dest}/000.jpg`, { data: 'frame 2' });
    });
    zip.mockImplementation(async (source, dest) => {
      files.set(dest, { data: 'packaged zip' });
    });
  });

  test('writes original playback order, timing and output to destination', async () => {
    const dest = '/pictures/pxviewr/42_p0.zip';
    const saved = await downloadUgoira({
      workId: 42, destination: dest, format: 'zip',
    });
    expect(saved).toBe(dest);
    expect(files.has(dest)).toBe(true);
    expect(pixiv.ugoiraMetaData).toHaveBeenCalledWith(42);
    expect(zip).toHaveBeenCalledTimes(1);
    const write = fs.writeFile.mock.calls.find(([path]) =>
      path.endsWith('/animation.json'));
    expect(write).toBeDefined();
    const manifest = JSON.parse(write[1]);
    expect(manifest.durationMs).toBe(175);
    expect(manifest.frames).toEqual([
      { file: '001.jpg', delay: 55 },
      { file: '000.jpg', delay: 120 },
    ]);
    expect(manifest.sourceQuality).toBe('medium');
    expect(fs.scanFile).toHaveBeenCalledWith([{ path: dest }]);
    expect(fs.unlink.mock.calls.some(([path]) => path.includes('pxviewr-ugoira-export'))).toBe(true);
  });

  test('missing Ugoira frame aborts without replacing an existing download', async () => {
    const dest = '/pictures/pxviewr/42_p0.zip';
    files.set(dest, { data: 'previous archive' });
    unzip.mockImplementationOnce(async (source, dir) => {
      files.set(`${dir}/001.jpg`, { data: 'only first frame' });
    });
    await expect(downloadUgoira({
      workId: 42, destination: dest, format: 'zip',
    })).rejects.toThrow('Ugoira frame is missing: 000.jpg');
    expect(files.get(dest)).toEqual({ data: 'previous archive' });
    expect(zip).not.toHaveBeenCalled();
    expect(fs.unlink.mock.calls.some(([path]) => path.includes('pxviewr-ugoira-export'))).toBe(true);
  });

  test('failed HTTP request is rejected and temporary files are cleaned', async () => {
    RNFetchBlob.config.mockImplementationOnce(({ path }) => ({
      fetch: jest.fn(async () => {
        files.set(path, { data: 'error response' });
        return { info: () => ({ status: 403 }) };
      }),
    }));
    await expect(downloadUgoira({
      workId: 42, destination: '/pictures/42_p0.zip', format: 'zip',
    })).rejects.toThrow('HTTP 403');
    expect(zip).not.toHaveBeenCalled();
    expect(fs.unlink.mock.calls.length).toBeGreaterThan(0);
  });

  test('iOS skips Android media scan for documents exports', async () => {
    Platform.OS = 'ios';
    await downloadUgoira({
      workId: 42, destination: '/documents/42_p0.zip', format: 'zip',
    });
    expect(fs.scanFile).not.toHaveBeenCalled();
  });

  test('rejects unavailable formats rather than saving a false extension', async () => {
    await expect(downloadUgoira({
      workId: 42, destination: '/pictures/42_p0.mp4', format: 'mp4',
    })).rejects.toThrow('not supported');
    expect(pixiv.ugoiraMetaData).not.toHaveBeenCalled();
  });
});
