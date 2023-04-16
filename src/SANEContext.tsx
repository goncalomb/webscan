import React, { useCallback, useContext, useState } from "react";
import { useEffect } from "react";
import { isNavigatorSupported, usbAddListener, usbRemoveListener, usbRequestDevices } from './utils';
import { LibSANE, SANEDevice, SANEOptionDescriptor, SANEParameters, SANEState, SANEType } from "./libsane";

/**
 * SANE utility function to initialize library (window.LibSANE).
 */
async function saneGetLibSANE() {
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
async function saneGetOptions(lib: LibSANE) {
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
function saneDoScan(lib: LibSANE, callback: (parameters: SANEParameters, data: Uint8Array) => void) {
  let status = lib.SANE_STATUS.GOOD;
  let parameters: SANEParameters | null = null;
  let promise: Promise<void> | null = null;
  const state = lib.sane_get_state();
  if (state.open) {
    ({ status } = lib.sane_start());
    if (status === lib.SANE_STATUS.GOOD) {
      ({ status, parameters } = lib.sane_get_parameters());
      promise = new Promise((resolve, reject) => {
        const read = () => {
          try {
            const { status, data } = lib.sane_read();
            if (status === lib.SANE_STATUS.EOF) {
              lib.sane_cancel(); // ignore status
              resolve();
              return;
            }
            if (status !== lib.SANE_STATUS.GOOD) {
              reject();
              return;
            }
            if (data.length && parameters /* XXX: parameters check may not be required when we have proper types */) {
              callback(parameters, data);
            }
            setTimeout(read, data.length > 0 ? 10 : 200);
          } catch (e) {
            reject(e);
          }
        };
        setTimeout(read, 200);
      });
    }
  }
  return { status, parameters, promise };
}

interface ISANEContext {
  lib: LibSANE | null;
  state: SANEState | null;
  devices: SANEDevice[];
  options: { descriptor: SANEOptionDescriptor, value: any }[];
  parameters: SANEParameters | null;
  scanning: boolean;
  getDevices: () => void;
  openDevice: (name: string) => void;
  closeDevice: () => void;
  setOptionValue: (option: number, value?: any) => void;
  startScan: (callback: (parameters: SANEParameters, data: Uint8Array) => void) => SANEParameters | null;
}

const SANEContext = React.createContext<ISANEContext | null>(null);

export const useSANEContext = () => {
  const ctx = useContext(SANEContext);
  if (!ctx) {
    throw new Error('Invalid SANEContext');
  }
  return ctx;
};

export const SANEContextProvider = ({ children }: { children: any }) => {
  const [lib, setLib] = useState<ISANEContext['lib']>(null);
  const [state, setState] = useState<ISANEContext['state']>(null);
  const [devices, setDevices] = useState<ISANEContext['devices']>([]);
  const [options, setOptions] = useState<ISANEContext['options']>([]);
  const [parameters, setParameters] = useState<ISANEContext['parameters']>(null);
  const [scanning, setScanning] = useState<ISANEContext['scanning']>(false);

  const getDevices = useCallback(async (usbRequest = true) => {
    if (lib && state?.initialized) {
      if (usbRequest) {
        await usbRequestDevices();
      }

      await lib.sane_exit();
      await lib.sane_init();
      setState(lib.sane_get_state());

      const { status, devices } = await lib.sane_get_devices();
      if (status === lib.SANE_STATUS.GOOD) {
        setDevices(devices);
      } else {
        alert('Failed to get devices.'); // TODO: proper error dialog
      }
    }
  }, [lib, state?.initialized]);

  const openDevice = useCallback(async (name: string) => {
    if (lib && state?.initialized) {
      const { status } = await lib.sane_open(name);
      setState(lib.sane_get_state());
      setOptions(await saneGetOptions(lib));
      setParameters(lib.sane_get_parameters().parameters);
      if (status !== lib.SANE_STATUS.GOOD) {
        alert('Failed to open device.'); // TODO: proper error dialog
      }
    }
  }, [lib, state?.initialized]);

  const closeDevice = useCallback(async () => {
    if (lib && state?.initialized) {
      await lib.sane_close();
      setState(lib.sane_get_state());
      setOptions([]);
      setParameters(null);
    }
  }, [lib, state?.initialized]);

  const setOptionValue = useCallback(async (option: number, value?: any) => {
    if (lib && state?.initialized) {
      // XXX: value == undefined means set auto, this function should be split in two or use symbol to mean auto, add type to value first
      const { status, info } = value === undefined ? await lib.sane_control_option_set_auto(option) : await lib.sane_control_option_set_value(option, value);
      if (status === lib.SANE_STATUS.GOOD) {
        if (info.RELOAD_PARAMS) {
          setParameters(lib.sane_get_parameters().parameters);
        }
        if (info.RELOAD_OPTIONS) {
          setOptions(await saneGetOptions(lib));
          return; // skip get/update option, we fetch them all
        }
        if (info.INEXACT || value === undefined) { // auto triggers get value
          ({ value } = await lib.sane_control_option_get_value(option));
        }
        // update value
        setOptions(options => {
          const ret = [...options];
          ret[option] = { ...options[option], value };
          return ret;
        });
      } else {
        alert('Failed to set option.'); // TODO: proper error dialog
      }
    }
  }, [lib, state?.initialized]);

  const startScan = useCallback((callback: (parameters: SANEParameters, data: Uint8Array) => void) => {
    if (lib && state?.initialized) {
      const { status, parameters, promise } = saneDoScan(lib, callback);
      if (status === lib.SANE_STATUS.GOOD) {
        // scan started
        setParameters(parameters);
        setScanning(true);
        promise?.catch(() => {
          alert('Error while scanning.'); // TODO: proper error dialog
        }).finally(() => {
          setScanning(false);
        });
        return parameters;
      } else {
        alert('Failed to start scanning.'); // TODO: proper error dialog
      }
    }
    return null;
  }, [lib, state?.initialized]);

  // initialize library
  useEffect(() => {
    saneGetLibSANE().then(lib => {
      setLib(lib);
      if (isNavigatorSupported()) {
        lib.sane_init();
        setState(lib.sane_get_state());
      }
    });
    // eslint-disable-next-line
  }, [/* no deps, fire this only once */]);

  // initialize devices
  useEffect(() => {
    getDevices(false);
  }, [getDevices]);

  // set usb listener
  useEffect(() => {
    if (state?.initialized) {
      const handler = () => getDevices(false);
      usbAddListener(handler);
      return () => {
        usbRemoveListener(handler);
      };
    }
  }, [getDevices, state?.initialized]);

  // set beforeunload listener (alert while state.open == true)
  useEffect(() => {
    if (state?.open) {
      const handler = (e: BeforeUnloadEvent) => e.returnValue = 'stop';
      window.addEventListener('beforeunload', handler);
      return () => {
        window.removeEventListener('beforeunload', handler);
      };
    }
  }, [state?.open]);

  // XXX: memo final context value?

  return (
    <SANEContext.Provider value={{
      lib, state, devices, options, parameters, scanning,
      getDevices, openDevice, closeDevice, setOptionValue, startScan,
    }}>
      {children}
    </SANEContext.Provider>
  );
};
