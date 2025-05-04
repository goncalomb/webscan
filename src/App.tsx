import React, { useMemo } from 'react';
import './App.css';
import { useSANEContext } from './SANEContext';
import Main from './components/Main';
import CanvasContextProvider from './components/CanvasContext';

function SWVersion() {
  const { lib } = useSANEContext();
  const urlRepo = 'https://github.com/goncalomb/sane-wasm';
  const elVersion = useMemo(() => {
    let elVersion = null;
    if (lib) {
      const commit = lib.SANE_WASM_COMMIT;
      const version = lib.SANE_WASM_VERSION;
      const urlCommit = `${urlRepo}/tree/${commit}`;
      const m = version.match(/(-g|^)([0-9a-f]+)/);
      if (m && m.index !== undefined && commit.startsWith(m[2])) {
        const before = version.substring(0, m.index + m[1].length);
        const after = version.substring(m.index + m[0].length);
        elVersion = <>{before}<a href={urlCommit} title={commit}>{m[2]}</a>{after}</>;
      } else {
        elVersion = <>{version} (<a href={urlCommit} title={commit}>{commit.substring(0, 7)}</a>)</>;
      }
    }
    return elVersion;
  }, [lib]);
  return <span><a href={urlRepo}>sane-wasm</a> {elVersion}</span>;
}

export default function App() {
  return (
    <div className="App">
      <header>
        <h1>WebScan</h1>
        <p>An experimental project to bring document/image scanning to the web (USB scanners).</p>
      </header>
      <CanvasContextProvider>
        <Main />
      </CanvasContextProvider>
      <article>
        <h2><span>What scanner models are supported?</span></h2>
        <p><strong>There is no definitive list of supported devices at the moment.</strong> Behind the scenes, WebScan uses SANE to do the actual scanning so it will always be limited to the devices supported by SANE.</p>
        <p><a href="http://www.sane-project.org/lists/sane-mfgs-cvs.html">List of devices supported by SANE</a> &ndash; Of the devices on this list it's currently unknown which ones work with WebScan. An exhaustive list has not been compiled yet.</p>
        <p><a href="http://www.sane-project.org/lists/sane-backends-external.html">List of devices supported by SANE (external)</a> &ndash; Of the devices on this list NONE are supported by WebScan at the moment.</p>
        <p><strong>WebScan only works with USB scanners.</strong> The best way to test support is just to try it. Connect the scanner. Click "Authorize USB Scanner". If after selecting the scanner in the browser dialog you still see the text "NO SUPPORTED DEVICES FOUND", then the device is not currently supported.</p>
        <h2><span>Use a modern browser!</span></h2>
        <p>A modern browser that <a href="https://caniuse.com/webusb">supports WebUSB</a> is required. Try using the latest version of Chrome/Edge.</p>
        <h2><span>Special Considerations on Windows!</span></h2>
        <p>On Windows, you might need to use the free tool <a href="https://zadig.akeo.ie/">Zadig</a> to replace the pre-installed device driver. It goes something like this: 1. Open Zadig 2. Select "Options" "List All Devices" 3. Select your scanner 4. Replace the driver (probably usbscan) with WinUSB 5. Reload this page and try selecting the device. To revert, uninstall the device from Device Manager and reconnect.</p>
        <h2><span>Source Code on GitHub!</span></h2>
        <p>The secret sauce behind WebScan is <a href="https://github.com/goncalomb/sane-wasm">sane-wasm</a> a WebAssembly port of the <a href="http://www.sane-project.org/">SANE</a> library that I'm publishing on GitHub. <a href="https://github.com/goncalomb/webscan">WebScan</a> is just a simple React application on top of that, also on GitHub.</p>
        <h2><span>Report Issues</span></h2>
        <p>You can report issues on the <a href="https://github.com/goncalomb/sane-wasm/issues">issues page for sane-wasm</a> as any problems will most likely be related to that. Note that any issues that are found to be specific to the SANE library will probably not be fixed, and will need to be <a href="https://gitlab.com/sane-project/backends/-/issues">redirected to that project</a>.</p>
        <p>You can also email me at contact<span hidden>.hahaha</span>@<span hidden>rekt</span>goncalomb<span hidden>.example</span>.com.</p>
      </article>
      <footer>
        <p><a href="https://github.com/goncalomb/webscan">WebScan</a> | <SWVersion /> | <a href="https://goncalomb.com/">goncalomb.com</a></p>
      </footer>
    </div>
  );
}
