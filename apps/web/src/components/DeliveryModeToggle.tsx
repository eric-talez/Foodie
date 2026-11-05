"use client";

import type { DeliveryMode } from "../lib/types";

export function DeliveryModeToggle({ mode, onChange }: {
  mode: DeliveryMode;
  onChange: (mode: DeliveryMode) => void;
}) {
  return (
    <fieldset className="delivery-toggle" aria-describedby="delivery-mode-help">
      <legend>Delivery option</legend>
      <div className="delivery-options">
        <label>
          <input type="radio" name="delivery-mode" value="GROUPED" checked={mode === "GROUPED"}
            onChange={() => onChange("GROUPED")} />
          Grouped delivery
        </label>
        <label>
          <input type="radio" name="delivery-mode" value="DIRECT" checked={mode === "DIRECT"}
            onChange={() => onChange("DIRECT")} />
          Direct delivery
        </label>
      </div>
      <p id="delivery-mode-help">Compare each restaurant’s delivery fee and estimated arrival before choosing.</p>
    </fieldset>
  );
}
