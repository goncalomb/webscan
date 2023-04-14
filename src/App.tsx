import React from 'react';
import logo from './logo.svg';
import './App.css';
import { useSANEContext } from './SANEContext';

function SWVersion() {
  const { LibSANE } = useSANEContext();
  const urlRepo = 'https://github.com/goncalomb/sane-wasm';
  let elVersion = null;
  if (LibSANE) {
    const commit = LibSANE.SANE_WASM_COMMIT;
    const version = LibSANE.SANE_WASM_VERSION;
    const urlCommit = `${urlRepo}/tree/${commit}`;
    const m = version.match(/-g([0-9a-f]+)/);
    if (m && m.index !== undefined && commit.startsWith(m[1])) {
      const before = version.substring(0, m.index + 2);
      const after = version.substring(m.index + m[0].length);
      elVersion = <>{before}<a href={urlCommit} title={commit}>{m[1]}</a>{after}</>
    } else {
      elVersion = <>{version} (<a href={urlCommit} title={commit}>{commit.substring(0, 7)}</a>)</>
    }
  }
  return <span> <a href={urlRepo}>sane-wasm</a> {elVersion}</span>;
}

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <p>built using <SWVersion /> | <a href="https://goncalomb.com/">goncalomb.com</a></p>
      </header>
    </div>
  );
}

export default App;
