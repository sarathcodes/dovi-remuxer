const { execSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') {
    const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
    console.log(`[Codesign] Stripping quarantine and applying local ad-hoc signature: ${appPath}`);
    try {
      execSync(`xattr -cr "${appPath}"`, { stdio: 'inherit' });
      execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
      console.log(`[Codesign] Successfully ad-hoc signed: ${appPath}`);
    } catch (err) {
      console.warn(`[Codesign] Warning: ${err.message}`);
    }
  }
};
