let navigatorSupported: boolean;

export const CANVAS_SERIALIZATION_TYPE_PNG = { name: 'image/png', ext: '.png', lossless: true }; // browsers must always support 'image/png'
export const CANVAS_SERIALIZATION_TYPES = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return [
    CANVAS_SERIALIZATION_TYPE_PNG,
    { name: 'image/jpeg', ext: '.jpg', lossless: false },
    { name: 'image/webp', ext: '.webp', lossless: false },
  ].filter(t => c.toDataURL(t.name).startsWith(`data:${t.name};`));
})();
export const CANVAS_SERIALIZATION_TYPE_BY_NAME = CANVAS_SERIALIZATION_TYPES.reduce((o, t) => {
  o[t.name] = t;
  return o;
}, {} as { [key: string]: typeof CANVAS_SERIALIZATION_TYPES[0] });
export const CANVAS_SERIALIZATION_TYPE_DEFAULT = CANVAS_SERIALIZATION_TYPES.find(t => t.name === 'image/jpeg') || CANVAS_SERIALIZATION_TYPE_PNG;

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

export function constructImageExportName(type: string, quality: number, date?: Date | null, extra?: string | null, containerExt?: '.zip' | '.pdf') {
  const { ext, lossless } = CANVAS_SERIALIZATION_TYPE_BY_NAME[type];
  return `webscan${extra ? `-${extra}` : ''}-${date ? date.getTime() : Date.now()}${containerExt ? `-${ext.substring(1)}` : ''}${lossless ? '' : `-${quality}`}${containerExt || ext}`;
}

export function imageDataToBlob(data: ImageData, type?: string, quality?: any) {
  return new Promise<Blob>((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(data, 0, 0);
    }
    canvas.toBlob(blob => {
      if (blob) {
        resolve(blob);
      } else {
        reject();
      }
    }, type, quality);
  });
}
