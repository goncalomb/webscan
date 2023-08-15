import bytes from "bytes";
import { ChangeEvent, useCallback, useMemo, useState } from "react";
import { CANVAS_SERIALIZATION_TYPES, CANVAS_SERIALIZATION_TYPE_BY_NAME, CANVAS_SERIALIZATION_TYPE_DEFAULT } from "../utils";

export function ImageBytes({ value }: { value: number | ImageData }) {
  const b = value instanceof ImageData ? value.data.byteLength : value;
  const bs = bytes(b, { unitSeparator: ' ' });
  return <abbr title={`${bs}, ${b} bytes, RGBA 8-bit uncompressed.`}>{bs}</abbr>;
}

export function useExportImageTypeSelector() {
  const [type, setType] = useState(CANVAS_SERIALIZATION_TYPE_DEFAULT.name);
  const [quality, setQuality] = useState(95);

  const onChangeType = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setType(e.target.value);
  }, [setType]);

  const onChangeQuality = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setQuality(Math.min(100, Math.max(0, Number(e.target.value))));
  }, [setQuality]);

  const elFormatSelector = useMemo(() => (
    <select title="Export image format." value={type} onChange={onChangeType}>
      {CANVAS_SERIALIZATION_TYPES.map(f => <option key={f.name} value={f.name}>{f.ext.substring(1).toUpperCase()}</option>)}
    </select>
  ), [type, onChangeType]);

  const elQualitySelector = useMemo(() => (
    <input
      type="number"
      title="Export image quality (%)."
      min={0}
      max={100}
      maxLength={5}
      value={quality}
      disabled={CANVAS_SERIALIZATION_TYPE_BY_NAME[type].lossless}
      onChange={onChangeQuality}
    />
  ), [type, quality, onChangeQuality]);

  return { type, quality, elFormatSelector, elQualitySelector };
}
