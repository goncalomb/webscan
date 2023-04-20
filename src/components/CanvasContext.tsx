import React, { ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isNavigatorSupported } from '../utils';

class PhotopeaWindowManager {

  _w: Window | null = null;
  _ready = false;
  _queue: { type: string, data?: any }[] = [];

  _handleMessage = ({ origin, source, data: { type } }: MessageEvent) => {
    if (origin === window.origin && source === this._w) {
      if (type === 'ready') {
        this._ready = true;
        this._process();
      } else if (type === 'photopea') {
        // ...
      }
    }
  };

  _process() {
    if (this._w && !this._w.closed && this._ready) {
      const w = this._w;
      this._queue.forEach(m => w.postMessage(m), window.origin);
      this._queue = [];
    }
  }

  open() {
    if (!this._w || this._w.closed) {
      this._ready = false;
      this._w = window.open('/photopea.html');
      if (!this._w) {
        alert('Failed to open window.');
        return;
      }
    } else {
      this._w.focus();
    }
  }

  post(type: string, data?: any) {
    this._queue.push({ type, data });
    this._process();
  }

  connect() {
    window.addEventListener('message', this._handleMessage);
  }

  disconnect() {
    window.removeEventListener('message', this._handleMessage);
  }
}

interface ICanvasContext {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  notInitialized: boolean;
  resetCanvas: (width: number, height: number) => void;
  putImageData: (data: ImageData, dy: number) => void;
  exportDownload: (type: string, quality: number) => void;
  exportPhotopea: (type: string, quality: number) => void;
}

const CanvasContext = React.createContext<ICanvasContext | null>(null);

export const useCanvasContext = () => {
  const ctx = useContext(CanvasContext);
  if (!ctx) {
    throw new Error('Invalid CanvasContext');
  }
  return ctx;
};

export default function CanvasContextProvider({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [notInitialized, setNotInitialized] = useState(true);
  const ctxRef = useRef<CanvasRenderingContext2D>();
  const photopeaManagerRef = useRef(new PhotopeaWindowManager());

  const resetCanvas = useCallback((width: number, height: number) => {
    if (canvasRef.current) {
      setNotInitialized(false);
      canvasRef.current.width = width;
      canvasRef.current.height = height;
      ctxRef.current = canvasRef.current.getContext('2d') || undefined;
    }
  }, []);

  const putImageData = useCallback((data: ImageData, dy: number) => {
    if (ctxRef.current) {
      ctxRef.current.putImageData(data, 0, dy);
    }
  }, []);

  const exportDownload = useCallback((type: string, quality: number) => {
    if (canvasRef.current) {
      const exts: { [k: string]: string } = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
      };
      canvasRef.current.toBlob(blob => {
        if (blob) {
          let a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `scan.${exts[type] || 'bin'}`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 0);
        }
      }, type, quality);
    }
  }, []);

  const exportPhotopea = useCallback((type: string, quality: number) => {
    if (canvasRef.current) {
      photopeaManagerRef.current.open();
      canvasRef.current.toBlob(blob => {
        blob?.arrayBuffer().then(data => {
          photopeaManagerRef.current.post('photopea', data);
        });
      }, type, quality);
    }
  }, []);

  // draw canvas placeholder
  useEffect(() => {
    if (canvasRef.current) {
      const w = 500, h = 150;
      const text = isNavigatorSupported() ? 'Image Preview' : '¯\\_(ツ)_/¯';
      canvasRef.current.width = w;
      canvasRef.current.height = h;
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.font = '40px sans-serif';
        ctx.textBaseline = 'middle';
        const m = ctx.measureText(text);
        ctx.strokeText(text, (w / 2) - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, h / 2);
      }
    }
  }, []);

  // handle photopea window manager
  useEffect(() => {
    const manager = photopeaManagerRef.current;
    manager.connect();
    return () => {
      manager.disconnect();
    };
  }, []);

  return (
    <CanvasContext.Provider value={{
      notInitialized, canvasRef,
      resetCanvas, putImageData, exportDownload, exportPhotopea,
    }}>
      {children}
    </CanvasContext.Provider>
  );
}
