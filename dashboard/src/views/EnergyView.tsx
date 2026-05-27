import { ENERGY_CONFIG } from "../lib/entities";
import { EnergyDetailCard } from "../components/cards/EnergyDetailCard";
import { MonthlyEnergyCard } from "../components/cards/MonthlyEnergyCard";
import { YearlyEnergyCard } from "../components/cards/YearlyEnergyCard";

export function EnergyView() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 py-2">
      <EnergyDetailCard config={ENERGY_CONFIG} />
      <MonthlyEnergyCard config={ENERGY_CONFIG} />
      <YearlyEnergyCard config={ENERGY_CONFIG} />
    </div>
  );
}
