import { useRef, useCallback } from "react";
import { useControlCommit, type ControlCommitOptions, type Phase } from "./useControlCommit";

interface SliderControlOptions extends Omit<ControlCommitOptions<number>, "isEqual"> {
  min: number;
  max: number;
  step?: number;
  isEqual?: (a: number, b: number) => boolean;
}

export interface SliderControlReturn {
  phase: Phase;
  ratio: number;
  dragging: boolean;
  displayValue: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: () => void;
}

function snapToStep(value: number, min: number, max: number, step: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  const snapped = Math.round((clamped - min) / step) * step + min;
  return Math.min(max, Math.max(min, snapped));
}

function ratioToValue(ratio: number, min: number, max: number, step: number): number {
  const raw = min + ratio * (max - min);
  return snapToStep(raw, min, max, step);
}

export function useSliderControl(
  serverValue: number,
  onCommit: (v: number) => void | Promise<void>,
  opts: SliderControlOptions,
): SliderControlReturn {
  const { min, max, step = 1, group, isEqual } = opts;

  const control = useControlCommit<number>(serverValue, onCommit, {
    debounceMs: 0,
    group,
    isEqual,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const isDragging = draggingRef.current;

  // We track dragging state separately for visual feedback
  // (re-render not needed per drag move — only on start/end)
  const dragValueRef = useRef<number>(serverValue);

  const getRatioFromEvent = useCallback((e: React.PointerEvent): number => {
    const el = containerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(1, ratio));
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.stopPropagation();
    draggingRef.current = true;
    dragValueRef.current = control.displayValue;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ratio = getRatioFromEvent(e);
    const value = ratioToValue(ratio, min, max, step);
    control.set(value);
  }, [control, getRatioFromEvent, min, max, step]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const ratio = getRatioFromEvent(e);
    const value = ratioToValue(ratio, min, max, step);
    control.set(value);
  }, [control, getRatioFromEvent, min, max, step]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const ratio = getRatioFromEvent(e);
    const value = ratioToValue(ratio, min, max, step);
    control.set(value);
    control.commit();
  }, [control, getRatioFromEvent, min, max, step]);

  const onPointerCancel = useCallback(() => {
    draggingRef.current = false;
  }, []);

  const range = max - min;
  const ratio = range > 0
    ? Math.max(0, Math.min(1, (control.displayValue - min) / range))
    : 0;

  return {
    phase: control.phase,
    ratio,
    dragging: isDragging,
    displayValue: control.displayValue,
    containerRef,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
