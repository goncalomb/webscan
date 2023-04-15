import React, { useCallback } from 'react';
import { useSANEContext } from '../SANEContext';
import { useCanvasContext } from './CanvasContext';

export default function ScanController() {
  const { lib, state, parameters, scanning, startScan } = useSANEContext();
  const { resetCanvas, putImageData } = useCanvasContext();

  const doStartScan = useCallback(() => {
    let line = 0;
    let rem = new Uint8ClampedArray();
    const parameters = startScan((parameters, data) => {
      const lc = Math.floor((rem.length + data.length) / (3 * parameters.pixels_per_line));
      const idata = new Uint8ClampedArray(rem.length + data.length);
      idata.set(rem, 0);
      idata.set(data, rem.length);
      if (lc) {
        const odata = new Uint8ClampedArray(lc * parameters.pixels_per_line * 4);
        var i = 0;
        for (var j = 0; j < odata.length; i += 3, j += 4) {
          odata.set(idata.subarray(i, i + 3), j);
          odata[j + 3] = 0xff;
        }
        rem = idata.subarray(i);
        putImageData(new ImageData(odata, parameters.pixels_per_line), line);
        line += lc;
      } else {
        rem = idata;
      }
    });
    if (parameters) {
      resetCanvas(parameters.pixels_per_line, parameters.lines);
    }
  }, [startScan, resetCanvas, putImageData]);

  return state?.initialized ? (
    <>
      <p>
        <button onClick={e => doStartScan()} disabled={!state.open || scanning || parameters?.format !== lib?.SANE_FRAME.RGB}>Start Scan</button>
        {' '}
        {state.open && parameters && parameters.format !== lib?.SANE_FRAME.RGB ? <small><strong>Unsupported format ({lib?.SANE_FRAME.asString(parameters.format)}), choose other options.</strong></small> : null}
      </p>
      <pre>
        {parameters && JSON.stringify(parameters, null, 2)}
      </pre>
    </>
  ) : null;
}
