import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { ChannelToggle } from './components/ChannelToggle';
import { PreviewCanvas } from './components/PreviewCanvas';
import { RecipeEditor } from './components/RecipeEditor';
import { HalftoneSettings } from './components/HalftoneSettings';
import {
  checkServerHealth,
  analyzePdf,
  renderPage as serverRenderPage,
  exportPlate,
  downloadBlob,
  type SeparationInfo,
  type RenderResult,
} from './utils/api';
import { DEFAULT_HALFTONE_ANGLES } from './constants';
import {
  Layers,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Eye,
  Printer,
  Info,
  Palette,
  Scissors,
  Download,
  Server,
  ServerOff,
  AlertTriangle,
} from 'lucide-react';

type TabType = 'composite' | 'plates' | 'halftone' | 'info';

interface ChannelData {
  name: string;
  imageBase64: string;
  coverage: number;
  kind: 'process' | 'spot' | 'tech';
  cmykRecipe: [number, number, number, number];
  displayColor: string;
}

export default function App() {
  // Server status
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const [serverVersion, setServerVersion] = useState('');

  // Loading state
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [dpi, setDpi] = useState(150);

  // Separation data
  const [separations, setSeparations] = useState<SeparationInfo[]>([]);
  const [channels, setChannels] = useState<ChannelData[]>([]);
  const [compositeImage, setCompositeImage] = useState<string>('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  // UI state
  const [enabledChannels, setEnabledChannels] = useState<Record<string, boolean>>({});
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [activeTab, setActiveTab] = useState<TabType>('composite');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Halftone settings
  const [cellSize, setCellSize] = useState(4);
  const [minDot, setMinDot] = useState(1.0);
  const [halftoneAngles, setHalftoneAngles] = useState<Record<string, number>>({
    ...DEFAULT_HALFTONE_ANGLES,
  });
  const [plateColorMode, setPlateColorMode] = useState(true);

  // Check server on mount
  useEffect(() => {
    checkServerHealth().then((status) => {
      if (status) {
        setServerOnline(true);
        setServerVersion(status.pymupdf_version);
      } else {
        setServerOnline(false);
      }
    });
  }, []);

  // Handle file load
  const handleFileLoad = useCallback(
    async (data: ArrayBuffer, name: string) => {
      if (!serverOnline) {
        alert(
          'Serwer PyMuPDF nie jest uruchomiony!\n\n' +
            'Uruchom serwer:\n' +
            '1. cd server\n' +
            '2. pip install -r requirements.txt\n' +
            '3. python rip_server.py\n\n' +
            'Następnie odśwież tę stronę.'
        );
        return;
      }

      setIsLoading(true);
      setLoadingMessage('Analyzing PDF...');
      setFileName(name);

      try {
        // Create File object from ArrayBuffer
        const blob = new Blob([data], { type: 'application/pdf' });
        const fileObj = new File([blob], name, { type: 'application/pdf' });
        setFile(fileObj);

        // Analyze PDF
        const analysis = await analyzePdf(fileObj);
        setPageCount(analysis.pageCount);
        setCurrentPage(0);

        // Combine process and spot separations
        const allSeps = [...analysis.processColors, ...analysis.separations];
        setSeparations(allSeps);

        // Enable all channels
        const enabled: Record<string, boolean> = {};
        for (const sep of allSeps) {
          enabled[sep.name] = true;
        }
        setEnabledChannels(enabled);

        // Set halftone angles
        const angles: Record<string, number> = { ...DEFAULT_HALFTONE_ANGLES };
        analysis.separations.forEach((s, i) => {
          angles[s.name] = (30 + i * 15) % 90;
        });
        setHalftoneAngles(angles);

        // Render first page
        setLoadingMessage('Rendering page...');
        await loadPage(fileObj, 0, dpi);

        setActiveTab('composite');
      } catch (err) {
        console.error('Error:', err);
        alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    },
    [serverOnline, dpi]
  );

  // Load/render a specific page
  const loadPage = useCallback(
    async (fileObj: File, pageIndex: number, renderDpi: number) => {
      setIsLoading(true);
      setLoadingMessage(`Rendering page ${pageIndex + 1}...`);

      try {
        const result: RenderResult = await serverRenderPage(fileObj, pageIndex, renderDpi);

        setImageSize({ width: result.width, height: result.height });
        setCompositeImage(result.composite);

        // Build channel data
        const channelList: ChannelData[] = [];
        
        for (const sep of separations) {
          const chData = result.channels[sep.name];
          if (chData) {
            channelList.push({
              name: sep.name,
              imageBase64: chData.image,
              coverage: chData.coverage,
              kind: sep.kind,
              cmykRecipe: sep.cmykRecipe,
              displayColor: sep.displayColor,
            });
          }
        }

        setChannels(channelList);
      } catch (err) {
        console.error('Render error:', err);
        alert(`Render error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    },
    [separations]
  );

  // Reload when page or DPI changes
  useEffect(() => {
    if (file && separations.length > 0) {
      loadPage(file, currentPage, dpi);
    }
  }, [currentPage, dpi]);

  // Convert base64 to ImageData for canvas
  const base64ToImageData = useCallback(
    async (base64: string): Promise<ImageData | null> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(img, 0, 0);
          resolve(ctx.getImageData(0, 0, img.width, img.height));
        };
        img.onerror = () => resolve(null);
        img.src = `data:image/png;base64,${base64}`;
      });
    },
    []
  );

  // Composite image for display
  const [compositeImageData, setCompositeImageData] = useState<ImageData | null>(null);
  useEffect(() => {
    if (compositeImage) {
      base64ToImageData(compositeImage).then(setCompositeImageData);
    }
  }, [compositeImage, base64ToImageData]);

  // Selected plate image
  const [selectedPlateImageData, setSelectedPlateImageData] = useState<ImageData | null>(null);
  useEffect(() => {
    const ch = channels.find((c) => c.name === selectedChannel);
    if (ch) {
      base64ToImageData(ch.imageBase64).then(setSelectedPlateImageData);
    } else {
      setSelectedPlateImageData(null);
    }
  }, [selectedChannel, channels, base64ToImageData]);

  const handleToggleChannel = useCallback((name: string) => {
    setEnabledChannels((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  const handleRecipeChange = useCallback(
    (name: string, recipe: [number, number, number, number]) => {
      setSeparations((prev) =>
        prev.map((s) => {
          if (s.name !== name) return s;
          const c = recipe[0] / 100;
          const m = recipe[1] / 100;
          const y = recipe[2] / 100;
          const k = recipe[3] / 100;
          const r = Math.round(255 * (1 - c) * (1 - k));
          const g = Math.round(255 * (1 - m) * (1 - k));
          const b = Math.round(255 * (1 - y) * (1 - k));
          return {
            ...s,
            cmykRecipe: recipe,
            displayColor: `rgb(${r}, ${g}, ${b})`,
          };
        })
      );
    },
    []
  );

  const handleAngleChange = useCallback((name: string, angle: number) => {
    setHalftoneAngles((prev) => ({ ...prev, [name]: angle }));
  }, []);

  const handleExportPlate = useCallback(
    async (channelName: string) => {
      if (!file) return;
      setIsLoading(true);
      setLoadingMessage(`Exporting ${channelName}...`);
      try {
        const blob = await exportPlate(file, currentPage, channelName, 300, 'png');
        downloadBlob(blob, `plate_${channelName.replace(/[^a-zA-Z0-9]/g, '_')}.png`);
      } catch (err) {
        alert(`Export error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
        setLoadingMessage('');
      }
    },
    [file, currentPage]
  );

  const handleExportComposite = useCallback(() => {
    if (!compositeImage) return;
    const link = document.createElement('a');
    link.download = 'composite_preview.png';
    link.href = `data:image/png;base64,${compositeImage}`;
    link.click();
  }, [compositeImage]);

  // Categorize channels
  const processChannels = useMemo(
    () => channels.filter((c) => c.kind === 'process'),
    [channels]
  );
  const spotChannels = useMemo(
    () => channels.filter((c) => c.kind === 'spot'),
    [channels]
  );
  const techChannels = useMemo(
    () => channels.filter((c) => c.kind === 'tech'),
    [channels]
  );

  const selectedSep = useMemo(
    () => separations.find((s) => s.name === selectedChannel),
    [selectedChannel, separations]
  );

  const displayImage = useMemo(() => {
    switch (activeTab) {
      case 'composite':
        return compositeImageData;
      case 'plates':
      case 'halftone':
        return selectedPlateImageData;
      default:
        return compositeImageData;
    }
  }, [activeTab, compositeImageData, selectedPlateImageData]);

  // =========================================================================
  // RENDER: No file loaded
  // =========================================================================
  if (!file) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
        {/* Header */}
        <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg p-2">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">RIP Preview PRO v2</h1>
              <p className="text-xs text-slate-400">
                True CMYK Separation • Spot Colors • Die-Cut Detection
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {serverOnline === null ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <div className="animate-spin h-4 w-4 border-2 border-slate-500 border-t-transparent rounded-full" />
                  Checking server...
                </div>
              ) : serverOnline ? (
                <div className="flex items-center gap-2 text-emerald-400 text-sm bg-emerald-900/30 px-3 py-1.5 rounded-lg">
                  <Server className="w-4 h-4" />
                  Server online (PyMuPDF {serverVersion})
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/30 px-3 py-1.5 rounded-lg">
                  <ServerOff className="w-4 h-4" />
                  Server offline
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-2xl w-full space-y-6">
            {/* Server status warning */}
            {serverOnline === false && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-5">
                <h2 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-5 h-5" />
                  Serwer nie jest uruchomiony
                </h2>
                <p className="text-red-200/80 text-sm mb-4">
                  Aby aplikacja działała poprawnie, musisz uruchomić serwer Python:
                </p>
                <div className="bg-slate-900/80 rounded-lg p-4 font-mono text-sm text-slate-300 space-y-1">
                  <p className="text-slate-500"># 1. Otwórz terminal i przejdź do katalogu server</p>
                  <p>cd server</p>
                  <p className="text-slate-500 mt-2"># 2. Zainstaluj zależności (tylko raz)</p>
                  <p>pip install -r requirements.txt</p>
                  <p className="text-slate-500 mt-2"># 3. Uruchom serwer</p>
                  <p>python rip_server.py</p>
                </div>
                <p className="text-red-200/60 text-xs mt-4">
                  Po uruchomieniu serwera odśwież tę stronę (F5).
                </p>
              </div>
            )}

            {/* File uploader */}
            <FileUploader onFileLoad={handleFileLoad} isLoading={isLoading} />

            {/* Features */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <Layers className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white">True CMYK</h3>
                <p className="text-xs text-slate-400 mt-1">Native CMYK rendering</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <Palette className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white">Spot Colors</h3>
                <p className="text-xs text-slate-400 mt-1">Pantone & custom inks</p>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50">
                <Scissors className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h3 className="text-sm font-medium text-white">Die-Cut Lines</h3>
                <p className="text-xs text-slate-400 mt-1">Technical layer detection</p>
              </div>
            </div>

            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30 text-xs text-slate-400">
              <p className="text-cyan-400 font-medium mb-2">Server-based processing:</p>
              <ul className="space-y-1">
                <li>• <strong>PyMuPDF</strong> for native CMYK rendering (not RGB conversion)</li>
                <li>• Real /Separation and /DeviceN colorspace extraction</li>
                <li>• Accurate spot color channel separation</li>
                <li>• High-DPI plate export (up to 1200 DPI)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: File loaded - main UI
  // =========================================================================
  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-slate-700/50 bg-slate-900/90 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-md p-1.5">
              <Printer className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-sm font-bold text-white">RIP Preview PRO</h1>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <div className="flex items-center gap-2 text-emerald-400 text-xs">
            <Server className="w-3 h-3" />
            <span>PyMuPDF {serverVersion}</span>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          <span className="text-xs text-slate-400 truncate max-w-48">{fileName}</span>

          {/* Page navigation */}
          {pageCount > 1 && (
            <div className="flex items-center gap-1 ml-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-300 font-mono min-w-12 text-center">
                {currentPage + 1} / {pageCount}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={currentPage === pageCount - 1}
                className="p-1 rounded hover:bg-slate-700 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* DPI selector */}
          <div className="flex items-center gap-2 ml-auto">
            <label className="text-xs text-slate-500">DPI:</label>
            <select
              value={dpi}
              onChange={(e) => setDpi(Number(e.target.value))}
              className="bg-slate-800 border border-slate-600 rounded px-2 py-0.5 text-xs text-white"
            >
              <option value={72}>72</option>
              <option value={100}>100</option>
              <option value={150}>150</option>
              <option value={200}>200</option>
              <option value={300}>300</option>
            </select>

            <span className="text-xs text-slate-500 font-mono">
              {imageSize.width}×{imageSize.height}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`shrink-0 border-r border-slate-700/50 bg-slate-850 overflow-y-auto transition-all ${
            sidebarOpen ? 'w-72' : 'w-0'
          }`}
          style={{ backgroundColor: '#161b2e' }}
        >
          {sidebarOpen && (
            <div className="p-3 space-y-4">
              {/* Process Colors */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Process Colors (CMYK)
                </h3>
                <div className="space-y-1.5">
                  {processChannels.map((ch) => (
                    <ChannelToggle
                      key={ch.name}
                      channel={{
                        name: ch.name,
                        kind: ch.kind,
                        displayColor: ch.displayColor,
                        cmykRecipe: ch.cmykRecipe,
                      }}
                      enabled={enabledChannels[ch.name] ?? true}
                      coverage={ch.coverage}
                      onToggle={() => handleToggleChannel(ch.name)}
                      onSelect={() => {
                        setSelectedChannel(ch.name);
                        if (activeTab === 'composite') setActiveTab('plates');
                      }}
                      isSelected={selectedChannel === ch.name}
                    />
                  ))}
                </div>
              </div>

              {/* Spot Colors */}
              {spotChannels.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5" />
                    Spot Colors ({spotChannels.length})
                  </h3>
                  <div className="space-y-1.5">
                    {spotChannels.map((ch) => (
                      <ChannelToggle
                        key={ch.name}
                        channel={{
                          name: ch.name,
                          kind: ch.kind,
                          displayColor: ch.displayColor,
                          cmykRecipe: ch.cmykRecipe,
                        }}
                        enabled={enabledChannels[ch.name] ?? true}
                        coverage={ch.coverage}
                        onToggle={() => handleToggleChannel(ch.name)}
                        onSelect={() => {
                          setSelectedChannel(ch.name);
                          if (activeTab === 'composite') setActiveTab('plates');
                        }}
                        isSelected={selectedChannel === ch.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Layers */}
              {techChannels.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5" />
                    Technical Layers ({techChannels.length})
                  </h3>
                  <div className="space-y-1.5">
                    {techChannels.map((ch) => (
                      <ChannelToggle
                        key={ch.name}
                        channel={{
                          name: ch.name,
                          kind: ch.kind,
                          displayColor: ch.displayColor,
                          cmykRecipe: ch.cmykRecipe,
                        }}
                        enabled={enabledChannels[ch.name] ?? true}
                        coverage={ch.coverage}
                        onToggle={() => handleToggleChannel(ch.name)}
                        onSelect={() => {
                          setSelectedChannel(ch.name);
                          if (activeTab === 'composite') setActiveTab('plates');
                        }}
                        isSelected={selectedChannel === ch.name}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* No spots found */}
              {spotChannels.length === 0 && techChannels.length === 0 && (
                <div className="bg-slate-700/30 border border-slate-600/30 rounded-lg p-3">
                  <p className="text-slate-400 text-xs">
                    No spot colors or technical layers detected in this PDF.
                  </p>
                </div>
              )}

              {/* Recipe Editor */}
              {selectedSep && selectedSep.kind !== 'process' && (
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    CMYK Recipe
                  </h3>
                  <RecipeEditor
                    separation={selectedSep}
                    onRecipeChange={handleRecipeChange}
                  />
                </div>
              )}

              {/* Export */}
              <div>
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Export
                </h3>
                <div className="space-y-1.5">
                  <button
                    onClick={handleExportComposite}
                    className="w-full text-xs bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg px-3 py-2 transition-colors"
                  >
                    Export Composite
                  </button>
                  {selectedChannel && (
                    <button
                      onClick={() => handleExportPlate(selectedChannel)}
                      className="w-full text-xs bg-slate-700 hover:bg-slate-600 text-white rounded-lg px-3 py-2 transition-colors"
                    >
                      Export "{selectedChannel}" (300 DPI)
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Toggle sidebar */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="shrink-0 w-5 flex items-center justify-center bg-slate-800/50 hover:bg-slate-700/50 border-r border-slate-700/50 transition-colors"
        >
          {sidebarOpen ? (
            <ChevronLeft className="w-3 h-3 text-slate-500" />
          ) : (
            <ChevronRight className="w-3 h-3 text-slate-500" />
          )}
        </button>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="shrink-0 flex items-center gap-1 px-3 py-2 bg-slate-800/50 border-b border-slate-700/50">
            <TabButton
              active={activeTab === 'composite'}
              onClick={() => setActiveTab('composite')}
              icon={<Eye className="w-3.5 h-3.5" />}
              label="Composite"
            />
            <TabButton
              active={activeTab === 'plates'}
              onClick={() => setActiveTab('plates')}
              icon={<Layers className="w-3.5 h-3.5" />}
              label="Plate View"
              disabled={!selectedChannel}
            />
            <TabButton
              active={activeTab === 'halftone'}
              onClick={() => setActiveTab('halftone')}
              icon={<Grid3X3 className="w-3.5 h-3.5" />}
              label="Halftone"
              disabled={!selectedChannel}
            />
            <TabButton
              active={activeTab === 'info'}
              onClick={() => setActiveTab('info')}
              icon={<Info className="w-3.5 h-3.5" />}
              label="Info"
            />

            {activeTab === 'plates' && (
              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={() => setPlateColorMode(!plateColorMode)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    plateColorMode ? 'bg-cyan-600 text-white' : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {plateColorMode ? 'Colored' : 'Grayscale'}
                </button>
              </div>
            )}
          </div>

          {/* Halftone controls */}
          {activeTab === 'halftone' && selectedSep && (
            <div className="shrink-0 px-4 py-2 bg-slate-800/70 border-b border-slate-700/50">
              <HalftoneSettings
                cellSize={cellSize}
                angle={halftoneAngles[selectedChannel] ?? 45}
                minDot={minDot}
                isTech={selectedSep.kind === 'tech'}
                onCellSizeChange={setCellSize}
                onAngleChange={(a) => handleAngleChange(selectedChannel, a)}
                onMinDotChange={setMinDot}
              />
            </div>
          )}

          {/* Canvas Area */}
          <div className="flex-1 overflow-hidden relative">
            {isLoading && (
              <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-cyan-500 border-t-transparent" />
                  <p className="text-sm text-slate-400">{loadingMessage || 'Loading...'}</p>
                </div>
              </div>
            )}

            {activeTab === 'info' ? (
              <InfoPanel
                fileName={fileName}
                pageCount={pageCount}
                currentPage={currentPage}
                imageSize={imageSize}
                channels={channels}
              />
            ) : (
              <PreviewCanvas
                imageData={displayImage}
                title={
                  activeTab === 'composite'
                    ? 'Composite CMYK Preview'
                    : `Plate: ${selectedChannel || '(select channel)'}`
                }
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
        ${
          active
            ? 'bg-cyan-600 text-white'
            : disabled
            ? 'text-slate-600 cursor-not-allowed'
            : 'text-slate-400 hover:text-white hover:bg-slate-700'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function InfoPanel({
  fileName,
  pageCount,
  currentPage,
  imageSize,
  channels,
}: {
  fileName: string;
  pageCount: number;
  currentPage: number;
  imageSize: { width: number; height: number };
  channels: ChannelData[];
}) {
  const totalCoverage = channels.reduce((acc, ch) => acc + ch.coverage, 0);

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Document Info */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Info className="w-5 h-5 text-cyan-400" />
          Document Information
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <InfoCard label="File" value={fileName} />
          <InfoCard label="Pages" value={`${pageCount}`} />
          <InfoCard label="Current" value={`${currentPage + 1}`} />
          <InfoCard label="Size" value={`${imageSize.width}×${imageSize.height}`} />
        </div>
      </div>

      {/* Separations */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h2 className="text-lg font-bold text-white mb-4">Color Separations</h2>
        <div className="grid gap-3">
          {channels.map((ch) => (
            <div key={ch.name} className="flex items-center gap-3 bg-slate-900/50 rounded-lg p-3">
              <div
                className="w-8 h-8 rounded-md border border-white/10"
                style={{ backgroundColor: ch.displayColor }}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{ch.name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      ch.kind === 'process'
                        ? 'bg-blue-900/50 text-blue-300'
                        : ch.kind === 'tech'
                        ? 'bg-emerald-900/50 text-emerald-300'
                        : 'bg-orange-900/50 text-orange-300'
                    }`}
                  >
                    {ch.kind === 'process' ? 'Process' : ch.kind === 'tech' ? 'Technical' : 'Spot'}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, ch.coverage)}%`,
                        backgroundColor: ch.displayColor,
                      }}
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono w-14 text-right">
                    {ch.coverage.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Total Coverage */}
      <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700/50">
        <h2 className="text-lg font-bold text-white mb-4">Ink Coverage Summary</h2>
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{totalCoverage.toFixed(1)}%</div>
          <div className="text-sm text-slate-400 mt-1">Total Ink Coverage (TIC)</div>
          {totalCoverage > 300 && (
            <div className="text-sm text-amber-400 mt-2">
              ⚠️ TIC exceeds 300% — may cause printing issues
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm font-medium text-white mt-0.5 truncate">{value}</div>
    </div>
  );
}
