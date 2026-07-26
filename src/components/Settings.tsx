import { useState } from "react";
import type { AppSettings } from "../types";
import { DEFAULT_SETTINGS } from "../lib/settings";
import { Save, RotateCcw } from "lucide-react";

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export default function Settings({ settings, onSave }: SettingsProps) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const handleReset = () => setDraft({ ...DEFAULT_SETTINGS });

  const set = <K extends keyof AppSettings>(key: K, val: AppSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Settings</h1>
          <p className="text-sm text-text-secondary">Configure default export behavior and app preferences.</p>
        </div>

        <div className="card-panel space-y-3">
          <p className="section-title">Behavior</p>

          <Toggle
            label="Auto-validate before export"
            description="Show errors and block export if required fields are missing."
            checked={draft.autoValidateBeforeExport}
            onChange={(v) => set("autoValidateBeforeExport", v)}
          />
          <Toggle
            label="Preserve unknown metadata chunks"
            description="Keep existing tEXt/iTXt chunks that are not recognized Tavern Card keys."
            checked={draft.preserveUnknownChunks}
            onChange={(v) => set("preserveUnknownChunks", v)}
          />
          <Toggle
            label="Pretty-print JSON exports"
            description="Format exported JSON with indentation. Disable for smaller file size."
            checked={draft.prettyPrintJson}
            onChange={(v) => set("prettyPrintJson", v)}
          />
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-primary flex-1 justify-center">
            <Save size={15} />
            {saved ? "Saved!" : "Save Settings"}
          </button>
          <button onClick={handleReset} className="btn-secondary px-4">
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${
            checked ? "bg-accent-purple" : "bg-bg-hover border border-border"
          }`}
        />
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : ""
          }`}
        />
      </div>
      <div>
        <p className="text-sm font-medium text-text-primary group-hover:text-accent-purple-light transition-colors">
          {label}
        </p>
        <p className="text-xs text-text-muted">{description}</p>
      </div>
    </label>
  );
}
