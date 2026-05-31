import { Capacitor, registerPlugin } from '@capacitor/core';

const ApkUpdate = registerPlugin('ApkUpdate');

export const downloadApkUpdate = async ({ url, headers = {}, fileName, onProgress }) => {
  if (!url || Capacitor.getPlatform() !== 'android') {
    throw new Error('native-download-unavailable');
  }

  let progressListener = null;
  if (typeof onProgress === 'function') {
    progressListener = await ApkUpdate.addListener('downloadProgress', (event) => {
      onProgress({
        loaded: Number(event?.loaded || 0),
        total: Number(event?.total || 0),
      });
    });
  }

  try {
    return await ApkUpdate.download({ url, headers, fileName });
  } finally {
    if (progressListener) {
      await progressListener.remove();
    }
  }
};

export const installApkUpdate = async (uri) => {
  if (!uri || Capacitor.getPlatform() !== 'android') {
    return false;
  }

  await ApkUpdate.install({ uri });
  return true;
};
