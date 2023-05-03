
import {
  SANEStatus,
  SANEValueType,
  SANEUnit,
  SANEConstraintType,
  SANEFrame,
  SANEState,
  SANEDevice,
  SANEOptionDescriptor,
  SANEInfo,
  SANEParameters,
  LibSANE,
  LibSANEFactory
} from './libsane-types';

export {
  SANEStatus,
  SANEValueType,
  SANEUnit,
  SANEConstraintType,
  SANEFrame
};

export type {
  SANEState,
  SANEDevice,
  SANEOptionDescriptor,
  SANEInfo,
  SANEParameters,
  LibSANE,
  LibSANEFactory
};

declare global {
  interface Window {
    LibSANE?: LibSANEFactory;
    webscanEnableDebug: (sane: any) => void;
  }
}

// utilities

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
 * SANE utility function to initialize library (window.LibSANE).
 */
export async function saneGetLibSANE() {
  if (!window.LibSANE) {
    throw new Error('LibSANE not found');
  }
  const l = window.LibSANE;
  window.LibSANE = undefined; // nuke global variable
  return l({
    sane: JSON.parse(sessionStorage.getItem('sane') || '{}')
  });
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
      if (!desc.cap.INACTIVE && desc.cap.SOFT_DETECT && desc.type !== SANEValueType.BUTTON) {
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
  };
  const cancel = () => kill();

  const state = lib.sane_get_state();
  if (!state.open) {
    return { status, parameters, promise, cancel }; // fail, device not open
  }

  ({ status } = lib.sane_start());
  if (status !== lib.SANE_STATUS.GOOD) {
    return { status, parameters, promise, cancel }; // fail, sane_start failed
  }

  // after successful start, sane_cancel needs to be called and wait for
  // sane_read, so subsequent fails need to use kill()

  ({ status, parameters } = lib.sane_get_parameters());
  if (status !== lib.SANE_STATUS.GOOD) {
    kill(new Error()); // kill, sane_get_parameters failed
  }

  if (onStart && !dead) {
    try {
      onStart(parameters);
    } catch (e) {
      kill(e instanceof Error ? e : new Error());
    }
  }

  const params = parameters; // enforce ts type guard in next closure
  promise = new Promise((resolve, reject) => {
    const read = async () => {
      try {
        const { status, data } = await lib.sane_read(); // non-blocking
        if (status === lib.SANE_STATUS.EOF) {
          await lib.sane_cancel(); // ignore status
          resolve();
          return;
        }
        if (status === lib.SANE_STATUS.CANCELLED) {
          if (dead instanceof Error) {
            reject(dead);
            return;
          }
          resolve();
          return;
        }
        if (status !== lib.SANE_STATUS.GOOD) {
          reject();
          return;
        }
        if (dead) {
          await lib.sane_cancel(); // ignore status
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
  return { status, parameters, promise, cancel };
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
