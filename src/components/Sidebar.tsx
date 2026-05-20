import { useState } from "react";
import type { NavPage } from "../types";
import {
  PlusSquare,
  Library,
  Upload,
  FileSearch,
  LayoutTemplate,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onNewCard: () => void;
}

const NAV_ITEMS: { page: NavPage; label: string; icon: LucideIcon }[] = [
  { page: "create", label: "Create Card", icon: PlusSquare },
  { page: "library", label: "Library", icon: Library },
  { page: "import", label: "Import PNG", icon: Upload },
  { page: "decode", label: "Decode PNG", icon: FileSearch },
  { page: "templates", label: "Templates", icon: LayoutTemplate },
  { page: "settings", label: "Settings", icon: Settings },
  { page: "help", label: "Help / About", icon: HelpCircle },
];

export default function Sidebar({ activePage, onNavigate, onNewCard }: SidebarProps) {
  return (
    <aside className="w-80 bg-bg-secondary border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-border">
        <LogoImage />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ page, label, icon: Icon }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
              activePage === page
                ? "bg-accent-purple/20 text-accent-purple-light border border-accent-purple/30"
                : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      {/* Quick Actions */}
      <div className="border-t border-border px-3 py-3 space-y-1.5">
        <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2 px-1">Quick Actions</p>
        <QuickBtn label="New Character" onClick={onNewCard} danger />
        <QuickBtn label="Load JSON" />
        <QuickBtn label="Save JSON" />
      </div>

      {/* Status */}
      <div className="border-t border-border px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-green shrink-0" />
        <span className="text-xs text-text-muted">Ready</span>
        <span className="ml-auto text-xs text-text-muted">v1.1.0</span>
      </div>
    </aside>
  );
}

function LogoImage() {
  const [failed, setFailed] = useState(false);

  if (!failed) {
    return (
      <img
        src="/logo.png"
        alt="CharacterBinder"
        className="w-full h-auto object-contain"
        onError={() => setFailed(true)}
        draggable={false}
      />
    );
  }

  // Fallback if logo.png not yet placed in public/
  return (
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg bg-accent-purple flex items-center justify-center shrink-0 text-white text-xs font-bold">CB</div>
      <span className="text-sm font-bold text-text-primary">CharacterBinder</span>
    </div>
  );
}

function QuickBtn({ label, onClick, danger }: { label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
        danger
          ? "text-text-secondary hover:bg-red-900/20 hover:text-red-400"
          : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
      }`}
    >
      <span className={`w-4 h-4 rounded border flex items-center justify-center ${
        danger ? "border-red-800/50 text-red-500/70" : "border-border text-text-muted"
      }`}>+</span>
      {label}
    </button>
  );
}
