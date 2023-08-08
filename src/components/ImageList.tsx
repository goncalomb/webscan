import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { IImageListData, useCanvasContext } from './CanvasContext';
import './ImageList.css';
import { ImageBytes } from './Utilities';

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

const ImageListItem = React.memo(({ item, onSelect, onAction }: { item: IImageListData, onSelect: (id: number) => void, onAction: (id: number, n: number) => void }) => {
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
  const { imageList, imageListSelect, imageListMove, imageListDelete, imageListDeleteAll } = useCanvasContext();
  const listRef = useRef<HTMLDivElement>(null);
  const countRef = useRef(0);

  const onSelect = useCallback((id: number) => {
    imageListSelect(id);
  }, [imageListSelect]);

  const onAction = useCallback((id: number, n: number) => {
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
    <div ref={listRef} className="ImageList">
      <div className="ImageList-List">
        {imageList.map(item => <ImageListItem key={item.id} item={item} onAction={onAction} onSelect={onSelect} />)}
      </div>
      <div className="ImageList-Controls">
        <button onClick={onDeleteAll} title="Delete image.">Delete ALL Images</button>
      </div>
    </div>
  ) : null;
}
