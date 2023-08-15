import React, { ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SANEOptionArray, saneWellKnownOptGetDPI } from '../libsane';
import { constructImageExportName, isNavigatorSupported } from '../utils';

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

export interface IImageListData {
  id: string;
  date: Date;
  data: ImageData;
  options: SANEOptionArray;
  dpi: number | null;
}

interface ICanvasContext {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  notInitialized: boolean;
  imageList: IImageListData[];
  resetCanvas: (width: number, height: number) => void;
  putImageData: (data: ImageData, dy: number) => void;
  exportDownload: (type: string, quality: number) => void;
  exportPhotopea: (type: string, quality: number) => void;
  imageListAdd: (data: ImageData, options: SANEOptionArray) => void;
  imageListSelect: (id: string) => void;
  imageListMove: (id: string, n: number) => void;
  imageListDelete: (id: string) => void;
  imageListDeleteAll: () => void;
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
  const [imageList, setImageList] = useState<IImageListData[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const resetCanvas = useCallback((width: number, height: number) => {
    if (canvasRef.current) {
      setSelectedImage(null);
      if (width === 0 || height === 0) {
        setNotInitialized(true);
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
      } else {
        setNotInitialized(false);
        canvasRef.current.width = width;
        canvasRef.current.height = height;
      }
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
      canvasRef.current.toBlob(blob => {
        if (blob) {
          let a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = constructImageExportName(type, quality);
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 0);
        }
      }, type, quality / 100);
    }
  }, []);

  const exportPhotopea = useCallback((type: string, quality: number) => {
    if (canvasRef.current) {
      photopeaManagerRef.current.open();
      canvasRef.current.toBlob(blob => {
        blob?.arrayBuffer().then(data => {
          photopeaManagerRef.current.post('photopea', data);
        });
      }, type, quality / 100);
    }
  }, []);

  const imageListAdd = useCallback((data: ImageData, options: SANEOptionArray) => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1e10)}`; // XXX: use uuid?
    const dpi = saneWellKnownOptGetDPI(options);
    setImageList(imageList => [...imageList, { id, date: new Date(), data, options, dpi }]);
    setSelectedImage(id);
  }, [setImageList, setSelectedImage]);

  const imageListSelect = useCallback((id: string) => {
    const item = imageList.find(item => item.id === id);
    if (ctxRef.current && item) {
      resetCanvas(item.data.width, item.data.height);
      setSelectedImage(id);
      ctxRef.current.putImageData(item.data, 0, 0);
    }
  }, [imageList, resetCanvas, setSelectedImage]);

  const imageListMove = useCallback((id: string, n: number) => {
    setImageList(imageList => {
      const i = imageList.findIndex(item => item.id === id);
      if (i !== -1 && i + n >= 0) {
        imageList = [...imageList];
        imageList.splice(i + n, 0, ...imageList.splice(i, 1));
      }
      return imageList;
    });
  }, [setImageList]);

  const imageListDelete = useCallback((id: string) => {
    setImageList(imageList => imageList.filter(item => item.id !== id));
    if (selectedImage === id) {
      resetCanvas(0, 0);
    }
  }, [selectedImage, setImageList, resetCanvas]);

  const imageListDeleteAll = useCallback(() => {
    setImageList([]);
    resetCanvas(0, 0);
  }, [setImageList, resetCanvas]);

  // draw canvas placeholder
  useEffect(() => {
    resetCanvas(0, 0);
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
      notInitialized, canvasRef, imageList,
      resetCanvas, putImageData, exportDownload, exportPhotopea, imageListAdd, imageListSelect, imageListMove, imageListDelete, imageListDeleteAll,
    }}>
      {children}
    </CanvasContext.Provider>
  );
}
