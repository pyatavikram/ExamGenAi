import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { FileUpload } from './components/FileUpload';
import { PaperRenderer } from './components/PaperRenderer';
import { SchoolConfig, AppState, ExamPaperData } from './types';
import { geminiService } from './services/gemini';
import { Auth } from './Auth';
import { useAuth } from './hooks/useAuth';
import { useLocalStorage } from './hooks/useLocalStorage';
import {
  Sparkles, Printer, LayoutTemplate, Loader2, AlertCircle,
  PenTool, Download, ImagePlus, X, RotateCcw, LogOut, CloudUpload
} from 'lucide-react';

const DEFAULT_CONFIG: SchoolConfig = {
    schoolName: "SRI’S MODEL SCHOOL",
    examName: "SUMMATIVE ASSESSMENT TEST - I",
    className: "UKG",
    subject: "ENGLISH",
    marks: "50",
    time: "2 ½ Hrs",
    date: "",
    logoUrl: null
};

// Define the fields config with strict keys
const CONFIG_FIELDS: { label: string; key: keyof SchoolConfig }[] = [
    { label: 'School Name', key: 'schoolName' },
    { label: 'Exam Title', key: 'examName' },
    { label: 'Class', key: 'className' },
    { label: 'Subject', key: 'subject' },
    { label: 'Marks', key: 'marks' },
    { label: 'Time', key: 'time' },
    { label: 'Date', key: 'date' }
];

function App() {
  // --- AUTH HOOK ---
  const { session, loading: authLoading, signOut } = useAuth();

  // --- STATE ---
  const [isSaving, setIsSaving] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- PERSISTENCE HOOKS ---
  const [paperData, setPaperData, removePaperData] = useLocalStorage<ExamPaperData | null>('examGen_data', null);
  const [config, setConfig] = useLocalStorage<SchoolConfig>('examGenConfig', DEFAULT_CONFIG);
  
  // Derived state for app status - Initialized based on paperData existence
  const [status, setStatus] = useState<AppState>(() => {
    return paperData ? AppState.READY : AppState.IDLE;
  });

  // Sync status if paperData is removed externally (e.g. another tab or removePaperData)
  useEffect(() => {
    if (!paperData && status === AppState.READY) {
      setStatus(AppState.IDLE);
    } else if (paperData && status === AppState.IDLE) {
      // Optional: Auto-recover state if data appears?
      // Safe to assume if data exists we might want to be in READY,
      // but let's be conservative and only force IDLE if data is gone.
      setStatus(AppState.READY);
    }
  }, [paperData, status]);

  // --- HANDLERS ---
  const resetApp = () => {
      removePaperData();
      setFiles([]);
      setStatus(AppState.IDLE);
  };

  const handleLogout = async () => {
      await signOut();
      resetApp();
  };

  const handleSaveToCloud = async () => {
      if (!session || !paperData) return;
      setIsSaving(true);
      try {
          const { error } = await supabase.from('exam_papers').upsert({
              user_id: session.user.id,
              title: config.examName,
              subject: config.subject,
              content: paperData,
              config: config,
              updated_at: new Date().toISOString(),
          });
          if (error) throw error;
          alert("Paper saved to cloud successfully!");
      } catch (e: any) {
          console.error(e);
          alert("Error saving: " + e.message);
      } finally {
          setIsSaving(false);
      }
  };

  const handleReset = () => {
    if (window.confirm("Start a new paper? This will clear all content.")) {
        resetApp();
    }
  };

  const handleAnalyze = async () => {
    if (files.length === 0) return;
    
    setStatus(AppState.ANALYZING);
    setErrorMsg(null);

    try {
      let jsonResult = await geminiService.analyzeExamSheet(files);
      jsonResult = jsonResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsedData: ExamPaperData = JSON.parse(jsonResult);
      setPaperData(parsedData);
      setStatus(AppState.READY);
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to analyze content. The AI response was not valid JSON. Please try again.");
      setStatus(AppState.ERROR);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJson = () => {
    if (!paperData) return;
    const jsonString = JSON.stringify(paperData, null, 2);
    const element = document.createElement("a");
    const file = new Blob([jsonString], {type: 'application/json'});
    element.href = URL.createObjectURL(file);
    element.download = "exam-paper.json";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        if (file.size > 2 * 1024 * 1024) {
            alert("Logo image is too large. Please use an image under 2MB.");
            return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
            setConfig((prev: SchoolConfig) => ({ ...prev, logoUrl: reader.result as string }));
        };
        reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setConfig((prev: SchoolConfig) => ({ ...prev, logoUrl: null }));
  };

  // --- RENDERING ---
  
  if (authLoading) {
      return (
        <div className="h-screen flex items-center justify-center bg-gray-50">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      );
  }

  if (!session) {
      return <Auth />;
  }

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 pb-20 print:pb-0 print:bg-white print:h-auto print:overflow-visible">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-2 rounded-lg">
                <LayoutTemplate className="w-5 h-5 text-white" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">ExamGen<span className="text-indigo-600">AI</span></h1>
          </div>
          
          <div className="flex items-center gap-2">
             <button 
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg mr-2"
                title="Sign Out"
            >
                <LogOut className="w-5 h-5" />
            </button>

             <button 
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium mr-2"
                title="Start New Paper"
            >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">New Paper</span>
            </button>

            {status === AppState.READY && (
              <>
                <button 
                    onClick={handleSaveToCloud}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-3 py-2 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-sm font-medium"
                    title="Save to Database"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                    <span className="hidden sm:inline">Save</span>
                </button>

                <button 
                    onClick={handleDownloadJson}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
                    title="Download Source Data"
                >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">JSON</span>
                </button>
                
                <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors font-medium shadow-sm hover:shadow-md"
                >
                    <Printer className="w-4 h-4" />
                    Save as PDF
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 print:p-0 print:m-0 print:w-full print:max-w-none">
        <div className="flex flex-col lg:flex-row gap-8 print:block">
          
          {/* Left Sidebar: Controls (Hidden on Print) */}
          <div className="w-full lg:w-[350px] flex-shrink-0 space-y-6 print:hidden">
            
            {/* Step 1: Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">1. School Details</h2>
              <div className="space-y-4">
                {/* Logo Section */}
                <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">School Logo</label>
                    {config.logoUrl ? (
                        <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg border border-gray-200 group relative">
                            <div className="w-10 h-10 bg-white rounded flex items-center justify-center p-1 border border-gray-100">
                                <img src={config.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                            </div>
                            <span className="text-xs text-gray-500 flex-1 truncate">Logo Saved</span>
                            <button onClick={removeLogo} className="p-1 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <div className="relative group">
                            <input type="file" accept="image/*" onChange={handleLogoUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                            <div className="flex items-center gap-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-gray-500 bg-white group-hover:bg-gray-50 group-hover:border-indigo-300 transition-all">
                                <ImagePlus className="w-4 h-4" />
                                <span className="text-xs">Click to upload logo...</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Input Fields */}
                {CONFIG_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{field.label}</label>
                      <input 
                        type="text" 
                        value={config[field.key] || ''}
                        onChange={(e) => setConfig((prev: SchoolConfig) => ({...prev, [field.key]: e.target.value}))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                      />
                    </div>
                ))}
              </div>
            </div>

            {/* Step 2: Upload */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
               <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">2. Upload Handwriting</h2>
               <FileUpload files={files} setFiles={setFiles} />
               
               <button
                onClick={handleAnalyze}
                disabled={files.length === 0 || status === AppState.ANALYZING}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-200"
               >
                 {status === AppState.ANALYZING ? <><Loader2 className="w-5 h-5 animate-spin" /> Processing...</> : <><Sparkles className="w-5 h-5" /> Generate Paper</>}
               </button>
               {errorMsg && <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{errorMsg}</div>}
            </div>
          </div>

          {/* Right Side: Preview Area */}
          <div className="flex-1 flex justify-center bg-gray-100 print:bg-white print:w-full print:p-0 print:block">
            {status === AppState.IDLE ? (
                <div className="flex flex-col items-center justify-center h-[600px] text-gray-400 text-center max-w-md mx-auto">
                    <div className="bg-white p-6 rounded-full shadow-sm mb-4"><PenTool className="w-12 h-12 text-indigo-200" /></div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Ready to Create</h3>
                    <p>Upload photos. AI will structure grids, visual MCQs, and matchings automatically.</p>
                </div>
            ) : (
                <PaperRenderer config={config} data={paperData} onUpdateData={setPaperData} />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
