import bytes from "bytes";
import { ChangeEvent, useCallback, useMemo, useState } from "react";

export function ImageBytes({ value }: { value: number | ImageData }) {
  const b = value instanceof ImageData ? value.data.byteLength : value;
  const bs = bytes(b, { unitSeparator: ' ' });
  return <abbr title={`${bs}, ${b} bytes, RGBA 8-bit uncompressed.`}>{bs}</abbr>;
}

export function useExportImageTypeSelector() {
  const [format, setFormat] = useState('image/jpeg');
  const [quality, setQuality] = useState(95);

  const onChangeFormat = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setFormat(e.target.value);
  }, [setFormat]);

  const onChangeQuality = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuality(Math.min(100, Math.max(0, Number(e.target.value))));
  }, [setQuality]);

  const elFormatSelector = useMemo(() => (
    <select title="Export Image Format." value={format} onChange={onChangeFormat} >
      <option value="image/jpeg">JPEG</option>
      <option value="image/png">PNG</option>
    </select>
  ), [format, onChangeFormat]);

  const elQualitySelector = useMemo(() => (
    <input
      type="number"
      title="Export Image Quality (%). JPEG only."
      min={0}
      max={100}
      maxLength={5}
      value={quality}
      disabled={format !== 'image/jpeg'}
      onChange={onChangeQuality}
    />
  ), [format, quality, onChangeQuality]);

  return { format, quality, elFormatSelector, elQualitySelector };
}
