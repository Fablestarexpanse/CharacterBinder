import { useId } from "react";
import { AlertTriangle, Cpu, Server } from "lucide-react";
import { SORTER_MODELS, formatSize } from "../lib/personaLlm/models";
import { isRemoteUrl, type SorterSettings as Settings, type SorterBackend } from "../lib/personaLlm/settings";

interface SorterSettingsProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  webGpuAvailable: boolean;
  loadedModelId: string | null;
  onUnload: () => void;
}

/** Where the AI sorter runs, and which model it uses. */
export default function SorterSettings({ settings, onChange, webGpuAvailable, loadedModelId, onUnload }: SorterSettingsProps) {
  const remote = settings.backend === "endpoint" && isRemoteUrl(settings.endpointUrl);
  const modelId = useId();
  const urlId = useId();
  const endpointModelId = useId();
  const keyId = useId();

  return (
    <div className="space-y-3 border-t border-accent-purple/20 pt-3">
      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Sorter settings</p>

      {/* Backend */}
      <div className="grid grid-cols-2 gap-2">
        {([
          ["webllm", "In-browser", Cpu, "Runs on your GPU. Nothing sent anywhere."],
          ["endpoint", "Local server", Server, "Ollama, LM Studio, KoboldCpp…"],
        ] as Array<[SorterBackend, string, typeof Cpu, string]>).map(([value, label, Icon, hint]) => (
          <label
            key={value}
            className={`flex flex-col gap-0.5 p-2 rounded-md border cursor-pointer transition-colors ${
              settings.backend === value ? "border-accent-purple/50 bg-bg-secondary" : "border-border-light opacity-70"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <input
                type="radio"
                name="sorter-backend"
                checked={settings.backend === value}
                onChange={() => onChange({ backend: value })}
                className="accent-accent-purple"
              />
              <Icon size={12} className="text-accent-purple" />
              <span className="text-xs font-semibold text-text-primary">{label}</span>
            </span>
            <span className="text-xs text-text-muted leading-snug">{hint}</span>
          </label>
        ))}
      </div>

      {/* In-browser model picker */}
      {settings.backend === "webllm" && (
        <div className="space-y-2">
          {!webGpuAvailable && (
            <div className="flex gap-2 p-2 rounded-md bg-status-warn-soft border border-status-warn-border">
              <AlertTriangle size={13} className="text-status-warn shrink-0 mt-0.5" />
              <p className="text-xs text-status-warn leading-relaxed">
                This browser doesn't support WebGPU, so the in-browser model can't run. Use Chrome or Edge, or switch to
                a local server.
              </p>
            </div>
          )}

          <div>
            <label htmlFor={modelId} className="label-base">Model</label>
            <select
              id={modelId}
              className="input-base"
              value={settings.modelId}
              onChange={(e) => onChange({ modelId: e.target.value })}
            >
              {SORTER_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — about {formatSize(m.vramMB)}
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1">
              {SORTER_MODELS.find((m) => m.id === settings.modelId)?.blurb}
            </p>
          </div>

          <p className="text-xs text-text-muted leading-relaxed">
            The model downloads once from Hugging Face and is cached in your browser. After that it works offline, and
            your persona text never leaves the machine.
          </p>

          {loadedModelId && (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-text-secondary truncate">
                Loaded: <code className="bg-bg-tertiary px-1 rounded">{loadedModelId}</code>
              </span>
              <button type="button" onClick={onUnload} className="text-text-muted hover:text-text-primary underline shrink-0">
                Free memory
              </button>
            </div>
          )}
        </div>
      )}

      {/* Endpoint config */}
      {settings.backend === "endpoint" && (
        <div className="space-y-2">
          <div>
            <label htmlFor={urlId} className="label-base">Base URL</label>
            <input
              id={urlId}
              className="input-base font-mono text-xs"
              value={settings.endpointUrl}
              onChange={(e) => onChange({ endpointUrl: e.target.value, remoteAcknowledged: false })}
              placeholder="http://localhost:11434/v1"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={endpointModelId} className="label-base">Model</label>
              <input
                id={endpointModelId}
                className="input-base text-xs"
                value={settings.endpointModel}
                onChange={(e) => onChange({ endpointModel: e.target.value })}
                placeholder="llama3.2"
              />
            </div>
            <div>
              <label htmlFor={keyId} className="label-base">API key</label>
              <input
                id={keyId}
                type="password"
                className="input-base text-xs"
                value={settings.endpointKey}
                onChange={(e) => onChange({ endpointKey: e.target.value })}
                placeholder="optional"
              />
            </div>
          </div>

          {remote ? (
            <div className="flex gap-2 p-2 rounded-md bg-status-warn-soft border border-status-warn-border">
              <AlertTriangle size={13} className="text-status-warn shrink-0 mt-0.5" />
              <div className="space-y-1.5">
                <p className="text-xs text-status-warn leading-relaxed">
                  That address isn't on this machine. Everything you paste into Quick Import — the full persona text —
                  will be sent to it. CharacterBinder keeps everything local by default; this is the one thing that
                  doesn't.
                </p>
                <label className="flex items-start gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.remoteAcknowledged}
                    onChange={(e) => onChange({ remoteAcknowledged: e.target.checked })}
                    className="accent-status-warn mt-0.5"
                  />
                  <span className="text-xs text-status-warn font-medium">Send my persona text to this server anyway</span>
                </label>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted leading-relaxed">
              Pointing at your own machine — nothing leaves it. Ollama needs{" "}
              <code className="bg-bg-tertiary px-1 rounded">OLLAMA_ORIGINS=*</code> set to accept requests from the browser.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
