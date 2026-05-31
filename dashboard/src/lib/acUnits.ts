import { LR_AC, BR_AC, STUDY_AC } from "./entities";

export interface AcConfig {
  entity: string;
  label: string;
  sublabel: string;
  timerEntity: string;
  zoneTargetEntity: string;
  fanModes: string[];
  swingModes: string[];
}

export const AC_UNITS: AcConfig[] = [
  {
    entity: LR_AC,
    label: "Living Room",
    sublabel: "AC",
    timerEntity: "",
    zoneTargetEntity: "",
    fanModes: ["auto", "low", "medium", "high"],
    swingModes: ["off", "both", "vertical", "horizontal"],
  },
  {
    entity: BR_AC,
    label: "Master Bedroom",
    sublabel: "AC",
    timerEntity: "",
    zoneTargetEntity: "",
    fanModes: ["auto", "low", "medium", "high", "quiet"],
    swingModes: ["off", "both", "vertical", "horizontal"],
  },
  {
    entity: STUDY_AC,
    label: "Study Room",
    sublabel: "AC",
    timerEntity: "",
    zoneTargetEntity: "",
    fanModes: ["auto", "low", "medium", "high", "quiet"],
    swingModes: ["off", "both", "vertical", "horizontal"],
  },
];
