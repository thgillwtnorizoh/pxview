import { Platform, DeviceEventEmitter } from 'react-native';
import RNFetchBlob from 'rn-fetch-blob';
import CameraRoll from '@react-native-community/cameraroll';
import enhanceSaveImage from '../src/components/HOC/enhanceSaveImage';
import downloadUgoira from '../src/common/helpers/ugoiraDownload';

jest.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  Alert: { alert: jest.fn() },
  PermissionsAndroid: {
    PERMISSIONS: { WRITE_EXTERNAL_STORAGE: 'write' },
    RESULTS: { DENIED: 'denied', NEVER_ASK_AGAIN: 'never' },
    request: jest.fn(),
  },
  DeviceEventEmitter: { emit: jest.fn() },
  Linking: { openSettings: jest.fn() },
}));

jest.mock('react-redux', () => ({
  connect: () => (Component) => Component,
}));

jest.mock('../src/components/Localization', () => ({
  connectLocalization: (Component) => Component,
}));

jest.mock('@react-native-community/cameraroll', () => ({
  saveToCameraRoll: jest.fn(),
}));

jest.mock('rn-fetch-blob', () => ({
  fs: {
    dirs: {
      DocumentDir: '/documents',
      PictureDir: '/pictures',
    },
    isDir: jest.fn(),
    mkdir: jest.fn(),
    scanFile: jest.fn(),
  },
  config: jest.fn(),
}));

jest.mock('../src/common/helpers/ugoiraDownload', () => jest.fn());

const i18n = {
  saveImageStart: 'Saving image',
  saveImagesStart: 'Saving images',
  saveImageSuccess: '{0} saved',
  saveImageError: 'Could not save {0}',
  formatString: (value, name) => value.replace('{0}', name),
};

function createSaveComponent(settings = {}) {
  const SaveComponent = enhanceSaveImage(() => null);
  return new SaveComponent({
    i18n,
    saveImageSettings: {
      userFolderName: null,
      fileName: 'WORK_ID',
      isCreateMangaFolder: false,
      ugoiraExportFormat: 'zip',
      ...settings,
    },
  });
}

const baseWork = {
  workId: 42,
  workTitle: 'Example',
  userId: 99,
  userName: 'Artist',
};

describe('original illustration and manga download preservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    RNFetchBlob.fs.isDir.mockResolvedValue(true);
    RNFetchBlob.fs.mkdir.mockResolvedValue(undefined);
    CameraRoll.saveToCameraRoll.mockResolvedValue(undefined);
    RNFetchBlob.config.mockImplementation(({ path }) => ({
      fetch: jest.fn(async () => ({ path: () => path })),
    }));
    downloadUgoira.mockResolvedValue('/documents/pxviewr/42_p0.zip');
  });

  test('ordinary illustration still downloads one original image as PNG', async () => {
    const instance = createSaveComponent();
    await instance.saveImage({
      ...baseWork,
      workType: 'illust',
      imageUrls: ['https://example.invalid/original.png'],
    });
    expect(RNFetchBlob.config).toHaveBeenCalledTimes(1);
    expect(RNFetchBlob.config.mock.calls[0][0].path).toContain('42_p0.png');
    expect(CameraRoll.saveToCameraRoll).toHaveBeenCalledTimes(1);
    expect(downloadUgoira).not.toHaveBeenCalled();
  });

  test('multi-image manga still downloads every page into configured folder', async () => {
    const instance = createSaveComponent({
      userFolderName: 'USER_ID',
      isCreateMangaFolder: true,
    });
    await instance.saveImage({
      ...baseWork,
      workType: 'manga',
      imageUrls: [
        'https://example.invalid/page-0.png',
        'https://example.invalid/page-1.png',
      ],
    });
    expect(RNFetchBlob.config).toHaveBeenCalledTimes(2);
    const paths = RNFetchBlob.config.mock.calls.map(([config]) => config.path);
    expect(paths).toEqual([
      '/documents/pxviewr/99/42/42_p0.png',
      '/documents/pxviewr/99/42/42_p1.png',
    ]);
    expect(CameraRoll.saveToCameraRoll).toHaveBeenCalledTimes(2);
    expect(downloadUgoira).not.toHaveBeenCalled();
  });

  test('Ugoira selects ZIP exporter without fetching a static PNG', async () => {
    const instance = createSaveComponent({ userFolderName: 'USER_ID' });
    await instance.saveImage({
      ...baseWork,
      workType: 'ugoira',
      imageUrls: ['https://example.invalid/preview.jpg'],
    });
    expect(downloadUgoira).toHaveBeenCalledWith({
      workId: 42,
      format: 'zip',
      destination: '/documents/pxviewr/99/42_p0.zip',
    });
    expect(RNFetchBlob.config).not.toHaveBeenCalled();
    expect(CameraRoll.saveToCameraRoll).not.toHaveBeenCalled();
    expect(DeviceEventEmitter.emit).toHaveBeenCalled();
  });
});
