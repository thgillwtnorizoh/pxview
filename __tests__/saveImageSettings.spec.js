import reducer from '../src/common/reducers/saveImageSettings';
import {
  setSettings,
  restoreSettings,
} from '../src/common/actions/saveImageSettings';

describe('existing save settings and Ugoira format preference', () => {
  test('defaults to ZIP and retains existing filename/folder settings', () => {
    expect(reducer(undefined, { type: '@@INIT' })).toEqual({
      userFolderName: null,
      fileName: 'WORK_ID',
      isCreateMangaFolder: false,
      ugoiraExportFormat: 'zip',
    });
  });

  test('changing a pre-existing setting does not reset the format', () => {
    const initial = reducer(undefined, { type: '@@INIT' });
    const changed = reducer(initial, setSettings({
      fileName: 'WORK_ID_WORK_TITLE',
    }));
    expect(changed.fileName).toBe('WORK_ID_WORK_TITLE');
    expect(changed.ugoiraExportFormat).toBe('zip');
  });

  test('old backups without Ugoira fields restore with ZIP default', () => {
    const initial = reducer(undefined, { type: '@@INIT' });
    const oldBackup = {
      fileName: 'WORK_TITLE',
      userFolderName: 'USER_ID',
      isCreateMangaFolder: true,
    };
    expect(reducer(initial, restoreSettings(oldBackup))).toEqual({
      ...oldBackup,
      ugoiraExportFormat: 'zip',
    });
  });

  test('new backups retain the saved Ugoira format setting', () => {
    const initial = reducer(undefined, { type: '@@INIT' });
    const updated = reducer(initial, setSettings({ ugoiraExportFormat: 'zip' }));
    expect(reducer(initial, restoreSettings(updated)).ugoiraExportFormat).toBe('zip');
  });
});
