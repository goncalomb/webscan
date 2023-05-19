import bytes from "bytes";

export function ImageBytes({ value }: { value: number | ImageData }) {
  const b = value instanceof ImageData ? value.data.byteLength : value;
  const bs = bytes(b, { unitSeparator: ' ' });
  return <abbr title={`${bs}, ${b} bytes, RGBA 8-bit uncompressed.`}>{bs}</abbr>;
}
