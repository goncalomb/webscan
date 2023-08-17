import React, { ChangeEvent, useCallback, useEffect, useMemo, useState } from 'react';
import './OptionsSelector.css';
import { useSANEContext } from '../SANEContext';
import { SANEConstraintType, SANEOptionDescriptor, SANEValueType, SANEUnit } from '../libsane';

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
  noLabel: boolean;
}

const SANE_WELL_KNOWN_OPTIONS = [
  'mode',
  'resolution'
];

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
          <abbr title={`${descriptor.constraint.min}`}>{Math.round(descriptor.constraint.min * 100) / 100}</abbr>
          {"/MAX:"}
          <abbr title={`${descriptor.constraint.max}`}>{Math.round(descriptor.constraint.max * 100) / 100}</abbr>
          {"/STEP:"}
          <abbr title={`${descriptor.constraint.quant || 1}`}>{Math.round((descriptor.constraint.quant || 1) * 100) / 100}</abbr>
          {"] "}
        </>
      ) : null}
      {descriptor.type === SANEValueType.STRING && descriptor.constraint_type === SANEConstraintType.NONE ? (
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
function OptionInputText({ descriptor, value, setValue, noLabel }: IOptionInputProps) {
  const [localValue, setLocalValue] = useState('');

  const onChange = useCallback((e: ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    if (descriptor.type === SANEValueType.INT || descriptor.type === SANEValueType.FIXED) {
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
      {noLabel ? null : <><OptionLabel descriptor={descriptor} /><br /></>}
      <select value={value} onChange={onChange}>
        {descriptor.constraint.map((value: any) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
  ) : (
    <label>
      {noLabel ? null : <><OptionLabel descriptor={descriptor} /><br /></>}
      {descriptor.type === SANEValueType.STRING ? (
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
function OptionInputBoolean({ descriptor, value, setValue, noLabel }: IOptionInputProps) {
  return (
    <label>
      <input type="checkbox" checked={value} onChange={e => setValue(e.target.checked)} />
      {noLabel ? null : <> <OptionLabel descriptor={descriptor} /></>}
    </label>
  );
}

/**
 * Option input for button options.
 */
function OptionInputButton({ descriptor, setValue, noLabel }: IOptionInputProps) {
  return (
    <label>
      <button onClick={e => setValue(null)}>{descriptor.title}</button>
      {noLabel ? null : <> <OptionLabel descriptor={descriptor} noTitle /></>}
    </label>
  );
}

// map each option type to a react element
const typeElements = {
  [SANEValueType.BOOL]: OptionInputBoolean,
  [SANEValueType.INT]: OptionInputText,
  [SANEValueType.FIXED]: OptionInputText,
  [SANEValueType.STRING]: OptionInputText,
  [SANEValueType.BUTTON]: OptionInputButton,
  [SANEValueType.GROUP]: () => null, // never used
};

/**
 * Individual option.
 */
function Option({ pos, descriptor, value, setOptionValue, noLabel = false, noAuto = false}: IOption & { setOptionValue: (option: number, value: any) => void, noLabel?: boolean, noAuto?: boolean }) {
  const setValue = useCallback((value?: any) => {
    setOptionValue(pos, value);
  }, [pos, setOptionValue]);

  // unsupported option
  if (descriptor.cap.HARD_SELECT || (descriptor.type !== SANEValueType.STRING && descriptor.size > 1)) {
    // TODO: implement unsupported options
    //       number arrays (size > 1) and cap.HARD_SELECT
    //       these are less common option types, but some may still be useful
    //       a notable one is gamma table that uses a number array, but for
    //       this case we might even create a special widget, other frontends
    //       also do this
    return (
      <label>
        <span>[ <abbr title="This type of option is not supported at the moment.">Unsupported</abbr> ]</span>
        {noLabel ? null : <> <OptionLabel descriptor={descriptor} /></>}
      </label>
    );
  }
  // read-write option
  if (descriptor.cap.SOFT_SELECT) {
    return (
      <>
        {typeElements[descriptor.type]({ descriptor, value, setValue, noLabel })}
        {descriptor.cap.AUTOMATIC && !noAuto ? (
          <> <button title="Automatic, let the device choose the value." onClick={e => setValue(/* undefined means auto */)}>AUTO</button></>
        ) : null}
      </>
    );
  }
  // read-only option
  if (descriptor.cap.SOFT_DETECT) {
    return (
      <label>
        <span>[ {value === true ? "YES" : (value === false ? "NO" : value)} ]</span>
        {noLabel ? null : <> <OptionLabel descriptor={descriptor} /></>}
      </label>
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
        <p>
          <OptionMemo
            key={o.descriptor.name}
            setOptionValue={setOptionValue}
            {...o}
          />
        </p>
      ) : null)}
    </>
  );
}

/**
 * Memoized version of OptionGroup.
 */
const OptionGroupMemo = React.memo(OptionGroup);

/**
 * Option selector that contains all options and option groups.
 */
export function OptionsSelectorAll({showAdvanced}: {showAdvanced:boolean}) {
  const { lib, options, setOptionValue } = useSANEContext();

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
    <div className="OptionsSelector-All">
      {optionsByGroup.map(g => !g.inactive && (!g.advanced || showAdvanced) ? (
        <OptionGroupMemo
          key={g.title}
          group={g}
          showAdvanced={showAdvanced}
          setOptionValue={setOptionValue}
        />
      ) : null)}
    </div>
  );
}

/**
 * Option selector that contains basic options.
 */
export function OptionsSelectorBasic() {
  const { lib, options, setOptionValue } = useSANEContext();

  // process options
  const { wellKnown } = useMemo(() => {
    const result: { wellKnown: IOption[] } = { wellKnown: [] };
    for (let i = 1; i < options.length; i++) { // option 0 is always "number of options", don't need that
      const opt = options[i];
      if (!opt.descriptor.cap.INACTIVE && SANE_WELL_KNOWN_OPTIONS.includes(opt.descriptor.name)) {
        result.wellKnown.push({ ...opt, pos: i });
      }
    }
    return result;
  }, [lib, options]);

  return (
    <table className="OptionsSelector-Basic">
      {wellKnown.map(o => (
        <tr key={o.descriptor.name}>
          <td>
            {`${o.descriptor.title}`}{o.descriptor.unit !== SANEUnit.NONE ? ` [${unitString[o.descriptor.unit]}]: ` : ': '}
          </td>
          <td>
            <OptionMemo
              setOptionValue={setOptionValue}
              noLabel
              noAuto
              {...o}
            />
          </td>
        </tr>
      ))}
    </table>
  );
}

export default function OptionsSelector() {
  const { lib, busy, options, scanning, setOptionValue } = useSANEContext();
  const [showAll, setShowAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!options.length) {
      setShowAll(false);
    }
  }, [options]);

  return options.length ? (
    <fieldset className="OptionsSelector" disabled={busy || scanning}>
      <p>
        {showAll ? (
          <>
            <button onClick={e => setShowAll(false)}>Show Basic Options</button>
            {' '}
            <label>
              <input type="checkbox" defaultChecked={showAdvanced} onChange={e => setShowAdvanced(e.target.checked)} /> <small>Advanced</small>
            </label>
          </>
        ) : (
          <button onClick={e => setShowAll(true)}>Show All Options</button>
        )}
      </p>
      {showAll ? <OptionsSelectorAll showAdvanced={showAdvanced} /> : <OptionsSelectorBasic />}
    </fieldset>
  ) : null;
}
