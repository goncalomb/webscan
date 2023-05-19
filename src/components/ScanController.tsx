import React, { useCallback, useState } from 'react';
import bytes from 'bytes';
import { useSANEContext } from '../SANEContext';
import { useCanvasContext } from './CanvasContext';
import { SANEFrame, SANEImageScanner, SANEParameters } from '../libsane';

function constructErrorList(parameters: SANEParameters) {
  const arr = [];
  if (parameters.format !== SANEFrame.GRAY && parameters.format !== SANEFrame.RGB) {
    arr.push(<li key="0">only RGB and GRAY formats are supported</li>);
  }
  if (parameters.depth !== 1 && parameters.depth !== 8) {
    arr.push(<li key="1">only 1/8-bit images are supported</li>);
  }
  if (!parameters.last_frame) {
    arr.push(<li key="2">3-pass scanners are not supported</li>);
  }
  if (parameters.lines < 0) {
    arr.push(<li key="3">"hand scanners" (unknown height) are not supported</li>);
  }
  return arr.length ? (
    <ul style={{ color: "firebrick" }}>
      {arr}
    </ul>
  ) : null;
}

export default function ScanController() {
  const { lib, busy, state, parameters, scanning, startScan } = useSANEContext();
  const { resetCanvas, putImageData, imageListAdd } = useCanvasContext();
  const [stopScan, setStopScan] = useState(() => () => { });

  const startImageScan = useCallback(() => {
    // its safe to keep a reference to resetCanvas and putImageData because
    // they never change, see useCanvasContext
    const scanner = new SANEImageScanner((data: ImageData, line: number) => {
      putImageData(data, line);
    });
    const result = startScan(scanner);
    if (result) {
      resetCanvas(result.parameters.pixels_per_line, result.parameters.lines);
      setStopScan(() => result.cancel);
      result.promise.then(() => {
        imageListAdd(scanner.getFullImage(result.parameters));
      });
    }
  }, [startScan, resetCanvas, putImageData, imageListAdd]);

  const errorList = parameters ? constructErrorList(parameters) : null;
  return state?.open && parameters ? (
    <>
      <p>
        {parameters.last_frame ? lib?.SANE_FRAME.asString(parameters.format) : '3-pass'}
        {' / '}
        {`${parameters.depth}-bit`}
        {' / '}
        {parameters.lines < 0 ? (
          <>
            {`${parameters.pixels_per_line} x ? pixels`}
          </>
        ) : (
          <>
            {`${parameters.pixels_per_line} x ${parameters.lines} pixels`}
            {' / '}
            {((b: number) => <><abbr title={`${b} bytes`}>{bytes(b, { unitSeparator: ' ' })}</abbr> (RGB 8-bit)</>)(parameters.pixels_per_line * parameters.lines * 3)}
          </>
        )}
      </p>
      {errorList}
      {scanning ? (
        <p>
          <button onClick={e => stopScan()} disabled={busy}>Stop Scan</button> <small style={{ color: 'midnightblue' }}><strong>Scanning...</strong></small>
        </p>
      ) : (
        <p>
          <button onClick={e => startImageScan()} disabled={busy || !!errorList}>Start Scan</button>
          {' '}
          {errorList ? <small style={{ color: 'firebrick' }}><strong>Unsupported format choose other options.</strong></small> : null}
        </p>
      )}
    </>
  ) : null;
}
