import { SAVE_IMAGE_SETTINGS } from '../constants/actionTypes';
import { SAVE_FILE_NAME_FORMAT, UGOIRA_EXPORT_FORMATS } from '../constants';

const initState = {
  userFolderName: null,
  fileName: SAVE_FILE_NAME_FORMAT.WORK_ID,
  isCreateMangaFolder: false,
  ugoiraExportFormat: UGOIRA_EXPORT_FORMATS.ZIP,
};

export default function saveImageSettings(state = initState, action) {
  switch (action.type) {
    case SAVE_IMAGE_SETTINGS.SET:
      return {
        ...state,
        userFolderName:
          action.payload.userFolderName !== undefined
            ? action.payload.userFolderName
            : state.userFolderName,
        fileName:
          action.payload.fileName !== undefined
            ? action.payload.fileName
            : state.fileName,
        isCreateMangaFolder:
          action.payload.isCreateMangaFolder !== undefined
            ? action.payload.isCreateMangaFolder
            : state.isCreateMangaFolder,
        ugoiraExportFormat:
          action.payload.ugoiraExportFormat !== undefined
            ? action.payload.ugoiraExportFormat
            : state.ugoiraExportFormat,
      };
    case SAVE_IMAGE_SETTINGS.RESTORE:
      return {
        ...state,
        ...action.payload.state,
        ugoiraExportFormat:
          action.payload.state.ugoiraExportFormat || UGOIRA_EXPORT_FORMATS.ZIP,
      };
    default:
      return state;
  }
}
