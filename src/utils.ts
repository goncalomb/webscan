let navigatorSupported: boolean;

export function isNavigatorSupported() {
  if (navigatorSupported === undefined) {
    navigatorSupported = !!window.navigator.usb;
  }
  return navigatorSupported;
};

export function usbRequestDevices(filters = false) {
  return navigator.usb.requestDevice({
    filters: filters ? [
      { classCode: 0x07 }, // printer
    ] : [],
  });
}

export function usbAddListener(handler: Parameters<USB['addEventListener']>[1]) {
  navigator.usb.addEventListener('connect', handler);
  navigator.usb.addEventListener('disconnect', handler);
}

export function usbRemoveListener(handler: Parameters<USB['addEventListener']>[1]) {
  navigator.usb.removeEventListener('connect', handler);
  navigator.usb.removeEventListener('disconnect', handler);
}
