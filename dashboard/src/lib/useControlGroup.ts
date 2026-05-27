import { useRef } from "react";

// Shared state for controls on the same entity.
// When any member is inflight, idle siblings freeze their displayed value.
export interface ControlGroup {
  /** Number of controls currently in a non-idle phase for this entity. */
  inflightCount: number;
}

export function useControlGroup(): ControlGroup {
  const groupRef = useRef<ControlGroup>({ inflightCount: 0 });
  return groupRef.current;
}
