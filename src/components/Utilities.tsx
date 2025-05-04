import bytes from "bytes";
import { ChangeEvent, DependencyList, EffectCallback, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { CANVAS_SERIALIZATION_TYPES, CANVAS_SERIALIZATION_TYPE_BY_NAME, CANVAS_SERIALIZATION_TYPE_DEFAULT } from "../utils";

export function useDebouncedEffect(effect: EffectCallback, deps?: DependencyList, delay = 500) {
  useEffect(() => {
    const t = setTimeout(effect, delay);
    return () => {
      clearTimeout(t);
    };
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
}

// A move to useReducer might be in order, but I believe that using a stable
// callback is also a good solution.
// https://legacy.reactjs.org/docs/hooks-faq.html#how-to-read-an-often-changing-value-from-usecallback
// https://github.com/facebook/react/issues/14099
export function useStableCallback<TArgs extends any[], T>(callback: (...X: TArgs) => T, deps: DependencyList) {
  const ref = useRef<(...X: TArgs) => T>(callback);
  useLayoutEffect(() => {
    ref.current = callback;
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return useCallback(function (this: any, ...args: TArgs) {
    return ref.current?.apply(this, args);
  }, []);
}

export function ImageBytes({ value }: { value: number | ImageData }) {
  const b = value instanceof ImageData ? value.data.byteLength : value;
  const bs = bytes(b, { unitSeparator: ' ' });
  return <abbr title={`${bs}, ${b} bytes, RGBA 8-bit uncompressed.`}>{bs}</abbr>;
}

export function useExportImageTypeSelector(defaultType = CANVAS_SERIALIZATION_TYPE_DEFAULT.name) {
  const [type, setType] = useState(defaultType);
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
      value={CANVAS_SERIALIZATION_TYPE_BY_NAME[type].lossless ? "100" : quality}
      disabled={CANVAS_SERIALIZATION_TYPE_BY_NAME[type].lossless}
      onChange={onChangeQuality}
    />
  ), [type, quality, onChangeQuality]);

  return { type, quality, elFormatSelector, elQualitySelector };
}
