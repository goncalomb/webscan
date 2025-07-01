import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import { IScanOptions, LibSANE, SANEDevice, SANEParameters, SANEState, SANEStatus, ScanDataReader, ScanOption, ScanOptions, saneGetLibSANE } from "./libsane";
import { usbAddListener, usbRemoveListener, usbRequestDevices } from './utils';

interface ISANEContext {
  lib: LibSANE | null;
  busy: boolean;
  state: SANEState | null;
  devices: SANEDevice[];
  options: readonly ScanOption[];
  parameters: SANEParameters | null;
  scanning: boolean;
  getDevices: (usbRequest?: boolean, usbRequestFiltered?: boolean) => Promise<void>;
  openDevice: (name: string) => void;
  closeDevice: () => void;
  setOptionValue: (option: number, value?: any) => Promise<void>;
  startScan: (scanner: ScanDataReader) => Promise<{ options: IScanOptions, parameters: SANEParameters } | null>;
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
  const [busy, setBusy] = useState<ISANEContext['busy']>(false);
  const [state, setState] = useState<ISANEContext['state']>(null);
  const [devices, setDevices] = useState<ISANEContext['devices']>([]);
  const [options, setOptions] = useState<ISANEContext['options']>([]);
  const [parameters, setParameters] = useState<ISANEContext['parameters']>(null);
  const [scanning, setScanning] = useState<ISANEContext['scanning']>(false);
  const scanOptions = useRef<ScanOptions>();

  // wrapper to set busy state while performing calls to the library, this
  // breaks hooks linting a bit, using eslint-disable-next-line in some places
  // using setTimeout (setImmediate would be more correct) to void too many
  // changes in case the promise resolves immediately,
  const setBusyWrap = <TArgs extends any[], T>(func: (...X: TArgs) => Promise<T>) => (...args: TArgs) => {
    let doit = true;
    // setImmediate(() => doit && setBusy(true));
    setTimeout(() => doit && setBusy(true), 0);
    return func(...args).finally(() => {
      doit = false;
      setBusy(false);
    });
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const getDevices = useCallback(setBusyWrap(async (usbRequest = false, usbRequestFiltered = false) => {
    if (lib) {
      if (usbRequest) {
        await usbRequestDevices(usbRequestFiltered);
      }

      if (state?.initialized) {
        await lib.sane_exit();
      }
      await lib.sane_init();
      setState(lib.sane_get_state());

      const { status, devices } = await lib.sane_get_devices();
      if (status === SANEStatus.GOOD) {
        setDevices(devices);
      } else {
        alert('Failed to get devices.'); // TODO: proper error dialog
      }
    }
  }), [lib, state?.initialized]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const openDevice = useCallback(setBusyWrap(async (name: string) => {
    if (lib && state?.initialized) {
      const { status } = await lib.sane_open(name);
      if (status === SANEStatus.GOOD) {
        setState(lib.sane_get_state());
        scanOptions.current = await ScanOptions.get(lib);
        setOptions(scanOptions.current.options);
        setParameters((await lib.sane_get_parameters()).parameters);
      } else {
        alert('Failed to open device.'); // TODO: proper error dialog
      }
    }
  }), [lib, state?.initialized]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const closeDevice = useCallback(setBusyWrap(async () => {
    if (lib && state?.initialized) {
      await lib.sane_close();
      setState(lib.sane_get_state());
      scanOptions.current = undefined;
      setOptions([]);
      setParameters(null);
      await getDevices();
    }
  }), [lib, state?.initialized]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const setOptionValue = useCallback(setBusyWrap(async (option: number, value?: any) => {
    if (lib && state?.initialized && scanOptions.current) {
      const { status, info, updated } = await scanOptions.current.setValue(option, value || null);
      if (status === SANEStatus.GOOD) {
        if (info.RELOAD_PARAMS) {
          setParameters((await lib.sane_get_parameters()).parameters);
        }
        if (updated) {
          scanOptions.current = updated;
          setOptions(scanOptions.current.options);
        }
      } else {
        alert('Failed to set option.'); // TODO: proper error dialog
      }
    }
  }), [lib, state?.initialized]);

  const startScan = useCallback(async (reader: ScanDataReader) => {
    if (lib && state?.initialized) {
      setScanning(true);
      const options = await ScanOptions.get(lib);
      const { status, parameters, promise } = await reader.start();
      promise.catch(e => {
        console.error(e);
        alert('Error while scanning.'); // TODO: proper error dialog
      }).finally(() => {
        setScanning(false);
      });
      if (status === SANEStatus.GOOD) {
        setParameters(parameters);
        return { options, parameters };
      }
    }
    return null;
  }, [lib, state?.initialized]);

  // initialize library
  useEffect(() => {
    saneGetLibSANE().then(lib => {
      setLib(lib);
    });
    // eslint-disable-next-line
  }, [/* no deps, fire this only once */]);

  // set usb listener
  useEffect(() => {
    if (state?.open === false) {
      const handler = () => getDevices();
      usbAddListener(handler);
      return () => {
        usbRemoveListener(handler);
      };
    }
  }, [getDevices, state?.open]);

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
      lib, busy, state, devices, options, parameters, scanning,
      getDevices, openDevice, closeDevice, setOptionValue, startScan,
    }}>
      {children}
    </SANEContext.Provider>
  );
};
