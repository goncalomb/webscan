import React, { useCallback, useContext, useState } from "react";
import { useEffect } from "react";
import { isNavigatorSupported, usbAddListener, usbRemoveListener, usbRequestDevices } from './utils';

// XXX: these type definitions should eventually be completed
//      and moved to the sane-wasm project

interface SANEState {
  initialized: boolean;
  version_code: number;
  version: {
    major: number;
    minor: number;
    build: number;
  },
  open: boolean;
}

interface SANEDevice {
  name: string;
  vendor: string;
  model: string;
  type: string;
}

interface SANEParameters {
  format: number;
  last_frame: boolean;
  bytes_per_line: number;
  pixels_per_line: number;
  lines: number;
  depth: number;
}

type SANEEnum = {
  [key: string]: number; // TODO: proper enum type
} & {
  asString: (n: number) => string | null;
}

interface LibSANE {
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
  sane_get_option_descriptor: (option: number) => { status: number; option_descriptor: any };
  sane_control_option_get_value: (option: number) => { status: number; value: any }; // sync?
  sane_control_option_set_value: (option: number, value: any) => { status: number; info: any }; // sync?
  sane_control_option_set_auto: (option: number) => { status: number; info: any }; // sync?
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

async function getLibSANE() {
  if (!window.LibSANE) {
    throw new Error('LibSANE not found');
  }
  const l = window.LibSANE;
  window.LibSANE = undefined; // nuke global variable
  return l();
}

function doScan(lib: LibSANE, callback: (parameters: SANEParameters, data: Uint8Array) => void) {
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

// context

interface ISANEContext {
  lib: LibSANE | null;
  state: SANEState | null;
  devices: SANEDevice[];
  parameters: SANEParameters | null;
  scanning: boolean;
  getDevices: () => void;
  openDevice: (name: string) => void;
  closeDevice: () => void;
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
      setParameters(lib.sane_get_parameters().parameters);
      if (status === lib.SANE_STATUS.GOOD) {

      } else {
        alert('Failed to open device.'); // TODO: proper error dialog
      }
    }
  }, [lib, state?.initialized]);

  const closeDevice = useCallback(async () => {
    if (lib && state?.initialized) {
      await lib.sane_close();
      setState(lib.sane_get_state());
      setParameters(null);
    }
  }, [lib, state?.initialized]);

  const startScan = useCallback((callback: (parameters: SANEParameters, data: Uint8Array) => void) => {
    if (lib && state?.initialized) {
      const { status, parameters, promise } = doScan(lib, callback);
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
    getLibSANE().then(lib => {
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
      lib, state, devices, parameters, scanning,
      getDevices, openDevice, closeDevice, startScan,
    }}>
      {children}
    </SANEContext.Provider>
  );
};
