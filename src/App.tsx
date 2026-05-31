import { useState, useCallback } from "react";
import type { TavernCardV2, NavPage, AppSettings, MetadataInfo, CardProject, LoreBook, ScriptCard, ScenarioCard } from "./types";
import type { PlatformId } from "./lib/platforms";
import { ronanVossTemplate } from "./data/templates/ronalVoss";
import { blankTemplate } from "./data/templates/ronalVoss";
import Sidebar from "./components/Sidebar";
import CreateCard from "./components/CreateCard";
import ImportPNG from "./components/ImportPNG";
import DecodePNG from "./components/DecodePNG";
import Templates from "./components/Templates";
import Settings from "./components/Settings";
import HelpAbout from "./components/HelpAbout";
import Library from "./components/Library";
import LoreBookEditor from "./components/LoreBookEditor";
import ScriptEditor from "./components/ScriptEditor";
import ScenarioEditor from "./components/ScenarioEditor";
import ConfirmModal from "./components/ConfirmModal";

const DEFAULT_SETTINGS: AppSettings = {
  defaultExportFormat: "tavern_v2",
  defaultMetadataKey: "chara",
  autoValidateBeforeExport: true,
  preserveUnknownChunks: true,
  prettyPrintJson: true,
};

function App() {
  const [activePage, setActivePage] = useState<NavPage>("create");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [targetPlatform, setTargetPlatform] = useState<PlatformId>("sillytavern");
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // ── Character card state ──
  const [project, setProject] = useState<CardProject>({
    id: "default",
    name: "Ronan Voss",
    card: ronanVossTemplate,
    imageSrc: undefined,
    templateImageSrc: undefined,
    outputFileName: "Ronan_Voss_Tavern_Card.png",
    lastModified: new Date().toISOString(),
  });

  // ── Lorebook editor library-load state ──
  const [lorebookKey, setLorebookKey] = useState(0);
  const [lorebookInit, setLorebookInit] = useState<{
    book: LoreBook; imageSrc: string | null; id: string;
  } | null>(null);

  // ── Script editor library-load state ──
  const [scriptKey, setScriptKey] = useState(0);
  const [scriptInit, setScriptInit] = useState<{
    card: ScriptCard; imageSrc: string | null; id: string;
  } | null>(null);

  // ── Scenario editor library-load state ──
  const [scenarioKey, setScenarioKey] = useState(0);
  const [scenarioInit, setScenarioInit] = useState<{
    card: ScenarioCard; imageSrc: string | null; id: string;
  } | null>(null);

  // ── Character card handlers ──
  const updateCard = useCallback((updates: Partial<TavernCardV2["data"]>) => {
    setProject((p) => ({
      ...p,
      card: { ...p.card, data: { ...p.card.data, ...updates } },
      lastModified: new Date().toISOString(),
    }));
  }, []);

  const loadCard = useCallback((
    card: TavernCardV2,
    imageSrc?: string,
    meta?: MetadataInfo,
    sourcePlatform?: PlatformId
  ) => {
    setProject((p) => ({
      ...p,
      card,
      imageSrc,
      outputFileName: card.data.name.replace(/\s+/g, "_") + "_Tavern_Card.png",
      lastModified: new Date().toISOString(),
      metadataInfo: meta,
    }));
    if (sourcePlatform) setTargetPlatform(sourcePlatform);
    setActivePage("create");
  }, []);

  const loadFromLibrary = useCallback((
    card: TavernCardV2,
    _pngData: Uint8Array | null,
    imageSrc: string | null,
    libraryId: string
  ) => {
    setProject((p) => ({
      ...p,
      id: libraryId,
      card,
      imageSrc: imageSrc ?? undefined,
      outputFileName: card.data.name.replace(/\s+/g, "_") + "_Tavern_Card.png",
      lastModified: new Date().toISOString(),
      metadataInfo: undefined,
    }));
    setActivePage("create");
  }, []);

  const updateImage = useCallback((imageSrc: string) => {
    setProject((p) => ({ ...p, imageSrc }));
  }, []);

  const updateOutputFileName = useCallback((name: string) => {
    setProject((p) => ({ ...p, outputFileName: name }));
  }, []);

  const clearCard = useCallback(() => {
    setProject({
      id: "default",
      name: "",
      card: blankTemplate,
      imageSrc: undefined,
      templateImageSrc: undefined,
      outputFileName: "New_Character_Tavern_Card.png",
      lastModified: new Date().toISOString(),
      metadataInfo: undefined,
    });
    setTargetPlatform("sillytavern");
    setActivePage("create");
    setShowClearConfirm(false);
  }, []);

  // ── Non-character library-load handlers ──
  const handleEditLorebook = useCallback((book: LoreBook, imageSrc: string | null, id: string) => {
    setLorebookInit({ book, imageSrc, id });
    setLorebookKey((k) => k + 1);
    setActivePage("lorebook");
  }, []);

  const handleEditScript = useCallback((card: ScriptCard, imageSrc: string | null, id: string) => {
    setScriptInit({ card, imageSrc, id });
    setScriptKey((k) => k + 1);
    setActivePage("script");
  }, []);

  const handleEditScenario = useCallback((card: ScenarioCard, imageSrc: string | null, id: string) => {
    setScenarioInit({ card, imageSrc, id });
    setScenarioKey((k) => k + 1);
    setActivePage("scenario");
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      {showClearConfirm && (
        <ConfirmModal
          title="Clear current card?"
          message="All unsaved changes to the current character will be lost. This cannot be undone."
          confirmLabel="Clear Card"
          destructive
          onConfirm={clearCard}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      <Sidebar activePage={activePage} onNavigate={setActivePage} onNewCard={() => setShowClearConfirm(true)} />

      <main className="flex-1 overflow-hidden">
        {activePage === "create" && (
          <CreateCard
            project={project}
            settings={settings}
            targetPlatform={targetPlatform}
            onUpdateCard={updateCard}
            onUpdateImage={updateImage}
            onUpdateOutputFileName={updateOutputFileName}
            onPlatformChange={setTargetPlatform}
            onNewCard={() => setShowClearConfirm(true)}
          />
        )}
        {activePage === "lorebook" && (
          <LoreBookEditor
            key={lorebookKey}
            initialBook={lorebookInit?.book}
            initialImageSrc={lorebookInit?.imageSrc}
            initialLibraryId={lorebookInit?.id}
          />
        )}
        {activePage === "script" && (
          <ScriptEditor
            key={scriptKey}
            initialCard={scriptInit?.card}
            initialImageSrc={scriptInit?.imageSrc}
            initialLibraryId={scriptInit?.id}
          />
        )}
        {activePage === "scenario" && (
          <ScenarioEditor
            key={scenarioKey}
            initialCard={scenarioInit?.card}
            initialImageSrc={scenarioInit?.imageSrc}
            initialLibraryId={scenarioInit?.id}
          />
        )}
        {activePage === "import" && <ImportPNG onLoad={loadCard} />}
        {activePage === "decode" && <DecodePNG onLoad={loadCard} />}
        {activePage === "templates" && <Templates onLoad={loadCard} />}
        {activePage === "library" && (
          <Library
            onEditCard={loadFromLibrary}
            onEditLorebook={handleEditLorebook}
            onEditScript={handleEditScript}
            onEditScenario={handleEditScenario}
          />
        )}
        {activePage === "settings" && <Settings settings={settings} onSave={setSettings} />}
        {activePage === "help" && <HelpAbout />}
      </main>
    </div>
  );
}

export default App;
