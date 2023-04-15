import React from 'react';
import './App.css';
import { useSANEContext } from './SANEContext';
import Main from './components/Main';

function SWVersion() {
  const { lib } = useSANEContext();
  const urlRepo = 'https://github.com/goncalomb/sane-wasm';
  let elVersion = null;
  if (lib) {
    const commit = lib.SANE_WASM_COMMIT;
    const version = lib.SANE_WASM_VERSION;
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
  return <span><a href={urlRepo}>sane-wasm</a> {elVersion}</span>;
}

export default function App() {
  return (
    <div className="App">
      <header>
        <h1>WebScan</h1>
        <p>An experimental project to bring document/image scanning to the web (USB scanners). </p>
      </header>
      <Main />
      <footer>
        <p>built using <SWVersion /> | <a href="https://goncalomb.com/">goncalomb.com</a></p>
      </footer>
    </div>
  );
}
