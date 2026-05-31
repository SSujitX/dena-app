import { Capacitor, registerPlugin } from '@capacitor/core';

const ApkInstaller = registerPlugin('ApkInstaller');

export const installDownloadedApk = async (uri) => {
  if (!uri || Capacitor.getPlatform() !== 'android') {
    return false;
  }

  await ApkInstaller.install({ uri });
  return true;
};
