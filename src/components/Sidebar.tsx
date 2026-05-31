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
  BookOpen,
  FileCode2,
  Map,
  UserCircle,
  type LucideIcon,
} from "lucide-react";

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  onNewCard: () => void;
}

interface NavSection {
  label: string;
  items: { page: NavPage; label: string; icon: LucideIcon }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: "Card Types",
    items: [
      { page: "create",   label: "Create Character",    icon: PlusSquare },
      { page: "lorebook", label: "Create Lorebook",      icon: BookOpen },
      { page: "script",   label: "Create Script Card",   icon: FileCode2 },
      { page: "scenario", label: "Create Scenario Card", icon: Map },
      { page: "persona",  label: "Create Persona",       icon: UserCircle },
    ],
  },
  {
    label: "Collection",
    items: [
      { page: "library",   label: "Library",    icon: Library },
      { page: "templates", label: "Templates",  icon: LayoutTemplate },
    ],
  },
  {
    label: "Tools",
    items: [
      { page: "import",   label: "Import PNG",   icon: Upload },
      { page: "decode",   label: "Decode PNG",   icon: FileSearch },
      { page: "settings", label: "Settings",     icon: Settings },
      { page: "help",     label: "Help / About", icon: HelpCircle },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  return (
    <aside className="w-80 bg-bg-secondary border-r border-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center border-b border-border">
        <LogoImage />
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto px-2 space-y-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-3 mb-1">{section.label}</p>
            <div className="space-y-0.5">
              {section.items.map(({ page, label, icon: Icon }) => (
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
            </div>
          </div>
        ))}
      </nav>

      {/* Status */}
      <div className="border-t border-border px-4 py-2.5 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-accent-green shrink-0" />
        <span className="text-xs text-text-muted">Ready</span>
        <span className="ml-auto text-xs text-text-muted">v1.4.0</span>
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
