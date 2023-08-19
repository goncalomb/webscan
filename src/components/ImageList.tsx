import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { IImageListData, useCanvasContext } from './CanvasContext';
import './ImageList.css';
import { ImageBytes, useExportImageTypeSelector } from './Utilities';
import { saveZipAs } from '../zip-stream';
import jsPDF from 'jspdf';
import { constructImageExportName, imageDataToBlob } from '../utils';
import { useSANEContext } from '../SANEContext';

const PREVIEW_CANVAS_WIDTH = 120;
const PREVIEW_CANVAS_HEIGHT = Math.floor(PREVIEW_CANVAS_WIDTH * Math.SQRT2);

function drawImageToFit(ctx: CanvasRenderingContext2D, data: ImageData) {
  const canvasTmp = document.createElement('canvas');
  canvasTmp.width = data.width;
  canvasTmp.height = data.height;
  const ctxTmp = canvasTmp.getContext('2d');
  if (ctxTmp) {
    ctxTmp.putImageData(data, 0, 0);
    const scale = Math.min(ctx.canvas.width / data.width, ctx.canvas.height / data.height);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.drawImage(canvasTmp, 0, 0);
    ctx.restore();
  }
}

const ImageListItem = React.memo(({ item, onSelect, onAction }: { item: IImageListData, onSelect: (id: string) => void, onAction: (id: string, n: number) => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        drawImageToFit(ctx, item.data);
      }
    }
  }, [item]);

  return (
    <div>
      <canvas ref={canvasRef} width={PREVIEW_CANVAS_WIDTH} height={PREVIEW_CANVAS_HEIGHT} title="Click to select." onClick={() => onSelect(item.id)} />
      <div>
        <small><ImageBytes value={item.data} /></small>
      </div>
      <div>
        <small>{item.data.width} x {item.data.height}</small>
      </div>
      <div>
        <small>{item.dpi ? item.dpi : 'unk'} dpi</small>
      </div>
      <div>
        <button onClick={() => onAction(item.id, -1)} title="Move image to left.">&lt;</button>
        {' '}
        <button onClick={() => onAction(item.id, 1)} title="Move image to right.">&gt;</button>
        {' '}
        <button onClick={() => onAction(item.id, 0)} title="Delete image.">X</button>
      </div>
    </div>
  );
});

export default function ImageList() {
  const { busy, scanning } = useSANEContext();
  const { imageList, imageListSelect, imageListMove, imageListDelete, imageListDeleteAll } = useCanvasContext();
  const { type, quality, elFormatSelector, elQualitySelector } = useExportImageTypeSelector();
  const listRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  const onSelect = useCallback((id: string) => {
    if (!busy && !scanning) {
      imageListSelect(id);
    }
  }, [busy, scanning, imageListSelect]);

  const onExportAsPDF = useCallback(() => {
    if (imageList.some(item => !item.dpi)) {
      alert("Fail, some images have unknown DPI.");
      return;
    }
    if (type !== 'image/jpeg' && !window.confirm("Exporting big images as PDF using a format other than JPG can take a long time, cause the browser window to freeze/crash and create very big PDF files. Continue?")) {
      return;
    }
    const doc = new jsPDF({
      unit: 'in',
    });
    doc.deletePage(1);

    (async () => {
      for (const item of imageList) {
        const buf = await imageDataToBlob(item.data, type, quality / 100).then(blob => blob.arrayBuffer());
        const orientation = item.data.height >= item.data.width ? 'p' : 'l';
        doc.addPage([item.data.width / item.dpi!, item.data.height / item.dpi!], orientation);
        doc.addImage(new Uint8Array(buf), 0, 0, item.data.width / item.dpi!, item.data.height / item.dpi!, undefined, 'NONE');
      }
    })().then(() => {
      doc.save(constructImageExportName(type, quality, null, null, '.pdf'));
    });
    /*
    imageList.forEach(item => {
      const orientation = item.data.height >= item.data.width ? 'p' : 'l';
      doc.addPage([item.data.width / item.dpi!, item.data.height / item.dpi!], orientation);
      doc.addImage(item.data, 0, 0, item.data.width / item.dpi!, item.data.height / item.dpi!);
    });
    doc.save('scan.pdf');
    */
  }, [imageList, type, quality]);

  const onExportAsZIP = useCallback(() => {
    let i = 0;
    const gen = imageList.values();
    saveZipAs(constructImageExportName(type, quality, null, null, '.zip'), () => {
      const { value, done } = gen.next();
      return done ? null : imageDataToBlob(value.data, type, quality / 100).then(blob => ({
        name: constructImageExportName(type, quality, value.date, (i++).toString().padStart(5, '0')),
        lastModified: value.date,
        stream: blob.stream.bind(blob),
      }));
    });
  }, [imageList, type, quality]);

  const onAction = useCallback((id: string, n: number) => {
    if (n) {
      imageListMove(id, n);
    } else if (window.confirm("Delete image permanently?")) {
      imageListDelete(id);
    }
  }, [imageListMove, imageListDelete]);

  const onDeleteAll = useCallback(() => {
    if (window.confirm("Delete all images permanently?")) {
      imageListDeleteAll();
    }
  }, [imageListDeleteAll]);

  useLayoutEffect(() => {
    if (imageList.length > countRef.current) {
      listRef.current?.scrollTo(listRef.current.scrollWidth, 0);
    }
    countRef.current = imageList.length;
  });

  return imageList.length ? (
    <fieldset className="ImageList" disabled={busy || scanning}>
      <div ref={listRef} className="ImageList-List">
        {imageList.map(item => <ImageListItem key={item.id} item={item} onAction={onAction} onSelect={onSelect} />)}
      </div>
      <div className="ImageList-Controls">
        <button onClick={onDeleteAll} title="Delete all images.">Delete ALL Images</button>
        {' '}
        {elFormatSelector}
        {' '}
        {elQualitySelector}
        {' '}
        <button onClick={onExportAsPDF} title="Export as PDF, large files can cause the browser window to freeze.">Export as PDF</button>
        {' '}
        <button onClick={onExportAsZIP} title="Export as ZIP.">Export as ZIP</button>
      </div>
    </fieldset>
  ) : null;
}
