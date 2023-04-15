import React from 'react';
import './Canvas.css';
import { useCanvasContext } from './CanvasContext';

export default function Canvas() {
  const { canvasRef } = useCanvasContext();
  return (
    <div className="Canvas">
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
