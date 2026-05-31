import { useState } from "react";
import { Download, FileJson, Copy, Check, ClipboardPaste, FileCode2 } from "lucide-react";
import type { ScriptCard } from "../types";
import { countTokens, getTokenBudgetLevel, TOKEN_BUDGET_COLORS, TOKEN_BUDGET_BAR_COLORS } from "../lib/tokenizer";
import { encodeCharaToPng } from "../lib/pngMetadata";

const DEFAULT: ScriptCard = {
  spec: "script_card_v1",
  name: "",
  description: "",
  content: "",
  tags: [],
  author: "",
  version: "1.0",
};

export default function ScriptEditor() {
  const [card, setCard] = useState<ScriptCard>(DEFAULT);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);

  function update(patch: Partial<ScriptCard>) {
    setCard((c) => ({ ...c, ...patch }));
  }

  function setMsg(msg: string, ok: boolean) {
    setStatus({ msg, ok });
    setTimeout(() => setStatus(null), 3000);
  }

  function exportJson() {
    const json = JSON.stringify(card, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (card.name || "script").replace(/\s+/g, "_") + "_script.json";
    a.click();
    URL.revokeObjectURL(url);
    setMsg("JSON exported!", true);
  }

  function exportPng() {
    const MINIMAL_PNG = new Uint8Array([
      137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,
      0,0,0,1,0,0,0,1,8,2,0,0,0,144,119,83,222,
      0,0,0,12,73,68,65,84,8,215,99,248,207,0,0,0,2,0,1,
      226,33,188,51,0,0,0,0,73,69,78,68,174,66,96,130,
    ]);
    try {
      const json = JSON.stringify(card);
      const result = encodeCharaToPng(MINIMAL_PNG, json, "script" as never, false);
      const blob = new Blob([result.buffer as ArrayBuffer], { type: "image/png" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = (card.name || "script").replace(/\s+/g, "_") + "_script.png";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("PNG exported!", true);
    } catch {
      setMsg("PNG export failed.", false);
    }
  }

  const tokens = countTokens(card.content);
  const level = getTokenBudgetLevel(tokens);
  const barPct = Math.min((tokens / 3000) * 100, 100);

  return (
    <div className="h-full flex overflow-hidden">
      {/* Editor */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        <div>
          <h1 className="text-lg font-bold text-text-primary flex items-center gap-2">
            <FileCode2 size={20} className="text-accent-purple" /> Script Card
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">Package a system prompt or instruction set as a portable card.</p>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label-base">Script Name</label>
            <input className="input-base" placeholder="My Script..." value={card.name} onChange={(e) => update({ name: e.target.value })} />
          </div>
          <div>
            <label className="label-base">Author</label>
            <input className="input-base" placeholder="Your name..." value={card.author} onChange={(e) => update({ author: e.target.value })} />
          </div>
        </div>

        <div>
          <label className="label-base">Description</label>
          <textarea className="input-base resize-none" rows={2} placeholder="What does this script do?" value={card.description} onChange={(e) => update({ description: e.target.value })} />
        </div>

        {/* Content */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="label-base mb-0">Script Content</label>
            <div className="flex items-center gap-2">
              {tokens > 0 && (
                <span className={`text-xs font-medium ${TOKEN_BUDGET_COLORS[level]}`}>{tokens} tokens</span>
              )}
              <CopyPasteButtons value={card.content} onChange={(v) => update({ content: v })} />
            </div>
          </div>
          <textarea
            className="input-base resize-none font-mono text-sm"
            rows={16}
            placeholder={"You are a helpful assistant...\n\nWrite your full system prompt or instruction set here."}
            value={card.content}
            onChange={(e) => update({ content: e.target.value })}
          />
          {/* Token bar */}
          {tokens > 0 && (
            <div className="mt-1.5">
              <div className="w-full h-1 bg-bg-tertiary rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${TOKEN_BUDGET_BAR_COLORS[level]}`} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Tags */}
        <div>
          <label className="label-base">Tags (comma-separated)</label>
          <input className="input-base" placeholder="roleplay, assistant, narration..." value={card.tags.join(", ")} onChange={(e) => update({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} />
          {card.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {card.tags.map((t) => <span key={t} className="badge-purple">{t}</span>)}
            </div>
          )}
        </div>
      </div>

      {/* Export panel */}
      <aside className="w-64 border-l border-border bg-bg-secondary flex flex-col shrink-0 p-4 gap-3">
        <p className="section-title">Export</p>

        <div className="space-y-1 text-xs text-text-secondary">
          <div className="flex justify-between"><span className="text-text-muted">Tokens</span><span className={`font-medium ${TOKEN_BUDGET_COLORS[level]}`}>{tokens}</span></div>
          <div className="flex justify-between"><span className="text-text-muted">Version</span><input className="input-base py-0.5 text-xs w-20 text-right" value={card.version} onChange={(e) => update({ version: e.target.value })} /></div>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <button onClick={exportJson} className="btn-primary w-full justify-center py-2.5">
            <FileJson size={14} /> Export JSON
          </button>
          <button onClick={exportPng} className="btn-secondary w-full justify-center py-2">
            <Download size={14} /> Embed in PNG
          </button>
        </div>

        {status && (
          <p className={`text-xs text-center ${status.ok ? "text-green-600" : "text-red-500"}`}>{status.msg}</p>
        )}

        <div className="border-t border-border pt-3 mt-auto text-xs text-text-muted space-y-1.5">
          <p><strong className="text-text-secondary">JSON</strong> — import directly in any compatible tool.</p>
          <p><strong className="text-text-secondary">PNG</strong> — embeds the script in a PNG using the <code className="bg-bg-tertiary px-1 rounded">script</code> chunk.</p>
        </div>
      </aside>
    </div>
  );
}

function CopyPasteButtons({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [copied, setCopied] = useState(false);
  const [hint, setHint] = useState(false);

  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      onChange(value + text);
    } catch {
      setHint(true);
      setTimeout(() => setHint(false), 2500);
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={copy} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
        {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
      </button>
      <div className="relative">
        <button type="button" onClick={paste} className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors">
          <ClipboardPaste size={12} />
        </button>
        {hint && <div className="absolute right-0 top-6 z-10 whitespace-nowrap bg-gray-800 text-white text-xs px-2 py-1 rounded shadow-lg">Press Ctrl+V</div>}
      </div>
    </div>
  );
}
