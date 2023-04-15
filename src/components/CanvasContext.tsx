import React, { ReactNode, useCallback, useContext, useRef } from 'react';

interface ICanvasContext {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  resetCanvas: (width: number, height: number) => void;
  putImageData: (data: ImageData, dy: number) => void;
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
  const ctxRef = useRef<CanvasRenderingContext2D>();

  const resetCanvas = useCallback((width: number, height: number) => {
    if (canvasRef.current) {
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

  return (
    <CanvasContext.Provider value={{
      canvasRef, resetCanvas, putImageData,
    }}>
      {children}
    </CanvasContext.Provider>
  );
}
