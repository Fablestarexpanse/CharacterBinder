import { BookOpen, Code2, Puzzle, AlertTriangle, type LucideIcon } from "lucide-react";

export default function HelpAbout() {
  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary mb-1">Help & About</h1>
          <p className="text-sm text-text-secondary">
            CharacterBinder v1.0.0 — A local-only tool for creating and editing Tavern Card PNGs.
          </p>
        </div>

        <InfoSection icon={BookOpen} title="What are Tavern Card PNGs?">
          <p>
            Tavern Card PNGs are standard PNG image files that contain hidden character data embedded
            inside the PNG's metadata chunks. When you open one in a compatible AI roleplay platform
            (like SillyTavern), the app reads the hidden character data and automatically sets up the
            AI persona.
          </p>
          <p className="mt-2">
            The character data is stored as JSON, then Base64-encoded and placed into a{" "}
            <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">tEXt</code> chunk
            with the keyword <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">chara</code>.
          </p>
        </InfoSection>

        <InfoSection icon={Code2} title="How PNG Metadata Embedding Works">
          <ol className="list-decimal list-inside space-y-1.5">
            <li>Your character data is serialized as a JSON object following the Tavern Card v2 spec.</li>
            <li>The JSON string is encoded to Base64.</li>
            <li>A PNG <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">tEXt</code> chunk is inserted into the PNG file with keyword <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">chara</code> and the Base64 string as its value.</li>
            <li>The resulting PNG looks identical to the original image but carries the character data invisibly.</li>
          </ol>
          <div className="mt-3 bg-bg-tertiary rounded-lg p-3 font-mono text-xs text-text-secondary border border-border">
            <div>PNG Signature (8 bytes)</div>
            <div>→ IHDR chunk (image dimensions, etc.)</div>
            <div>→ <span className="text-accent-purple-light">tEXt chunk: "chara" = Base64(JSON)</span></div>
            <div>→ tEXt chunk: "name" = character name</div>
            <div>→ IDAT chunks (compressed pixel data)</div>
            <div>→ IEND chunk</div>
          </div>
        </InfoSection>

        <InfoSection icon={Puzzle} title="Supported Platforms">
          <div className="space-y-2">
            {[
              { name: "SillyTavern", key: "chara", note: "Full Tavern Card v2 support" },
              { name: "JanitorAI", key: "character / janitor", note: "JSON export compatible" },
              { name: "RPBuddy", key: "rpbuddy", note: "JSON export compatible" },
              { name: "Agnai", key: "agnai", note: "JSON export compatible" },
              { name: "Generic Platforms", key: "any", note: "PNG + embedded JSON fallback" },
            ].map((p) => (
              <div key={p.name} className="flex items-center gap-3 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
                <span className="font-medium text-text-primary w-32">{p.name}</span>
                <code className="text-xs text-accent-purple-light bg-bg-tertiary px-1.5 py-0.5 rounded">{p.key}</code>
                <span className="text-text-muted text-xs">{p.note}</span>
              </div>
            ))}
          </div>
        </InfoSection>

        <InfoSection icon={AlertTriangle} title="Compatibility Notes">
          <ul className="list-disc list-inside space-y-1 text-sm">
            <li>Platform compatibility may vary by version. Always test exported cards in your target platform.</li>
            <li>The <code className="text-accent-purple-light bg-bg-tertiary px-1 rounded">chara</code> key is the most widely supported. Use it unless you have a specific reason to change it.</li>
            <li>This app does not use EXIF metadata — only PNG tEXt/iTXt chunks, which is the standard Tavern Card approach.</li>
            <li>Large character cards (system prompts &gt;8KB) may cause performance issues in some platforms.</li>
            <li>All processing is done locally. No data is sent to any server.</li>
          </ul>
        </InfoSection>

        <div className="card-panel text-center py-6 text-text-muted">
          <p className="text-sm">Built with Tauri + React + TypeScript</p>
          <p className="text-xs mt-1">CharacterBinder is open source and runs 100% locally.</p>
          <p className="text-xs mt-1">Character data never leaves your machine.</p>
        </div>
      </div>
    </div>
  );
}

function InfoSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card-panel">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-7 h-7 rounded-lg bg-accent-purple/20 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-accent-purple-light" />
        </div>
        <p className="font-semibold text-text-primary">{title}</p>
      </div>
      <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
    </div>
  );
}
