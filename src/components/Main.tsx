import React from 'react';
import './Main.css';
import Canvas from './Canvas';
import DeviceSelector from './DeviceSelector';
import { isNavigatorSupported } from '../utils';
import ScanController from './ScanController';
import OptionsSelector from './OptionsSelector';
import Disclaimer from './Disclaimer';

export default function Main() {
  return (
    <main className="Main">
      <div>
        <Canvas />
      </div>
      <div>
        {isNavigatorSupported() ? (
          <>
            <h2>0. Disclaimer</h2>
            <Disclaimer />
            <h2>1. Select Device</h2>
            <DeviceSelector />
            <h2>2. Change Options</h2>
            <OptionsSelector />
            <h2>3. Scan</h2>
            <ScanController />
          </>
        ) : (
          <p>
            <strong>Browser not supported!</strong><br />A modern browser that <a href="https://caniuse.com/webusb">supports WebUSB</a> is required.
          </p>
        )}
      </div>
    </main>
  );
}
