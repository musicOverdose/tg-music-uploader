import React, { useState, useEffect } from 'react';
import { 
  Folder, Music, Send, CheckCircle2, AlertCircle, 
  Settings as SettingsIcon, List, Server, Search, 
  PlayCircle, Clock, HardDrive, RefreshCw, LogOut, ChevronRight, Hash, FileText,
  Image as ImageIcon, X, Edit3, Trash2, Copy, Check, PauseCircle, Radio
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [folders, setFolders] = useState([]);
  const [libStats, setLibStats] = useState({ total_folders: 0, total_files: 0 });
  const [selectedFolder, setSelectedFolder] = useState('');
  const [files, setFiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({ 
    bot_token: '', default_dest: '', delay_per_file_min: 3, delay_per_file_max: 7, is_paused: false, bot_name: '', dest_name: ''
  });
  const [botStatus, setBotStatus] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  
  const [folderStatus, setFolderStatus] = useState({});
  const [selectedFolders, setSelectedFolders] = useState(new Set());
  
  const [reportContent, setReportContent] = useState('');
  const [copied, setCopied] = useState(false);
  const [reportSaved, setReportSaved] = useState(false);

  const [showCoverModal, setShowCoverModal] = useState(false);
  const [coverRes, setCoverRes] = useState({ w: 0, h: 0 });
  const [editingFile, setEditingFile] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', artist: '', album: '', year: '', track: '' });

  useEffect(() => {
    fetchSettings();
    fetchFolders();
    fetchQueue();
    fetchFolderStatus();
    fetchReport();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/progress`);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setJobs((prev) =>
        prev.map((j) => (j.id === data.job_id ? { ...j, progress: data.progress, status: data.status } : j))
      );
    };
    return () => ws.close();
  }, []);

  const fetchReport = async () => {
    const res = await fetch('/api/report');
    if (res.ok) {
      const data = await res.json();
      setReportContent(data.content || '');
    }
  };

  const saveReport = async () => {
    const res = await fetch('/api/report', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: reportContent })
    });
    if (res.ok) {
      setReportSaved(true);
      setTimeout(() => setReportSaved(false), 2000);
    }
  };

  const clearReport = async () => {
    if (!window.confirm("Clear all lines in report.txt?")) return;
    await fetch('/api/report/clear', { method: 'POST' });
    setReportContent('');
  };

  const copyToClipboard = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(reportContent).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = reportContent;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Fallback copy failed', err);
        alert("Copy failed. Your browser blocked clipboard access.");
      }
      document.body.removeChild(textArea);
    }
  };

  const fetchFolderStatus = async () => {
    const res = await fetch('/api/folders/status');
    if (res.ok) setFolderStatus(await res.json());
  };

  const toggleFolderStatus = async (path, currentStatus) => {
    const newStatus = !currentStatus;
    setFolderStatus(prev => ({...prev, [path]: newStatus}));
    await fetch('/api/folders/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, is_done: newStatus })
    });
  };

  const toggleAllDone = async () => {
    const allDone = folders.length > 0 && folders.every(f => folderStatus[f.path]);
    const newStatus = !allDone;
    const newStatusObj = { ...folderStatus };
    folders.forEach(f => newStatusObj[f.path] = newStatus);
    setFolderStatus(newStatusObj);
    
    await fetch('/api/folders/status/bulk', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status_map: newStatusObj })
    });
  };

  const toggleFolderSelection = (path) => {
    setSelectedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAllSelect = () => {
    if (folders.length > 0 && selectedFolders.size === folders.length) {
      setSelectedFolders(new Set());
    } else {
      setSelectedFolders(new Set(folders.map(f => f.path)));
    }
  };

  const handleLogin = async () => {
    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
    if (res.ok) {
      setAuthRequired(false); fetchSettings(); fetchFolders(); fetchFolderStatus(); fetchReport();
    } else { alert('Invalid Password'); }
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    if (res.status === 401) return setAuthRequired(true);
    const data = await res.json();
    setSettings(data);
  };

  const fetchFolders = async () => {
    const res = await fetch('/api/library/tree');
    if (res.ok) {
      const data = await res.json();
      setFolders(data.tree);
      setLibStats({ total_folders: data.total_folders, total_files: data.total_files });
    }
  };

  const loadFolderFiles = async (folderPath) => {
    setSelectedFolder(folderPath);
    setFiles([]);
    const res = await fetch(`/api/library/files?path=${encodeURIComponent(folderPath)}`);
    if (res.ok) setFiles(await res.json());
  };

  const fetchQueue = async () => {
    const res = await fetch('/api/queue');
    if (res.ok) setJobs(await res.json());
  };

  const togglePauseQueue = async () => {
    const res = await fetch('/api/queue/toggle_pause', { method: 'POST' });
    const data = await res.json();
    setSettings(s => ({...s, is_paused: data.is_paused}));
  };

  const retryFailedJobs = async () => {
    await fetch('/api/queue/retry_failed', { method: 'POST' });
    fetchQueue();
  };

  const testBot = async () => {
    setBotStatus('Saving & Fetching info...');
    const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
    const data = await res.json();
    if (res.ok) { 
      setBotStatus(`Connected Successfully!`); 
      fetchSettings();
    } else { 
      setBotStatus(`Error: ${data.detail || 'Connection failed'}`); 
    }
  };

  const enqueue = async (filePaths, includeCover = false) => {
    const dest = settings.default_dest;
    if (!dest) return alert('No destination channel set! Please configure it in Settings first.');
    setIsUploading(true);
    await fetch('/api/queue/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files: filePaths, destination: dest, include_cover: includeCover }) });
    if (selectedFolder) toggleFolderStatus(selectedFolder, false);
    setIsUploading(false);
    fetchQueue();
    setActiveTab('queue');
  };

  const uploadSelectedFolders = async () => {
    const dest = settings.default_dest;
    if (!dest) return alert('No destination channel set! Please configure it in Settings first.');
    setIsUploading(true);
    await fetch('/api/queue/add_folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders: Array.from(selectedFolders), destination: dest, include_cover: true })
    });
    const newStatuses = {...folderStatus};
    selectedFolders.forEach(f => newStatuses[f] = true);
    setFolderStatus(newStatuses);
    setIsUploading(false);
    setSelectedFolders(new Set());
    fetchQueue();
    setActiveTab('queue');
  };

  const openEditor = (file) => {
    setEditingFile(file);
    setEditForm({
      title: file.metadata.title === 'Unknown Title' ? '' : file.metadata.title,
      artist: file.metadata.artist === 'Unknown Artist' ? '' : file.metadata.artist,
      album: file.metadata.album === 'Unknown Album' ? '' : file.metadata.album,
      year: file.metadata.year === 'Unknown' ? '' : file.metadata.year,
      track: file.metadata.track === 0 ? '' : file.metadata.track
    });
  };

  const saveMetadata = async () => {
    const res = await fetch('/api/library/metadata', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filepath: editingFile.path, ...editForm }) });
    if (res.ok) { setEditingFile(null); loadFolderFiles(selectedFolder); } else { alert("Failed to save. Is the Docker volume mounted as read-write?"); }
  };

  const bulkCleanTags = async () => {
    if (!window.confirm("Permanently remove comments, lyrics, and non-essential ID3 tags from all MP3s in this folder?")) return;
    setIsCleaning(true);
    const res = await fetch('/api/library/metadata/clean', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder_path: selectedFolder }) });
    const data = await res.json();
    setIsCleaning(false);
    if (res.ok) alert(`Cleaned extra tags from ${data.cleaned} files!`);
  };

  if (authRequired) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-2xl border border-zinc-800 w-full max-w-sm shadow-2xl relative z-10">
          <div className="flex justify-center mb-6"><div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20"><Music className="w-8 h-8 text-indigo-400" /></div></div>
          <h2 className="text-2xl font-bold mb-2 text-center text-white tracking-tight">Welcome Back</h2>
          <p className="text-zinc-400 text-sm text-center mb-6">Enter your credentials to access the uploader.</p>
          <input type="password" placeholder="Admin Password" className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-3 rounded-lg text-white mb-6 outline-none transition-all placeholder:text-zinc-600" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} />
          <button onClick={handleLogin} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 py-3 rounded-lg text-white font-semibold transition-all shadow-lg shadow-indigo-500/25">Access Dashboard</button>
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter(j => j.status === 'uploading' || j.status === 'pending').length;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden selection:bg-indigo-500/30">
      <aside className="w-64 bg-zinc-900/50 border-r border-zinc-800/80 flex flex-col backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20"><Send className="w-5 h-5 text-white" /></div>
          <div><h1 className="font-bold text-sm tracking-wide text-zinc-100">TG UPLOADER</h1><p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Studio Panel</p></div>
        </div>
        
        <nav className="px-4 py-2 space-y-1.5 flex-1">
          <button onClick={() => setActiveTab('library')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'library' ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'}`}><Folder className="w-4 h-4" /> Library Browser</button>
          <button onClick={() => { setActiveTab('queue'); fetchQueue(); }} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'queue' ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'}`}>
            <div className="flex items-center gap-3"><List className="w-4 h-4" /> Queue</div>
            {activeJobs > 0 && <span className="bg-indigo-500/20 text-indigo-400 py-0.5 px-2.5 rounded-full text-[10px] font-bold border border-indigo-500/20">{activeJobs}</span>}
          </button>
          <button onClick={() => { setActiveTab('report'); fetchReport(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'report' ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'}`}><FileText className="w-4 h-4 text-emerald-400" /> Catalog Report</button>
          <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'settings' ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'}`}><SettingsIcon className="w-4 h-4" /> Settings</button>
        </nav>

        <div className="p-5 border-t border-zinc-800/80 flex flex-col gap-4 bg-zinc-900/20">
          <div className="flex items-center gap-3 text-xs text-zinc-500 px-1"><Server className="w-4 h-4" /><span className="truncate flex-1">System Online</span><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div></div>
          <div className="text-[10px] text-zinc-600 font-semibold text-center uppercase tracking-widest pt-2 border-t border-zinc-800/50">Made by Farzad <br/><span className="text-indigo-400/70 lowercase tracking-normal text-xs font-medium">@MusicOverdose</span></div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed bg-center">
        <div className="absolute inset-0 bg-zinc-950/95 z-0"></div>
        
        <header className="h-16 border-b border-zinc-800/80 px-8 flex items-center justify-between relative z-10 bg-zinc-900/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium tracking-wide">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} 
            {selectedFolder && activeTab === 'library' && (<><ChevronRight className="w-4 h-4 text-zinc-600" /><span className="text-zinc-200">{selectedFolder.split('/').pop()}</span></>)}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-lg px-4 py-2 shadow-sm">
              <Server className="w-3.5 h-3.5 text-emerald-400 mr-2" />
              <span className="text-xs font-bold text-zinc-200 mr-3 border-r border-zinc-700 pr-3">
                {settings.bot_name || 'No Bot Connected'}
              </span>
              <Radio className="w-3.5 h-3.5 text-indigo-400 mr-2" />
              <span className="text-xs font-medium text-zinc-300">
                {settings.dest_name || settings.default_dest || 'Destination not set'}
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 relative z-10">
          
          {/* LIBRARY TAB */}
          {activeTab === 'library' && (
            <div className="grid grid-cols-12 gap-8 h-full max-w-7xl mx-auto">
              <div className="col-span-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-xl">
                
                {/* Header aligned perfectly with items */}
                <div className="px-3 py-3 border-b border-zinc-800/80 bg-zinc-900/50 flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 flex justify-center items-center shrink-0">
                      <button onClick={toggleAllDone} title="Toggle All Done" className="hover:scale-110 transition-transform">
                        <CheckCircle2 className={`w-4 h-4 ${folders.length > 0 && folders.every(f => folderStatus[f.path]) ? 'text-emerald-500' : 'text-zinc-600 hover:text-zinc-400'}`} />
                      </button>
                    </div>
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <HardDrive className="w-3.5 h-3.5" /> 
                      Volumes <span className="bg-zinc-800 px-2 py-0.5 rounded-full text-zinc-400 normal-case tracking-normal">{libStats.total_folders} Albums • {libStats.total_files} Tracks</span>
                    </h3>
                  </div>

                  <div className="flex items-center gap-3">
                    {selectedFolders.size > 0 && (
                      <button onClick={uploadSelectedFolders} disabled={isUploading} className="text-[10px] bg-indigo-500 hover:bg-indigo-400 text-white px-2 py-1 rounded font-bold transition-all shadow-md flex items-center gap-1">
                        <Send className="w-3 h-3" /> Upload {selectedFolders.size}
                      </button>
                    )}
                    <div className="w-5 h-5 flex justify-center items-center shrink-0">
                      <button onClick={toggleAllSelect} title="Select All" className="group relative flex items-center justify-center w-5 h-5 transition-all">
                        <div className={`absolute inset-0 rounded-full border-2 transition-all ${(folders.length > 0 && selectedFolders.size === folders.length) ? 'border-indigo-500 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'border-zinc-600 bg-zinc-900/50 group-hover:border-indigo-400'}`}></div>
                        {(folders.length > 0 && selectedFolders.size === folders.length) && <div className="w-1.5 h-1.5 bg-white rounded-full relative z-10 transition-all"></div>}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-3 overflow-y-auto flex-1 space-y-1">
                  {folders.map((f) => {
                    const isDone = folderStatus[f.path] || false;
                    const isSelected = selectedFolders.has(f.path);
                    return (
                      <div key={f.path} className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm transition-all border border-transparent ${selectedFolder === f.path ? 'bg-indigo-500/10 shadow-sm' : 'hover:bg-zinc-800/50'}`}>
                        <div className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer" onClick={() => loadFolderFiles(f.path)}>
                          <div className="w-5 h-5 flex justify-center items-center shrink-0">
                            <button onClick={(e) => { e.stopPropagation(); toggleFolderStatus(f.path, isDone); }} className="hover:scale-110 transition-transform">
                              <CheckCircle2 className={`w-4 h-4 ${isDone ? 'text-emerald-500' : 'text-zinc-700 hover:text-zinc-500'}`} />
                            </button>
                          </div>
                          <Folder className={`w-4 h-4 shrink-0 ${selectedFolder === f.path ? 'fill-indigo-500/20 text-indigo-400' : 'text-zinc-500'}`} />
                          <span className={`truncate font-medium ${isDone ? 'text-emerald-500/70 line-through decoration-emerald-500/30' : 'text-zinc-300'}`}>
                            {f.name}
                          </span>
                        </div>
                        
                        <div className="flex items-center shrink-0 ml-2">
                          <div className="w-5 h-5 flex justify-center items-center">
                            <button onClick={(e) => { e.stopPropagation(); toggleFolderSelection(f.path); }} className="group relative flex items-center justify-center w-5 h-5 transition-all">
                              <div className={`absolute inset-0 rounded-full border-2 transition-all ${isSelected ? 'border-indigo-500 bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'border-zinc-600 bg-zinc-900/50 group-hover:border-indigo-400'}`}></div>
                              {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full relative z-10 transition-all"></div>}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="col-span-8 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-xl">
                <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/50 flex justify-between items-center h-[72px]">
                  {selectedFolder ? (
                    <div>
                      <h3 className="font-semibold text-zinc-100 text-sm truncate max-w-[300px]">{selectedFolder.split('/').pop()}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{files.length} tracks (Sorted by Track #)</p>
                    </div>
                  ) : (<h3 className="text-sm font-medium text-zinc-500">Select a folder to view files</h3>)}
                  
                  <div className="flex items-center gap-3">
                    {files.length > 0 && (
                      <button onClick={bulkCleanTags} disabled={isCleaning} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 disabled:opacity-50 text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all"><Trash2 className="w-4 h-4" /> Clean Tags</button>
                    )}
                    {files.length > 0 && files[0].has_folder_cover && (
                      <button onClick={() => { setCoverRes({w:0,h:0}); setShowCoverModal(true); }} className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-sm"><ImageIcon className="w-4 h-4" /> View Cover</button>
                    )}
                    {files.length > 0 && (
                      <button onClick={() => enqueue(files.map(f => f.path), true)} disabled={isUploading} className="bg-zinc-100 hover:bg-white text-zinc-900 disabled:opacity-50 text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"><PlayCircle className="w-4 h-4" /> Upload Full Album</button>
                    )}
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {files.length > 0 ? (
                    <table className="w-full text-left text-sm border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4">
                          <th className="font-medium pb-2 pl-4 w-12 text-center">#</th>
                          <th className="font-medium pb-2">Track Info</th>
                          <th className="font-medium pb-2 w-28">Size & Quality</th>
                          <th className="font-medium pb-2 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {files.map((file) => (
                          <tr key={file.path} className="group bg-zinc-950/20 hover:bg-zinc-800/40 transition-colors rounded-xl">
                            <td className="py-3 pl-4 rounded-l-xl text-center text-zinc-500 font-mono text-xs">{file.metadata.track ? `#${file.metadata.track}` : '-'}</td>
                            <td className="py-3">
                              <div className="font-semibold text-zinc-200 truncate max-w-sm flex items-center gap-2">
                                {file.metadata.title || file.filename}
                                <button onClick={() => openEditor(file)} className="text-zinc-500 hover:text-indigo-400 transition-colors"><Edit3 className="w-3.5 h-3.5" /></button>
                              </div>
                              <div className="text-xs text-zinc-500 mt-0.5 truncate flex items-center gap-2">
                                {file.metadata.artist || 'Unknown Artist'}
                                <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">{file.metadata.year ? `Year: ${file.metadata.year}` : '----'}</span>
                              </div>
                            </td>
                            <td className="py-3 text-zinc-400 text-xs font-medium">
                              <div>{(file.size / (1024 * 1024)).toFixed(1)} MB</div>
                              {file.metadata.bitrate > 0 && (<div className="text-[10px] text-zinc-500 mt-0.5">{file.metadata.bitrate} kbps</div>)}
                            </td>
                            <td className="py-3 pr-4 text-right rounded-r-xl">
                              <button onClick={() => enqueue([file.path])} className="bg-zinc-800 hover:bg-indigo-500 hover:text-white text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-md transition-all shadow-sm">Upload</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-700/50 flex items-center justify-center bg-zinc-900/20"><Music className="w-8 h-8 text-zinc-700" /></div><p className="text-sm font-medium">Folder is empty</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* QUEUE TAB */}
          {activeTab === 'queue' && (
            <div className="max-w-5xl mx-auto bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col h-full">
              <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-3">
                    Upload Task Queue
                    {settings.is_paused && <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-[10px] uppercase font-bold border border-amber-500/30 flex items-center gap-1"><PauseCircle className="w-3 h-3"/> Paused</span>}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Monitoring background upload workers</p>
                </div>
                <div className="flex items-center gap-3">
                  {jobs.some(j => j.status === 'failed') && (
                     <button onClick={retryFailedJobs} className="text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-800/80 hover:bg-indigo-500/20 hover:text-indigo-400 border border-zinc-700 transition-all flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> Retry Failed</button>
                  )}
                  <button onClick={togglePauseQueue} className={`text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${settings.is_paused ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30' : 'bg-zinc-800/80 hover:bg-amber-500/10 hover:text-amber-400 border border-zinc-700'}`}>
                    {settings.is_paused ? '▶ Resume Queue' : '⏸ Pause Queue'}
                  </button>
                  <button onClick={() => fetch('/api/queue/clear', { method: 'POST' }).then(fetchQueue)} className="text-xs font-semibold bg-zinc-800/80 hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 hover:border-red-500/30 px-4 py-2 rounded-lg text-zinc-300 transition-all flex items-center gap-2"><Trash2 className="w-3.5 h-3.5" /> Force Clear All</button>
                </div>
              </div>
              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-zinc-950/40 border border-zinc-800/60 p-4 rounded-xl flex items-center justify-between hover:border-zinc-700/80 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 w-2 h-2 rounded-full ${job.status === 'done' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : job.status === 'failed' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : job.status === 'uploading' ? 'bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-600'}`} />
                      <div>
                        <div className="text-sm font-semibold text-zinc-200 max-w-[400px] truncate">{job.file_path.split('/').pop()}</div>
                        <div className="text-xs font-medium text-zinc-500 mt-1 flex items-center gap-2"><Send className="w-3 h-3" /> {job.destination}</div>
                        {job.error_msg && (<div className="text-[11px] font-semibold text-red-400 mt-2 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 inline-block">{job.error_msg}</div>)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end w-48 shrink-0">
                      <div className="flex justify-between w-full mb-2 text-[10px] font-bold uppercase tracking-wider">
                        <span className={`${job.status === 'done' ? 'text-emerald-400' : ''} ${job.status === 'failed' ? 'text-red-400' : ''} ${job.status === 'uploading' ? 'text-indigo-400' : ''} ${job.status === 'pending' ? 'text-zinc-500' : ''}`}>{job.status}</span>
                        <span className="text-zinc-500">{job.progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden border border-zinc-700/50">
                        <div className={`h-full rounded-full transition-all duration-500 ${job.status === 'done' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-indigo-500 relative overflow-hidden'}`} style={{ width: `${job.progress}%` }}>
                          {job.status === 'uploading' && (<div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite] -skew-x-12"></div>)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* REPORT TAB */}
          {activeTab === 'report' && (
            <div className="max-w-4xl mx-auto bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl flex flex-col h-full">
              <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/50 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-400" /> Catalog Index Report</h3>
                  <p className="text-xs text-zinc-500 mt-1">Persistent log saved at <code className="text-indigo-400">/data/report.txt</code></p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={copyToClipboard} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-md">
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy All Links'}
                  </button>
                  <button onClick={saveReport} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition-all">{reportSaved ? 'Saved!' : 'Save Changes'}</button>
                  <button onClick={clearReport} className="bg-zinc-800 hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 px-3 py-2.5 rounded-lg text-xs font-semibold text-zinc-400 transition-all">Clear</button>
                </div>
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <textarea className="w-full flex-1 bg-zinc-950/70 border border-zinc-800 focus:border-indigo-500 rounded-xl p-4 text-xs font-mono text-zinc-300 outline-none resize-none leading-relaxed" value={reportContent} onChange={(e) => setReportContent(e.target.value)} placeholder="Uploaded album links will be automatically recorded here in [Year - Album](link) format..." />
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
              <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/50"><h3 className="text-base font-bold text-zinc-100 flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-indigo-400" /> API Configuration</h3></div>
              
              <div className="p-8 space-y-6">
                <div><label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Bot Token</label><input type="password" className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none font-mono" value={settings.bot_token} onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })} /></div>
                <div><label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Default Destination (@channel or -100123)</label><input type="text" className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none font-mono" value={settings.default_dest} onChange={(e) => setSettings({ ...settings, default_dest: e.target.value })} /></div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Min Delay (s)</label>
                    <div className="flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl focus-within:border-indigo-500 overflow-hidden">
                      <button onClick={() => setSettings({...settings, delay_per_file_min: Math.max(0, settings.delay_per_file_min - 1)})} className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-mono text-lg border-r border-zinc-800">-</button>
                      <input type="number" className="flex-1 w-full bg-transparent text-center text-sm text-zinc-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={settings.delay_per_file_min} onChange={(e) => setSettings({ ...settings, delay_per_file_min: parseInt(e.target.value) || 0 })} />
                      <button onClick={() => setSettings({...settings, delay_per_file_min: settings.delay_per_file_min + 1})} className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-mono text-lg border-l border-zinc-800">+</button>
                    </div>
                  </div>
                  <div>
                    <label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">Max Delay (s)</label>
                    <div className="flex items-center bg-zinc-950/50 border border-zinc-800 rounded-xl focus-within:border-indigo-500 overflow-hidden">
                      <button onClick={() => setSettings({...settings, delay_per_file_max: Math.max(0, settings.delay_per_file_max - 1)})} className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-mono text-lg border-r border-zinc-800">-</button>
                      <input type="number" className="flex-1 w-full bg-transparent text-center text-sm text-zinc-100 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" value={settings.delay_per_file_max} onChange={(e) => setSettings({ ...settings, delay_per_file_max: parseInt(e.target.value) || 0 })} />
                      <button onClick={() => setSettings({...settings, delay_per_file_max: settings.delay_per_file_max + 1})} className="w-11 h-11 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors font-mono text-lg border-l border-zinc-800">+</button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-zinc-900/80 border-t border-zinc-800/80 flex items-center justify-between">
                <button onClick={testBot} className="bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold px-8 py-3 rounded-xl text-white transition-all shadow-lg shadow-indigo-500/25">Save Configuration</button>
                {botStatus && (<div className={`text-xs font-semibold px-4 py-2 rounded-xl border ${botStatus.includes('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>{botStatus}</div>)}
              </div>
            </div>
          )}

          {/* MODALS */}
          {showCoverModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 max-w-2xl w-full flex flex-col shadow-2xl relative">
                <div className="flex justify-between items-center mb-4">
                  <div><h3 className="text-lg font-bold text-white">Album Cover</h3><p className="text-xs text-zinc-400 mt-1">Resolution: {coverRes.w > 0 ? <strong className="text-indigo-400">{coverRes.w} x {coverRes.h} px</strong> : 'Calculating...'}</p></div>
                  <button onClick={() => setShowCoverModal(false)} className="p-2 bg-zinc-800 hover:bg-red-500 hover:text-white rounded-lg transition-all text-zinc-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="bg-black/50 rounded-xl overflow-hidden flex items-center justify-center min-h-[300px]">
                  <img src={`/api/library/cover?path=${encodeURIComponent(selectedFolder)}`} alt="Cover" className="max-h-[60vh] object-contain shadow-2xl" onLoad={(e) => setCoverRes({ w: e.target.naturalWidth, h: e.target.naturalHeight })} />
                </div>
              </div>
            </div>
          )}
          
          {editingFile && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full flex flex-col shadow-2xl relative">
                <div className="flex justify-between items-center mb-6">
                  <div><h3 className="text-lg font-bold text-white">Edit Metadata</h3><p className="text-xs text-zinc-400 mt-1 truncate max-w-[250px]">{editingFile.filename}</p></div>
                  <button onClick={() => setEditingFile(null)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-all text-zinc-400"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4">
                  <div><label className="text-xs font-bold uppercase text-zinc-500">Title</label><input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" value={editForm.title} onChange={(e) => setEditForm({...editForm, title: e.target.value})} /></div>
                  <div><label className="text-xs font-bold uppercase text-zinc-500">Artist</label><input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" value={editForm.artist} onChange={(e) => setEditForm({...editForm, artist: e.target.value})} /></div>
                  <div><label className="text-xs font-bold uppercase text-zinc-500">Album</label><input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" value={editForm.album} onChange={(e) => setEditForm({...editForm, album: e.target.value})} /></div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-xs font-bold uppercase text-zinc-500">Year</label><input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" value={editForm.year} onChange={(e) => setEditForm({...editForm, year: e.target.value})} /></div>
                    <div><label className="text-xs font-bold uppercase text-zinc-500">Track #</label><input type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-indigo-500" value={editForm.track} onChange={(e) => setEditForm({...editForm, track: e.target.value})} /></div>
                  </div>
                </div>
                <button onClick={saveMetadata} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl mt-6 transition-all shadow-lg">Save Changes</button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
