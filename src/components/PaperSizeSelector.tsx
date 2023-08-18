import { useMemo, useState } from "react";
import { useSANEContext } from "../SANEContext";
import { SANEConstraintType, SANEOptionDescriptor, SANEUnit } from "../libsane-types";
import { PAPER_SIZES_ALL_SORTED, in2mm } from "../utils";
import { useDebouncedEffect } from "./Utilities";

/**
 * Hook to manage PaperSizeSelector state and props.
 */
export function usePaperSizeSelector() {
  const { options, setOptionValue } = useSANEContext(); // XXX: use props?
  const [paperSize, setPaperSize] = useState('Other');

  // find area options and paper sizes that fit scanning area
  // memoize the results
  const { paperSizes, updatePaperSize, getCurrentArea } = useMemo(() => {
    let tlxN = -1, tlyN = -1, brxN = -1, bryN = -1;
    let minX = 0, minY = 0, maxX = 0, maxY = 0;

    // -1 = disabled / 0 = automatic
    const paperSizes: typeof PAPER_SIZES_ALL_SORTED = [
      { name: 'Other', w: -1, h: -1, unit: 'mm' },
    ];

    // function to update area options and local state
    const updatePaperSize = async (name: string) => {
      const size = paperSizes.find(s => s.name === name);
      if (size) {
        if (size.w > 0 && size.h > 0) {
          await setOptionValue(tlxN, minX);
          await setOptionValue(tlyN, minY);
          if (size.unit === 'in') {
            await setOptionValue(brxN, minX + in2mm(size.w));
            await setOptionValue(bryN, minY + in2mm(size.h));
          } else {
            await setOptionValue(brxN, minX + size.w);
            await setOptionValue(bryN, minY + size.h);
          }
        } else {
          // automatic
          await setOptionValue(tlxN);
          await setOptionValue(tlyN);
          await setOptionValue(brxN);
          await setOptionValue(bryN);
        }
        // update local state
        setPaperSize(name);
      }
    };

    // util to calculate area based on current options
    const getCurrentArea = (options: { descriptor: SANEOptionDescriptor; value: any; }[]) => (
      tlxN !== -1 && tlyN !== -1 && brxN !== -1 && bryN !== -1 ? (
        { w: options[brxN].value - options[tlxN].value, h: options[bryN].value - options[tlyN].value }
      ) : (
        { w: 0, h: 0 }
      )
    );

    // find area options
    for (let i = 0; i < options.length; i++) {
      switch (options[i].descriptor.name) {
      case 'tl-x': tlxN = i; break;
      case 'tl-y': tlyN = i; break;
      case 'br-x': brxN = i; break;
      case 'br-y': bryN = i; break;
      }
    }

    // check for valid options
    if (![tlxN, tlyN, brxN, bryN].some(n => (
      n === -1
      || options[n].descriptor.unit !== SANEUnit.MM
      || options[n].descriptor.constraint_type !== SANEConstraintType.RANGE
      || !options[n].descriptor.cap.SOFT_SELECT
      || options[n].descriptor.cap.INACTIVE
    ))) {
      // get constraints
      // they are expected to be all the same for all 4 area options
      // type abuse, but we already checked for SANEConstraintType.RANGE
      minX = (options[tlxN].descriptor.constraint as { min: number }).min;
      minY = (options[tlyN].descriptor.constraint as { min: number }).min;
      maxX = (options[brxN].descriptor.constraint as { max: number }).max;
      maxY = (options[bryN].descriptor.constraint as { max: number }).max;
      const dx = maxX - minX;
      const dy = maxY - minY;

      // add automatic paper size option, if options support it
      if ([tlxN, tlyN, brxN, bryN].every(n => options[n].descriptor.cap.AUTOMATIC)) {
        paperSizes.push({ name: 'Automatic', w: 0, h: 0, unit: 'mm' });
      }
      // add full paper size option
      paperSizes.push({ name: 'Full', w: dx, h: dy, unit: 'mm' });
      // add paper sizes that fit scanning area
      paperSizes.push(...PAPER_SIZES_ALL_SORTED.filter(({ w, h, unit }) => (
        unit === 'in' ? in2mm(w) <= dx && in2mm(h) <= dy : w <= dx && h <= dy
      )));
    } else {
      // area options not found / not valid
      paperSizes.pop(); // clear
    }

    return { paperSizes, updatePaperSize, getCurrentArea };

    // using options.length as a dep instead of options is a performance
    // optimization, none of the option fields used for these calculations
    // (e.g. constraint, cap) are expected to change even if option values
    // change, we just need to re-run these calculations when the entire
    // options are torn down or rebuilt (i.e. device close / open)
    // this is not completely correct but works for our current usage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length, setPaperSize, setOptionValue]);

  // effect to update selected paper size in case the area options were
  // changed manually, debounce to avoid unnecessary checks, specially if
  // we just selected a paper size and 4 options need to change quickly
  // the debounce could be removed if we had a way to set multiple options
  // without triggering multiple state (context) changes
  useDebouncedEffect(() => {
    // compare area with size
    function testSize(area: { w: number, h: number }, size: typeof PAPER_SIZES_ALL_SORTED[0]) {
      if (size.w > 0 && size.h > 0) {
        let { w, h } = size;
        if (size.unit === 'in') {
          w = in2mm(w);
          h = in2mm(h);
        }
        // consider a match if is within 1mm
        return Math.abs(area.w - w) < 1 && Math.abs(area.h - h) < 1;
      }
      return false;
    }
    // get current selected size
    let size = paperSizes.find(s => s.name === paperSize);
    if (size) {
      // if current selected size still matches with selected area, do nothing
      const area = getCurrentArea(options);
      if (testSize(area, size)) {
        return;
      }
      // if not, find a paper size that matches current area, or set as other
      size = paperSizes.find(s => testSize(area, s));
      if (size) {
        setPaperSize(size.name);
      } else {
        setPaperSize('Other');
      }
    }
  }, [options, paperSize, paperSizes], 500);

  return { paperSizes, paperSize, setPaperSize: updatePaperSize };
}

/**
 * Select input component for paper sizes.
 */
export default function PaperSizeSelector({ paperSizes, paperSize, setPaperSize }: { paperSizes: typeof PAPER_SIZES_ALL_SORTED, paperSize: string, setPaperSize: (name: string) => Promise<void> }) {
  return paperSizes.length ? (
    <select value={paperSize} onChange={e => setPaperSize(e.target.value)}>
      {paperSizes.map(({ name, w, h, unit }) => (
        <option
          key={name}
          value={name}
          disabled={h === -1 || w === -1}
        >
          {name}{w > 0 && h > 0 ? <> ({Math.round(w * 100) / 100}{unit} x {Math.round(h * 100) / 100}{unit})</> : null}
        </option>
      ))}
    </select>
  ) : null;
}
