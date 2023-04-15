import React, { useRef } from 'react';
import { useSANEContext } from '../SANEContext';

export default function DeviceSelector() {
  const { state, devices, scanning, getDevices, openDevice, closeDevice } = useSANEContext();
  const refSelect = useRef<HTMLSelectElement>(null);
  return state?.initialized ? (
    <>
      <p>
        <button onClick={e => getDevices()} disabled={state.open}>Select USB Devices</button>
      </p>
      {devices.length ? (
        <>
          <p>
            <select ref={refSelect} disabled={state.open}>
              {devices.map(d => <option key={d.name} value={d.name}>{`${d.model} (${d.vendor}) [${d.name}]`}</option>)}
            </select>
          </p>
          {state.open ? (
            <>
              <p>
                <button onClick={e => closeDevice()} disabled={scanning}>Close Device</button> <small><strong>Close the device before unplugging or leaving.</strong></small>
              </p>
              <p>
                <small>Stop the scanning process before leaving this page to avoid locking the scanner. If the scanner is unresponsive, reconnect it and reload the page.</small>
              </p>
            </>
          ) : (
            <p>
              <button onClick={e => openDevice(refSelect?.current?.value || '')}>Select Device</button>
            </p>
          )}
        </>
      ) : null}
    </>
  ) : null;
}
