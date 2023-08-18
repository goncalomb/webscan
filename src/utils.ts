/**
 * Canvas serialization type image/png that browsers must always support.
 */
export const CANVAS_SERIALIZATION_TYPE_PNG = { name: 'image/png', ext: '.png', lossless: true };

/**
 * All supported canvas serialization types.
 */
export const CANVAS_SERIALIZATION_TYPES = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return [
    CANVAS_SERIALIZATION_TYPE_PNG,
    { name: 'image/jpeg', ext: '.jpg', lossless: false },
    { name: 'image/webp', ext: '.webp', lossless: false },
  ].filter(t => c.toDataURL(t.name).startsWith(`data:${t.name};`));
})();

/**
 * All supported canvas serialization types by name.
 */
export const CANVAS_SERIALIZATION_TYPE_BY_NAME = CANVAS_SERIALIZATION_TYPES.reduce((o, t) => {
  o[t.name] = t;
  return o;
}, {} as { [key: string]: typeof CANVAS_SERIALIZATION_TYPES[0] });

/**
 * Default canvas serialization type (image/jpeg if supported else image/png).
 */
export const CANVAS_SERIALIZATION_TYPE_DEFAULT = CANVAS_SERIALIZATION_TYPES.find(t => t.name === 'image/jpeg') || CANVAS_SERIALIZATION_TYPE_PNG;

/**
 * ISO A paper sizes.
 */
export const PAPER_SIZES_A: { name: string, w: number, h: number, unit: 'mm' }[] = Array.from(Array(11).keys()).map(i => ({
  name: `A${i}`,
  w: Math.round(Math.sqrt(Math.SQRT2 / (2 ** (i + 1))) * 1000),
  h: Math.round(Math.sqrt(Math.SQRT2 / (2 ** i)) * 1000),
  unit: 'mm',
}));

/**
 * US paper sizes.
 */
export const PAPER_SIZES_US: { name: string, w: number, h: number, unit: 'in' }[] = [
  { name: 'US Letter', w: 8.5, h: 11, unit: 'in' },
  { name: 'US Legal', w: 8.5, h: 14, unit: 'in' },
  { name: 'US Tabloid', w: 11, h: 17, unit: 'in' },
];

/**
 * All paper sizes.
 */
export const PAPER_SIZES_ALL: { name: string, w: number, h: number, unit: 'mm' | 'in' }[] = [
  ...PAPER_SIZES_A,
  ...PAPER_SIZES_US,
];

/**
 * All paper sizes sorted by area.
 */
export const PAPER_SIZES_ALL_SORTED = [...PAPER_SIZES_ALL].sort((a, b) => {
  const aArea = a.unit === 'in' ? in2mm(a.w) * in2mm(a.h) : a.w * a.h;
  const bArea = b.unit === 'in' ? in2mm(b.w) * in2mm(b.h) : b.w * b.h;
  return bArea - aArea;
});

/**
 * Convert inches to millimeters.
 */
export function in2mm(inches: number) {
  return inches * 127 / 5;
}

/**
 * Convert millimeters to inches.
 */
export function mm2in(millimeters: number) {
  return millimeters * 5 / 127;
}

/**
 * Check if browser supports required technologies (USB only for now).
 */
export function isNavigatorSupported() {
  return !!window.navigator.usb;
};

/**
 * USB request devices with default filter for printers/scanners.
 */
export function usbRequestDevices(filters = false) {
  return navigator.usb.requestDevice({
    filters: filters ? [
      { classCode: 0x07 }, // printer
    ] : [],
  });
}

/**
 * USB add listener (connect/disconnect).
 */
export function usbAddListener(handler: Parameters<USB['addEventListener']>[1]) {
  navigator.usb.addEventListener('connect', handler);
  navigator.usb.addEventListener('disconnect', handler);
}

/**
 * USB remove listener (connect/disconnect).
 */
export function usbRemoveListener(handler: Parameters<USB['removeEventListener']>[1]) {
  navigator.usb.removeEventListener('connect', handler);
  navigator.usb.removeEventListener('disconnect', handler);
}

/**
 * Utility to construct filename for exported images and container formats.
 * @param type canvas serialization type
 * @param quality canvas serialization quality
 * @param date file date
 * @param extra extra text before date
 * @param containerExt container extension if exporting a container format
 * @returns constructed name
 */
export function constructImageExportName(type: string, quality: number, date?: Date | null, extra?: string | null, containerExt?: '.zip' | '.pdf') {
  const { ext, lossless } = CANVAS_SERIALIZATION_TYPE_BY_NAME[type];
  return `webscan${extra ? `-${extra}` : ''}-${date ? date.getTime() : Date.now()}${containerExt ? `-${ext.substring(1)}` : ''}${lossless ? '' : `-${quality}`}${containerExt || ext}`;
}

/**
 * Utility to convert raw image data to a specific image type using a canvas.
 * @param data image data
 * @param type canvas serialization type
 * @param quality canvas serialization quality
 * @returns blob promise
 */
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
