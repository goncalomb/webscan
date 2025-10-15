import { LibSANEOptions, libsane } from 'sane-wasm';
// TODO: convert sane-wasm to ESM module
// export * from 'sane-wasm';
export { SANEConstraintType, SANEFrame, SANEStatus, SANEUnit, SANEValueType, ScanDataReader, ScanImageReader, ScanOptions, type IScanOptions, type LibSANE, type SANEDevice, type SANEOptionDescriptor, type SANEParameters, type SANEState, type ScanOption } from 'sane-wasm';

declare global {
  interface Window {
    webscanEnableDebug: (sane: LibSANEOptions | boolean) => void;
  }
}

/**
 * Exported global to aid debugging.
 */
window.webscanEnableDebug = (sane = true) => {
  if (sane === true) {
    sessionStorage.setItem('sane', JSON.stringify({
      debugSANE: true,
      debugUSB: true,
      debugFunctionCalls: true,
      debugTestDevices: 5,
    }));
  } else if (sane) {
    sessionStorage.setItem('sane', JSON.stringify(sane));
  } else {
    sessionStorage.removeItem('sane');
  }
  window.location.reload();
};

/**
 * Utility function to initialize the library.
 */
export async function saneGetLibSANE() {
  return libsane({
    sane: JSON.parse(sessionStorage.getItem('sane') || '{}'),
  });
}
