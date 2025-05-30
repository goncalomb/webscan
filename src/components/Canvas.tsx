import { MouseEvent, useCallback, useState } from 'react';
import { CANVAS_SERIALIZATION_TYPE_PNG } from '../utils';
import './Canvas.css';
import { useCanvasContext } from './CanvasContext';
import { useExportImageTypeSelector } from './Utilities';
import { useSANEContext } from '../SANEContext';

export default function Canvas() {
  const { busy, scanning } = useSANEContext();
  const { canvasRef, notInitialized, exportDownload, exportPhotopea } = useCanvasContext();
  const [scaled, setScaled] = useState(true);
  const { type, quality, elFormatSelector, elQualitySelector } = useExportImageTypeSelector(CANVAS_SERIALIZATION_TYPE_PNG.name);

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
      <fieldset disabled={notInitialized || busy || scanning}>
        {elFormatSelector}
        {' '}
        {elQualitySelector}
        {' '}
        <button onClick={e => exportDownload(type, quality)}>Download</button>
        {' '}
        <button onClick={e => exportPhotopea(type, quality)}>Send to Photopea</button>
      </fieldset>
    </div>
  );
}
