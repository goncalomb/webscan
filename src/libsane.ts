// XXX: these type definitions should eventually be completed
//      and moved to the sane-wasm project

export enum SANEType {
  BOOL = 0,
  INT,
  FIXED,
  STRING,
  BUTTON,
  GROUP,
}

export enum SANEUnit {
  NONE = 0,
  PIXEL,
  BIT,
  MM,
  DPI,
  PERCENT,
  MICROSECOND,
}

export enum SANEConstraintType {
  NONE = 0,
  RANGE,
  WORD_LIST,
  STRING_LIST,
}

export enum SANEFrame {
  GRAY = 0,
  RGB,
  RED,
  GREEN,
  BLUE,
}

export interface SANEState {
  initialized: boolean;
  version_code: number;
  version: {
    major: number;
    minor: number;
    build: number;
  },
  open: boolean;
}

export interface SANEDevice {
  name: string;
  vendor: string;
  model: string;
  type: string;
}

export interface SANEOptionDescriptor { // TODO: fix sane-wasm, only title and type are valid for groups
  name: string;
  title: string;
  desc: string;
  type: SANEType;
  unit: SANEUnit;
  size: number;
  cap: {
    SOFT_SELECT: boolean;
    HARD_SELECT: boolean;
    SOFT_DETECT: boolean;
    EMULATED: boolean;
    AUTOMATIC: boolean;
    INACTIVE: boolean;
    ADVANCED: boolean;
  };
  constraint_type: SANEConstraintType;
  constraint: any; // TODO: type this (conditional types?)
}

export interface SANEInfo {
  INEXACT: boolean;
  RELOAD_OPTIONS: boolean;
  RELOAD_PARAMS: boolean;
}

export interface SANEParameters {
  format: SANEFrame;
  last_frame: boolean;
  bytes_per_line: number;
  pixels_per_line: number;
  lines: number;
  depth: number;
}

type SANEEnum = {
  [key: string]: number; // TODO: proper types for the remaining enums
} & {
  asString: (n: number) => string | null;
}

export interface LibSANE {
  SANE_WASM_COMMIT: string;
  SANE_WASM_VERSION: string;
  SANE_CURRENT_MAJOR: number;
  SANE_CURRENT_MINOR: number;

  SANE_STATUS: SANEEnum;
  SANE_TYPE: SANEEnum;
  SANE_UNIT: SANEEnum;
  SANE_CONSTRAINT: SANEEnum;
  SANE_FRAME: SANEEnum;

  sane_get_state: () => SANEState;
  sane_init: () => number; // sync?
  sane_exit: () => Promise<void>;
  sane_get_devices: () => Promise<{ status: number; devices: SANEDevice[] }>;
  sane_open: (devicename: string) => Promise<{ status: number; }>;
  sane_close: () => Promise<void>;
  sane_get_option_descriptor: (option: number) => { status: number; option_descriptor: SANEOptionDescriptor | null };
  sane_control_option_get_value: (option: number) => Promise<{ status: number; value: any }>; // TODO: can be async, fix sane-wasm
  sane_control_option_set_value: (option: number, value: any) => Promise<{ status: number; info: SANEInfo }>; // TODO: can be async, fix sane-wasm
  sane_control_option_set_auto: (option: number) => Promise<{ status: number; info: SANEInfo }>; // TODO: can be async (probably), fix sane-wasm
  sane_get_parameters: () => { status: number; parameters: SANEParameters };
  sane_start: () => { status: number; };
  sane_read: () => { status: number; data: Uint8Array };
  sane_cancel: () => { status: number; };
  sane_strstatus: (status: number) => string;
}

declare global {
  interface Window {
    LibSANE?: (options?: any) => Promise<LibSANE>;
  }
}

// utilities

/**
 * SANE utility function to initialize library (window.LibSANE).
 */
export async function saneGetLibSANE() {
  if (!window.LibSANE) {
    throw new Error('LibSANE not found');
  }
  const l = window.LibSANE;
  window.LibSANE = undefined; // nuke global variable
  return l();
}

/**
 * SANE utility function to fetch all options.
 */
export async function saneGetOptions(lib: LibSANE) {
  const options: { descriptor: SANEOptionDescriptor, value: any }[] = [];
  let desc: SANEOptionDescriptor | null = null;
  for (let i = 0, n = -1; i === 0 || desc; i++) {
    ({ option_descriptor: desc } = lib.sane_get_option_descriptor(i));
    if (desc) {
      if (!desc.cap.INACTIVE && desc.cap.SOFT_DETECT && desc.type !== SANEType.BUTTON) {
        const { status, value } = await lib.sane_control_option_get_value(i); // TODO: handle status
        if (status !== lib.SANE_STATUS.GOOD) {
          throw new Error('Unexpected status while getting option value');
        }
        options.push({ descriptor: desc, value });
        if (i === 0) {
          n = value; // option 0 contains total number of options
        }
      } else {
        options.push({ descriptor: desc, value: null });
      }
    } else if (!desc && i !== n) {
      throw new Error('Unexpected number of options');
    }
  }
  return options;
}

/**
 * SANE utility function that implements core scanning code flow.
 */
export function saneDoScan(lib: LibSANE, onData: (parameters: SANEParameters, data: Uint8Array) => void, onStart?: (parameters: SANEParameters) => void) {
  let status = lib.SANE_STATUS.INVAL;
  let parameters: SANEParameters | null = null;
  let promise: Promise<void> | null = null;
  let dead: Error | boolean = false;

  const kill = (err?: Error) => {
    dead = err || true;
    lib.sane_cancel(); // ignore status
  };

  const state = lib.sane_get_state();
  if (!state.open) {
    return { status, parameters, promise }; // fail, device not open
  }

  ({ status } = lib.sane_start());
  if (status !== lib.SANE_STATUS.GOOD) {
    return { status, parameters, promise }; // fail, sane_start failed
  }

  // after successful start, sane_cancel needs to be called and wait for
  // sane_read, so subsequent fails need to use kill()

  ({ status, parameters } = lib.sane_get_parameters());
  if (status !== lib.SANE_STATUS.GOOD) {
    kill(); // kill, sane_get_parameters failed
  }

  if (onStart && !dead) {
    try {
      onStart(parameters);
    } catch (e) {
      kill(e instanceof Error ? e : undefined);
    }
  }

  const params = parameters; // enforce ts type guard in next closure
  promise = new Promise((resolve, reject) => {
    const read = () => {
      try {
        const { status, data } = lib.sane_read(); // non-blocking
        if (status === lib.SANE_STATUS.EOF) {
          lib.sane_cancel(); // ignore status
          resolve();
          return;
        }
        if (status !== lib.SANE_STATUS.GOOD) {
          if (dead instanceof Error) {
            reject(dead);
            return;
          }
          reject();
          return;
        }
        if (data.length) {
          onData(params, data);
        }
        setTimeout(read, data.length > 0 ? 10 : 200);
      } catch (e) {
        kill(e instanceof Error ? e : undefined);
      }
    };
    setTimeout(read, 200);
  });

  return { status, parameters, promise };
}

/**
 * Main image scanner class. It does the actual image processing.
 */
export class SANEImageScanner {

  _line: number = 0;
  _reminder = new Uint8ClampedArray();
  _onImageData;

  constructor(onImageData: (data: ImageData, line: number) => void) {
    this._onImageData = onImageData;
  }

  initialize(parameters: SANEParameters) {
    if (parameters.format !== SANEFrame.GRAY && parameters.format !== SANEFrame.RGB) {
      throw new Error(`Invalid format (${JSON.stringify(parameters)})`);
    }
    if (parameters.depth !== 1 && parameters.depth !== 8) {
      throw new Error(`Invalid bit depth (${JSON.stringify(parameters)})`);
    }
    if (!parameters.last_frame) {
      throw new Error(`Invalid scanner (3-pass) (${JSON.stringify(parameters)})`);
    }
    if (parameters.lines < 0) {
      throw new Error(`Invalid scanner (hand-scanner) (${JSON.stringify(parameters)})`);
    }
    if (parameters.bytes_per_line <= 0 || parameters.pixels_per_line <= 0 || parameters.lines <= 0) {
      throw new Error(`Unexpected image size (${JSON.stringify(parameters)})`);
    }
    const channels = parameters.format === SANEFrame.GRAY ? 1 : 3;
    const bits = parameters.pixels_per_line * parameters.depth * channels;
    if (parameters.bytes_per_line * 8 < bits) {
      throw new Error(`Unexpected byte count (${JSON.stringify(parameters)})`);
    }
    // what do we support then?
    // we support GRAY and RGB single-pass, 1 and 8-bit, known height
    // that should cover most modern scanners
  }

  consumeData(parameters: SANEParameters, data: Uint8Array) {
    const dataIn = new Uint8ClampedArray(this._reminder.length + data.length);
    dataIn.set(this._reminder, 0);
    dataIn.set(data, this._reminder.length);

    // line count, number of full available lines
    const lc = Math.floor(dataIn.length / parameters.bytes_per_line);
    if (!lc) {
      // not enough data for a full line
      this._reminder = dataIn;
      return;
    }

    const dataOut = new Uint8ClampedArray(lc * parameters.pixels_per_line * 4); // RGBA (8-bit)
    let ik = 0; // consumed data on dataIn
    if (parameters.depth === 8) {
      if (parameters.format === SANEFrame.GRAY) {
        // 8-bit / 1 channel
        for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
          for (let p = 0, i = ik; p < parameters.pixels_per_line; p++, i++, o += 4) { // for pixels
            dataOut[o] = dataOut[o + 1] = dataOut[o + 2] = dataIn[i];
            dataOut[o + 3] = 0xff; // alpha
          }
        }
      } else {
        // 8-bit / 3 channels
        for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
          for (let p = 0, i = ik; p < parameters.pixels_per_line; p++, i += 3, o += 4) { // for pixels
            dataOut.set(dataIn.subarray(i, i + 3), o);
            dataOut[o + 3] = 0xff; // alpha
          }
        }
      }
    } else { // parameters.depth == 1
      if (parameters.format === SANEFrame.GRAY) {
        // 1-bit / 1 channel
        for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
          for (let p = 0, i = ik; p < parameters.pixels_per_line; i++) { // for in bytes
            for (let mask = 0x80; mask !== 0 && p < parameters.pixels_per_line; mask >>= 1, p++, o += 4) { // for pixels
              dataOut[o] = dataOut[o + 1] = dataOut[o + 2] = dataIn[i] & mask ? 0x00 : 0xff;
              dataOut[o + 3] = 0xff; // alpha
            }
          }
        }
      } else {
        // 1-bit / 3 channels
        // niche format, probably very few (if any) scanners support this
        // according to the test backend the bits are inverted on this format, if compared
        // with 1-bit gray (1 channel), it remains to be seen if this is correct in the wild
        for (let l = 0, o = 0; l < lc; l++, ik += parameters.bytes_per_line) { // for lines
          for (let p = 0, i = ik; p < parameters.pixels_per_line; i += 3) { // for in bytes
            for (let mask = 0x80; mask !== 0 && p < parameters.pixels_per_line; mask >>= 1, p++, o += 4) { // for pixels
              // rbg is interlaced byte-by-byte not bit-by-bit
              // so 3 bytes have the R-G-B for 8 pixels
              dataOut[o] = dataIn[i] & mask ? 0xff : 0x00;
              dataOut[o + 1] = dataIn[i + 1] & mask ? 0xff : 0x00;
              dataOut[o + 2] = dataIn[i + 2] & mask ? 0xff : 0x00;
              dataOut[o + 3] = 0xff; // alpha
            }
          }
        }
      }
    }
    this._reminder = dataIn.subarray(ik);
    this._onImageData(new ImageData(dataOut, parameters.pixels_per_line), this._line);
    this._line += lc;
  }

}
