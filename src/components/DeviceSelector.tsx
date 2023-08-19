import { useRef, useState } from 'react';
import { useSANEContext } from '../SANEContext';
import './DeviceSelector.css';

export default function DeviceSelector() {
  const { busy, state, devices, scanning, getDevices, openDevice, closeDevice } = useSANEContext();
  const [failedTry, setFailedTry] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);
  return state?.initialized ? (
    <div className="DeviceSelector">
      {!state.open ? (
        <p>
          <button onClick={e => getDevices(true, true).catch(() => setFailedTry(true))}>Authorize USB Scanner</button>
          {' '}
          {failedTry ? <button onClick={e => getDevices(true).catch(() => { })}>Not Found? List All Devices</button> : null}
        </p>
      ) : null}
      <p>
        {devices.length ? (
          <select ref={selectRef} disabled={state.open}>
            {devices.map(d => <option key={d.name} value={d.name}>{`${d.model} (${d.vendor}) [${d.name}]`}</option>)}
          </select>
        ) : (
          <select key="NO" defaultValue="NO">
            <option value="NO" disabled>NO SUPPORTED DEVICES FOUND</option>
          </select>
        )}
      </p>
      {state.open ? (
        <>
          <p>
            <button onClick={e => closeDevice()} disabled={busy || scanning}>Close Device</button> <small><strong>Close the device before unplugging or leaving.</strong></small>
          </p>
          <p>
            <small>Stop the scanning process before leaving this page to avoid locking the scanner. If the scanner is unresponsive, reconnect it and reload the page.</small>
          </p>
        </>
      ) : (
        <p>
          <button onClick={e => openDevice(selectRef.current?.value || '')} disabled={!devices.length}>Select Device</button>
        </p>
      )}
    </div>
  ) : null;
}
