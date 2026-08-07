import { Thermometer } from "lucide-react";

export function TemperatureAdvice({ value, ageMonths }: { value: string; ageMonths: number | null }) {
  const temperature = value ? Number(value) : null;
  if (temperature === null || !Number.isFinite(temperature)) return null;
  const high = temperature >= 38;
  const low = temperature > 0 && temperature < 36;
  if (!high && !low) return null;
  return (
    <div className="health-alert" role="alert">
      <Thermometer size={18} />
      <p>
        {high && (ageMonths === null || ageMonths < 3) ? (
          // An unknown age fails SAFE: the blank-birth-date case is exactly the
          // newborn-in-hospital case, so the urgent wording is shown, not hidden.
          <>
            <strong>38 °C or higher</strong> (measured rectally) in a baby under 3 months needs urgent medical advice.
            {ageMonths === null && <> Add a birth date in Settings to tailor this advice.</>}
          </>
        ) : high ? (
          <><strong>Temperature recorded.</strong> If your baby seems unwell or you are concerned, seek medical advice.</>
        ) : (
          <><strong>Below 36 °C</strong> can matter as much as a fever in a young baby. If it repeats or your baby seems unwell, seek medical advice.</>
        )}
      </p>
    </div>
  );
}
