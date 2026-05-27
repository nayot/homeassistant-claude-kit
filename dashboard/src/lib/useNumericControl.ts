import { useCallback } from "react";
import { useControlCommit, type ControlCommitOptions, type Phase } from "./useControlCommit";

interface NumericControlOptions extends Omit<ControlCommitOptions<number>, "isEqual"> {
  min: number;
  max: number;
  step: number;
  debounceMs?: number;
}

export interface NumericControlReturn {
  phase: Phase;
  displayValue: number;
  increment: () => void;
  decrement: () => void;
  set: (v: number) => void;
  commit: () => void;
}

function clamp(v: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, v));
  const snapped = Math.round(clamped / step) * step;
  // Fix floating point: round to step's decimal places
  const decimals = (step.toString().split(".")[1] ?? "").length;
  return parseFloat(snapped.toFixed(decimals));
}

export function useNumericControl(
  serverValue: number,
  onCommit: (v: number) => void | Promise<void>,
  opts: NumericControlOptions,
): NumericControlReturn {
  const { min, max, step, debounceMs = 400, group } = opts;

  const control = useControlCommit<number>(serverValue, onCommit, {
    debounceMs,
    group,
  });

  const increment = useCallback(() => {
    const next = clamp(control.displayValue + step, min, max, step);
    control.set(next);
  }, [control, step, min, max]);

  const decrement = useCallback(() => {
    const next = clamp(control.displayValue - step, min, max, step);
    control.set(next);
  }, [control, step, min, max]);

  return { ...control, increment, decrement };
}
