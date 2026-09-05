import { useState } from "react";
import type { AppSettings } from "../../types";
import { DEFAULT_SETTINGS } from "../../lib/settings";
import { Save, RotateCcw, Plug, Check } from "lucide-react";
import { getBridgeToken, setBridgeToken } from "../../lib/bridgeState";
import { BRIDGE_PORT } from "../../shared/bridgeProtocol";
import { useTimedFlag } from "../../hooks/useTimedFlag";

interface SettingsProps {
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export default function Settings({ settings, onSave }: SettingsProps) {
  const [draft, setDraft] = useState<AppSettings>({ ...settings });
  const [saved, flashSaved] = useTimedFlag();
  const [token, setToken] = useState(getBridgeToken);
  const [tokenSaved, flashTokenSaved] = useTimedFlag();

  const handleSaveToken = () => {
    setBridgeToken(token);
    flashTokenSaved();
  };

  const handleSave = () => {
    onSave(draft);
    flashSaved();
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

        <div className="card-panel space-y-3">
          <p className="section-title flex items-center gap-2">
            <Plug size={14} className="text-accent-purple" /> MCP bridge
          </p>
          <p className="text-sm text-text-secondary leading-relaxed">
            Lets a coding agent create and edit cards in your library. The MCP server prints a
            pairing token when it starts — paste it here once, then switch the bridge on with the
            <strong className="text-text-primary"> MCP</strong> light in the sidebar footer.
          </p>
          <div>
            <label htmlFor="bridge-token" className="label-base">Pairing token</label>
            <div className="flex gap-2">
              <input
                id="bridge-token"
                type="password"
                className="input-base font-mono text-xs flex-1"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste the token from the MCP server output"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                onClick={handleSaveToken}
                className="btn-secondary px-3 shrink-0"
                // Named, because once saved the label becomes a tick with no
                // text at all — leaving the button nameless to a screen reader.
                aria-label="Save pairing token"
              >
                {tokenSaved ? <Check size={14} className="text-status-ok" /> : "Save"}
              </button>
            </div>
            <p className="text-xs text-text-muted mt-1.5 leading-relaxed">
              Both sides prove they hold this token before anything is exchanged, so a different
              process that grabbed port {BRIDGE_PORT} first can't impersonate the server or read
              your cards. Without a matching token the app refuses to talk to it.
            </p>
          </div>
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
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        {/* The real control is visually hidden, so the focus ring has to be
            painted on the track — otherwise keyboard users see nothing at all. */}
        <div
          className={`w-9 h-5 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-accent-purple peer-focus-visible:ring-offset-2 ${
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
