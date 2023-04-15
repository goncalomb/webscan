import React from 'react';
import './Main.css';
import Canvas from './Canvas';
import DeviceSelector from './DeviceSelector';
import { isNavigatorSupported } from '../utils';
import { useSANEContext } from '../SANEContext';

function Side() {
  const { parameters } = useSANEContext();
  return (
    <>
      <h3>1. Select Device</h3>
      <DeviceSelector />
      <h3>2. Change Options (TODO)</h3>
      <h3>3. Scan (TODO)</h3>
      <pre>
        {JSON.stringify(parameters, null, 2)}
      </pre>
    </>
  );
}

export default function Main() {
  return (
    <main className="Main">
      <div>
        <Canvas />
      </div>
      <div>
        {isNavigatorSupported() ? (
          <Side />
        ) : (
          <p>
            <strong>Browser not supported!</strong><br />A modern browser that <a href="https://caniuse.com/webusb">supports WebUSB</a> is required.
          </p>
        )}
      </div>
    </main>
  );
}
