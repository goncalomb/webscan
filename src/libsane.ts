import { LibSANEOptions, libsane } from 'sane-wasm';
export * from 'sane-wasm';

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
