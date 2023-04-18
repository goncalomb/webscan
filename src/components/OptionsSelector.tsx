import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import './OptionsSelector.css';
import { useSANEContext } from '../SANEContext';
import { SANEConstraintType, SANEOptionDescriptor, SANEType, SANEUnit } from '../libsane';

interface IOptionGroup {
  title: string;
  inactive: boolean;
  advanced: boolean;
  options: IOption[];
}

interface IOption {
  pos: number;
  descriptor: SANEOptionDescriptor;
  value: any;
}

interface IOptionInputProps {
  descriptor: SANEOptionDescriptor;
  value: any;
  setValue: (value: any) => void;
}

// map each unit to readable text
const unitString = {
  [SANEUnit.NONE]: '',
  [SANEUnit.PIXEL]: 'pixel',
  [SANEUnit.BIT]: 'bit',
  [SANEUnit.MM]: 'mm',
  [SANEUnit.DPI]: 'dpi',
  [SANEUnit.PERCENT]: '%',
  [SANEUnit.MICROSECOND]: 'us',
};

/**
 * Option label placed after or before the option input.
 */
function OptionLabel({ descriptor, noTitle = false }: { descriptor: SANEOptionDescriptor, noTitle?: boolean }) {
  return (
    <small>
      {noTitle ? null : `${descriptor.title} `}
      {descriptor.unit !== SANEUnit.NONE ? `[${unitString[descriptor.unit]}] ` : null}
      {descriptor.constraint_type === SANEConstraintType.RANGE ? (
        <>
          {"[MIN:"}
          <abbr title={descriptor.constraint.min}>{Math.round(descriptor.constraint.min * 100) / 100}</abbr>
          {"/MAX:"}
          <abbr title={descriptor.constraint.max}>{Math.round(descriptor.constraint.max * 100) / 100}</abbr>
          {"/STEP:"}
          <abbr title={descriptor.constraint.quant || 1}>{Math.round((descriptor.constraint.quant || 1) * 100) / 100}</abbr>
          {"] "}
        </>
      ) : null}
      {descriptor.type === SANEType.STRING && descriptor.constraint_type === SANEConstraintType.NONE ? (
        `[MAX:${descriptor.size}]`
      ) : null}
      {descriptor.cap.EMULATED ? <><abbr title="This option is not directly supported by the device, but its function is emulated and may still work.">[EMULATED]</abbr> </> : null}
      <abbr title={descriptor.desc}>[?]</abbr>
    </small>
  );
}

/**
 * Option input for text and number options.
 */
function OptionInputText({ descriptor, value, setValue }: IOptionInputProps) {
  const [localValue, setLocalValue] = useState('');

  const onChange = useCallback((e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    if (descriptor.type === SANEType.INT || descriptor.type === SANEType.FIXED) {
      setValue(Number(e.target.value));
      if (descriptor.constraint_type === SANEConstraintType.NONE || descriptor.constraint_type === SANEConstraintType.RANGE) {
        setLocalValue(e.target.value);
      }
    } else {
      setValue(e.target.value);
    }
  }, [descriptor.type, descriptor.constraint_type, setValue]);

  // numbers use an extra local state and onblur event to prevent issues
  // while typing and being constantly "corrected" by the context value
  // fixed numbers could be truncated to represent the actual accuracy
  // XXX: improve fixed numbers

  const onBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    setLocalValue('');
  }, [setLocalValue]);

  return descriptor.constraint_type === SANEConstraintType.WORD_LIST || descriptor.constraint_type === SANEConstraintType.STRING_LIST ? (
    <label>
      <OptionLabel descriptor={descriptor} /><br />
      <select value={value} onChange={onChange}>
        {descriptor.constraint.map((value: any) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
  ) : (
    <label>
      <OptionLabel descriptor={descriptor} /><br />
      {descriptor.type === SANEType.STRING ? (
        <input type="text" maxLength={descriptor.size} value={value} onChange={onChange} />
      ) : (descriptor.constraint_type === SANEConstraintType.RANGE ? (
        <input
          type="number"
          maxLength={20}
          value={localValue || value}
          onBlur={onBlur}
          min={descriptor.constraint.min}
          max={descriptor.constraint.max}
          step={descriptor.constraint.quant || 1}
          onChange={onChange}
        />
      ) : (
        <input
          type="number"
          maxLength={20}
          value={localValue || value}
          onBlur={onBlur}
          onChange={onChange}
        />
      ))}
    </label>
  );
}

/**
 * Option input for boolean options.
 */
function OptionInputBoolean({ descriptor, value, setValue }: IOptionInputProps) {
  return (
    <label>
      <input type="checkbox" checked={value} onChange={e => setValue(e.target.checked)} /> <OptionLabel descriptor={descriptor} />
    </label>
  );
}

/**
 * Option input for button options.
 */
function OptionInputButton({ descriptor, setValue }: IOptionInputProps) {
  return (
    <label>
      <button onClick={e => setValue(null)}>{descriptor.title}</button> <OptionLabel descriptor={descriptor} noTitle />
    </label>
  );
}

// map each option type to a react element
const typeElements = {
  [SANEType.BOOL]: OptionInputBoolean,
  [SANEType.INT]: OptionInputText,
  [SANEType.FIXED]: OptionInputText,
  [SANEType.STRING]: OptionInputText,
  [SANEType.BUTTON]: OptionInputButton,
  [SANEType.GROUP]: () => null, // never used
};

/**
 * Individual option.
 */
function Option({ pos, descriptor, value, setOptionValue }: IOption & { setOptionValue: (option: number, value: any) => void }) {
  const setValue = useCallback((value?: any) => {
    setOptionValue(pos, value);
  }, [pos, setOptionValue]);

  // unsupported option
  if (descriptor.cap.HARD_SELECT || (descriptor.type !== SANEType.STRING && descriptor.size > 1)) {
    // TODO: implement unsupported options
    //       number arrays (size > 1) and cap.HARD_SELECT
    //       these are less common option types, but some may still be useful
    //       a notable one is gamma table that uses a number array, but for
    //       this case we might even create a special widget, other frontends
    //       also do this
    return (
      <p>
        <span>[ <abbr title="This type of option is not supported at the moment.">Unsupported</abbr> ]</span> <OptionLabel descriptor={descriptor} />
      </p>
    );
  }
  // read-write option
  if (descriptor.cap.SOFT_SELECT) {
    return (
      <p>
        {typeElements[descriptor.type]({ descriptor, value, setValue })}
        {descriptor.cap.AUTOMATIC ? (
          <> <button title="Automatic, let the device choose the value." onClick={e => setValue(/* undefined means auto */)}>AUTO</button></>
        ) : null}
      </p>
    );
  }
  // read-only option
  if (descriptor.cap.SOFT_DETECT) {
    return (
      <p>
        <span>[ {value === true ? "YES" : (value === false ? "NO" : value)} ]</span> <OptionLabel descriptor={descriptor} />
      </p>
    );
  }
  throw new Error("Invalid option"); // should never happen
}

/**
 * Memoized version of Option.
 */
const OptionMemo = React.memo(Option);

/**
 * Option group that contains a set of options.
 */
function OptionGroup({ group, showAdvanced, setOptionValue }: { group: IOptionGroup, showAdvanced: boolean, setOptionValue: (option: number, value: any) => void }) {
  return (
    <>
      <h3>
        {group.title}
      </h3>
      {group.options.map(o => !o.descriptor.cap.INACTIVE && (!o.descriptor.cap.ADVANCED || showAdvanced) ? (
        <OptionMemo
          key={o.descriptor.name}
          setOptionValue={setOptionValue}
          {...o}
        />
      ) : null)}
    </>
  );
}

/**
 * Option selector that contains all options and option groups.
 */
export default function OptionsSelector() {
  const { busy, lib, options, scanning, setOptionValue } = useSANEContext();
  const [showAdvanced, setShowAdvanced] = useState(false);

  // deconstruct options and group them
  const optionsByGroup = useMemo(() => {
    let group: IOptionGroup = { title: "General", inactive: true, advanced: true, options: [] };
    const result: IOptionGroup[] = [];
    for (let i = 1; i < options.length; i++) { // option 0 is always "number of options", don't need that
      const opt = options[i];
      if (opt.descriptor.type === lib?.SANE_TYPE.GROUP) {
        if (group.options.length) {
          result.push(group);
        }
        group = { title: opt.descriptor.title, inactive: true, advanced: true, options: [] };
      } else {
        group.inactive &&= opt.descriptor.cap.INACTIVE;
        group.advanced &&= opt.descriptor.cap.ADVANCED;
        group.options.push({ ...opt, pos: i });
      }
    }
    if (group.options.length) {
      result.push(group);
    }
    return result;
  }, [lib, options]);

  return (
    <fieldset className="OptionsSelector" disabled={busy || scanning}>
      {options.length ? (
        <label style={{ float: "right" }}>
          <input type="checkbox" defaultChecked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} /> Show Advanced
        </label>
      ) : null}
      {optionsByGroup.map(g => !g.inactive && (!g.advanced || showAdvanced) ? (
        <OptionGroup
          key={g.title}
          group={g}
          showAdvanced={showAdvanced}
          setOptionValue={setOptionValue}
        />
      ) : null)}
    </fieldset>
  );
}
