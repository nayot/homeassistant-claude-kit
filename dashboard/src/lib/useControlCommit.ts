import { useState, useEffect, useRef, useCallback } from "react";
import type { ControlGroup } from "./useControlGroup";

export type Phase = "idle" | "debouncing" | "inflight" | "correction";

export interface ControlCommitOptions<T> {
  debounceMs?: number;
  group?: ControlGroup;
  isEqual?: (a: T, b: T) => boolean;
}

export interface ControlCommitReturn<T> {
  phase: Phase;
  displayValue: T;
  set: (v: T) => void;
  commit: () => void;
}

const SAFETY_TIMEOUT_MS = 15_000;
const POST_CONFIRM_HOLD_MS = 3_000;
function defaultEq<T>(a: T, b: T): boolean {
  return a === b;
}

export function useControlCommit<T>(
  serverValue: T,
  onCommit: (v: T) => void | Promise<void>,
  opts: ControlCommitOptions<T> = {},
): ControlCommitReturn<T> {
  const { debounceMs = 300, group, isEqual = defaultEq } = opts;

  const [phase, setPhase] = useState<Phase>("idle");
  const [displayValue, setDisplayValue] = useState<T>(serverValue);

  // Refs to avoid stale closures in timers
  const phaseRef = useRef<Phase>("idle");
  const displayRef = useRef<T>(serverValue);
  const inflightRef = useRef<T>(serverValue);
  const pendingRef = useRef<T | null>(null);
  const onCommitRef = useRef(onCommit);
  const isEqualRef = useRef(isEqual);
  const serverRef = useRef(serverValue);

  onCommitRef.current = onCommit;
  isEqualRef.current = isEqual;
  serverRef.current = serverValue;

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function updatePhase(p: Phase) {
    phaseRef.current = p;
    setPhase(p);
    if (group) {
      if (p === "idle") {
        group.inflightCount = Math.max(0, group.inflightCount - 1);
      } else if (p === "inflight") {
        group.inflightCount += 1;
      }
    }
  }

  function updateDisplay(v: T) {
    displayRef.current = v;
    setDisplayValue(v);
  }

  function clearAll() {
    clearTimeout(debounceTimer.current);
    clearTimeout(safetyTimer.current);
    clearTimeout(holdTimer.current);
  }

  const fire = useCallback((value: T) => {
    if (isEqualRef.current(serverRef.current, value)) {
      // Server already has this value — skip inflight
      clearAll();
      updatePhase("idle");
      updateDisplay(serverRef.current);
      pendingRef.current = null;
      return;
    }
    inflightRef.current = value;
    clearTimeout(safetyTimer.current);
    updatePhase("inflight");
    safetyTimer.current = setTimeout(() => {
      if (phaseRef.current !== "inflight") return;
      const pending = pendingRef.current;
      pendingRef.current = null;
      updatePhase("idle");
      if (pending !== null) {
        // Retry the queued value
        fireLater(pending);
      }
    }, SAFETY_TIMEOUT_MS);
    onCommitRef.current(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fireLater(value: T) {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => fire(value), 0);
  }

  const set = useCallback((value: T) => {
    updateDisplay(value);
    const p = phaseRef.current;
    if (p === "idle" || p === "debouncing") {
      clearTimeout(debounceTimer.current);
      if (debounceMs === 0) {
        fire(value);
      } else {
        updatePhase("debouncing");
        debounceTimer.current = setTimeout(() => fire(value), debounceMs);
      }
    } else {
      // inflight or correction: queue for after
      pendingRef.current = value;
    }
  }, [debounceMs, fire]);

  const commit = useCallback(() => {
    clearTimeout(debounceTimer.current);
    const value = displayRef.current;
    if (phaseRef.current === "idle" || phaseRef.current === "debouncing") {
      fire(value);
    } else {
      pendingRef.current = value;
    }
  }, [fire]);

  // Follow server value changes
  useEffect(() => {
    const p = phaseRef.current;

    if (p === "idle") {
      // Group freeze: if any sibling is inflight, don't update display
      if (group && group.inflightCount > 0) return;
      updateDisplay(serverValue);
      return;
    }

    if (p === "debouncing") {
      // User is actively interacting — don't follow server
      return;
    }

    if (p === "inflight") {
      if (isEqualRef.current(serverValue, inflightRef.current)) {
        // Server confirmed our value — start post-confirmation hold
        clearTimeout(safetyTimer.current);
        clearTimeout(holdTimer.current);
        holdTimer.current = setTimeout(() => {
          if (phaseRef.current !== "inflight") return;
          const pending = pendingRef.current;
          pendingRef.current = null;
          updatePhase("idle");
          if (pending !== null) {
            fireLater(pending);
          }
        }, POST_CONFIRM_HOLD_MS);
      }
      // Non-matching values are intermediate states — ignore during inflight
      return;
    }

    if (p === "correction") {
      // Already handling correction — ignore
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverValue]);

  // After hold transitions us to idle, also watch for server revert during hold
  // (handled by the safety timer + the correction path below)
  useEffect(() => {
    // If we go idle but server disagrees with what we show, that's a correction
    if (
      phase === "idle" &&
      !isEqualRef.current(serverValue, displayRef.current) &&
      !isEqualRef.current(serverValue, serverRef.current)
    ) {
      // This can fire on mount — only trigger correction if we were ever inflight
      // We use the guard that correction only applies when there's a real divergence
      // after the hold. Since we set displayValue to server on idle normally, this
      // case shouldn't normally occur. Just sync.
      updateDisplay(serverValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, serverValue]);

  return { phase, displayValue, set, commit };
}
