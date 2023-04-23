import React, { ChangeEvent, MouseEvent, useCallback, useRef, useState } from 'react';
import './Canvas.css';
import { useCanvasContext } from './CanvasContext';

export default function Canvas() {
  const { canvasRef, notInitialized, exportDownload, exportPhotopea } = useCanvasContext();
  const selectRef = useRef<HTMLSelectElement>(null);
  const [scaled, setScaled] = useState(true);
  const [quality, setQuality] = useState(95);

  const onChangeQuality = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuality(Math.min(100, Math.max(0, Number(e.target.value))));
  }, []);

  const onClickCanvas = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    if (scaled) {
      // zooming-in, adjust scroll position to match clicked point
      const c = e.target as HTMLCanvasElement;
      const dx = c.offsetWidth;
      const dy = c.offsetHeight;
      const px = e.nativeEvent.offsetX / dx;
      const py = e.nativeEvent.offsetY / dy;
      setTimeout(() => {
        c.parentElement?.scrollTo((px * (c.offsetWidth - dx)), (py * (c.offsetHeight - dy)));
      }, 0);
    }
    setScaled(s => !s);
  }, [scaled]);

  return (
    <div className="Canvas">
      <div>
        <canvas ref={canvasRef} className={scaled ? 'scaled' : ''} title="Click to Zoom." onClick={onClickCanvas}></canvas>
      </div>
      <fieldset disabled={notInitialized}>
        <select title="Export Image Format." ref={selectRef} >
          <option value="image/jpeg">JPEG</option>
          <option value="image/png">PNG</option>
        </select>
        {' '}
        <input
          type="number"
          title="Export Image Quality (%). JPEG only."
          min={0}
          max={100}
          maxLength={5}
          value={quality}
          onChange={onChangeQuality}
        />
        {' '}
        <button onClick={e => exportDownload(selectRef.current?.value || '', quality / 100)}>Download</button>
        {' '}
        <button onClick={e => exportPhotopea(selectRef.current?.value || '', quality / 100)}>Send to Photopea</button>
      </fieldset>
    </div>
  );
}
