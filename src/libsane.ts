// XXX: these type definitions should eventually be completed
//      and moved to the sane-wasm project

export enum SANEType {
  BOOL = 0,
  INT,
  FIXED,
  STRING,
  BUTTON,
  GROUP,
}

export enum SANEUnit {
  NONE = 0,
  PIXEL,
  BIT,
  MM,
  DPI,
  PERCENT,
  MICROSECOND,
}

export enum SANEConstraintType {
  NONE = 0,
  RANGE,
  WORD_LIST,
  STRING_LIST,
}

export enum SANEFrame {
  GRAY = 0,
  RGB,
  RED,
  GREEN,
  BLUE,
}

export interface SANEState {
  initialized: boolean;
  version_code: number;
  version: {
    major: number;
    minor: number;
    build: number;
  },
  open: boolean;
}

export interface SANEDevice {
  name: string;
  vendor: string;
  model: string;
  type: string;
}

export interface SANEOptionDescriptor { // TODO: fix sane-wasm, only title and type are valid for groups
  name: string;
  title: string;
  desc: string;
  type: SANEType;
  unit: SANEUnit;
  size: number;
  cap: {
    SOFT_SELECT: boolean;
    HARD_SELECT: boolean;
    SOFT_DETECT: boolean;
    EMULATED: boolean;
    AUTOMATIC: boolean;
    INACTIVE: boolean;
    ADVANCED: boolean;
  };
  constraint_type: SANEConstraintType;
  constraint: any; // TODO: type this (conditional types?)
}

export interface SANEInfo {
  INEXACT: boolean;
  RELOAD_OPTIONS: boolean;
  RELOAD_PARAMS: boolean;
}

export interface SANEParameters {
  format: SANEFrame;
  last_frame: boolean;
  bytes_per_line: number;
  pixels_per_line: number;
  lines: number;
  depth: number;
}

type SANEEnum = {
  [key: string]: number; // TODO: proper types for the remaining enums
} & {
  asString: (n: number) => string | null;
}

export interface LibSANE {
  SANE_WASM_COMMIT: string;
  SANE_WASM_VERSION: string;
  SANE_CURRENT_MAJOR: number;
  SANE_CURRENT_MINOR: number;

  SANE_STATUS: SANEEnum;
  SANE_TYPE: SANEEnum;
  SANE_UNIT: SANEEnum;
  SANE_CONSTRAINT: SANEEnum;
  SANE_FRAME: SANEEnum;

  sane_get_state: () => SANEState;
  sane_init: () => number; // sync?
  sane_exit: () => Promise<void>;
  sane_get_devices: () => Promise<{ status: number; devices: SANEDevice[] }>;
  sane_open: (devicename: string) => Promise<{ status: number; }>;
  sane_close: () => Promise<void>;
  sane_get_option_descriptor: (option: number) => { status: number; option_descriptor: SANEOptionDescriptor | null };
  sane_control_option_get_value: (option: number) => Promise<{ status: number; value: any }>; // TODO: can be async, fix sane-wasm
  sane_control_option_set_value: (option: number, value: any) => Promise<{ status: number; info: SANEInfo }>; // TODO: can be async, fix sane-wasm
  sane_control_option_set_auto: (option: number) => Promise<{ status: number; info: SANEInfo }>; // TODO: can be async (probably), fix sane-wasm
  sane_get_parameters: () => { status: number; parameters: SANEParameters };
  sane_start: () => { status: number; };
  sane_read: () => { status: number; data: Uint8Array };
  sane_cancel: () => { status: number; };
  sane_strstatus: (status: number) => string;
}

declare global {
  interface Window {
    LibSANE?: (options?: any) => Promise<LibSANE>;
  }
}
