import { LR_AC, LR_AC_MANUAL, BR_AC, BR_AC_MANUAL, STUDY_AC, STUDY_AC_MANUAL } from "./entities";

export interface AcConfig {
  entity: string;
  label: string;
  sublabel: string;
  manualEntity: string;
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
    manualEntity: LR_AC_MANUAL,
    timerEntity: "",
    zoneTargetEntity: "",
    fanModes: ["auto", "low", "medium", "high"],
    swingModes: ["off", "both", "vertical", "horizontal"],
  },
  {
    entity: BR_AC,
    label: "Master Bedroom",
    sublabel: "AC",
    manualEntity: BR_AC_MANUAL,
    timerEntity: "",
    zoneTargetEntity: "",
    fanModes: ["auto", "low", "medium", "high", "quiet"],
    swingModes: ["off", "both", "vertical", "horizontal"],
  },
  {
    entity: STUDY_AC,
    label: "Study Room",
    sublabel: "AC",
    manualEntity: STUDY_AC_MANUAL,
    timerEntity: "",
    zoneTargetEntity: "",
    fanModes: ["auto", "low", "medium", "high", "quiet"],
    swingModes: ["off", "both", "vertical", "horizontal"],
  },
];
