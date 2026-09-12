import React, { useState, useEffect } from 'react';
import { 
  Folder, Music, Send, CheckCircle2, AlertCircle, 
  Settings as SettingsIcon, List, Server, Search, 
  PlayCircle, Clock, HardDrive, RefreshCw, LogOut, ChevronRight
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [files, setFiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({ bot_token: '', default_dest: '', delay_per_file_min: 3, delay_per_file_max: 7 });
  const [destOverride, setDestOverride] = useState('');
  const [botStatus, setBotStatus] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchFolders();
    fetchQueue();

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

  const handleLogin = async () => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (res.ok) {
      setAuthRequired(false);
      fetchSettings();
      fetchFolders();
    } else {
      alert('Invalid Password');
    }
  };

  const fetchSettings = async () => {
    const res = await fetch('/api/settings');
    if (res.status === 401) return setAuthRequired(true);
    const data = await res.json();
    setSettings(data);
    setDestOverride(data.default_dest || '');
  };

  const fetchFolders = async () => {
    const res = await fetch('/api/library/tree');
    if (res.ok) setFolders(await res.json());
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

  const testBot = async () => {
    setBotStatus('Connecting...');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (res.ok && data.bot_username) {
      setBotStatus(`Connected: @${data.bot_username}`);
    } else {
      setBotStatus(`Error: ${data.detail || 'Connection failed'}`);
    }
  };

  const enqueue = async (filePaths, includeCover = false) => {
    const dest = destOverride || settings.default_dest;
    if (!dest) return alert('Please enter a destination channel (@channel or ID)');
    setIsUploading(true);
    await fetch('/api/queue/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filePaths, destination: dest, include_cover: includeCover })
    });
    setIsUploading(false);
    fetchQueue();
    setActiveTab('queue');
  };

  if (authRequired) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="bg-zinc-900/80 backdrop-blur-xl p-8 rounded-2xl border border-zinc-800 w-full max-w-sm shadow-2xl relative z-10">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
              <Music className="w-8 h-8 text-indigo-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-2 text-center text-white tracking-tight">Welcome Back</h2>
          <p className="text-zinc-400 text-sm text-center mb-6">Enter your credentials to access the uploader.</p>
          <input
            type="password"
            placeholder="Admin Password"
            className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 p-3 rounded-lg text-white mb-6 outline-none transition-all placeholder:text-zinc-600"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button 
            onClick={handleLogin} 
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 py-3 rounded-lg text-white font-semibold transition-all shadow-lg shadow-indigo-500/25"
          >
            Access Dashboard
          </button>
        </div>
      </div>
    );
  }

  const activeJobs = jobs.filter(j => j.status === 'uploading' || j.status === 'pending').length;

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden selection:bg-indigo-500/30">
      
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900/50 border-r border-zinc-800/80 flex flex-col backdrop-blur-xl">
        <div className="p-6 flex items-center gap-3">
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
            <Send className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-zinc-100">TG UPLOADER</h1>
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-widest">Studio Panel</p>
          </div>
        </div>
        
        <nav className="px-4 py-2 space-y-1.5 flex-1">
          <button
            onClick={() => setActiveTab('library')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === 'library' 
                ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' 
                : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
            }`}
          >
            <Folder className="w-4 h-4" /> Library Browser
          </button>
          <button
            onClick={() => { setActiveTab('queue'); fetchQueue(); }}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === 'queue' 
                ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' 
                : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <List className="w-4 h-4" /> Queue
            </div>
            {activeJobs > 0 && (
              <span className="bg-indigo-500/20 text-indigo-400 py-0.5 px-2.5 rounded-full text-[10px] font-bold border border-indigo-500/20">
                {activeJobs}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === 'settings' 
                ? 'bg-zinc-800/80 text-white shadow-sm border border-zinc-700/50' 
                : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200'
            }`}
          >
            <SettingsIcon className="w-4 h-4" /> Settings
          </button>
        </nav>
        
        <div className="p-6 border-t border-zinc-800/80">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <Server className="w-4 h-4" />
            <span className="truncate flex-1">System Online</span>
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-fixed bg-center">
        <div className="absolute inset-0 bg-zinc-950/95 z-0"></div>
        
        {/* Top Header */}
        <header className="h-16 border-b border-zinc-800/80 px-8 flex items-center justify-between relative z-10 bg-zinc-900/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm text-zinc-400 font-medium tracking-wide">
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} 
            {selectedFolder && activeTab === 'library' && (
              <>
                <ChevronRight className="w-4 h-4 text-zinc-600" />
                <span className="text-zinc-200">{selectedFolder.split('/').pop()}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-1.5 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/50 transition-all">
              <Send className="w-3.5 h-3.5 text-zinc-500 mr-2" />
              <input
                type="text"
                placeholder="Dest: @channel or ID"
                className="bg-transparent border-none text-xs w-48 text-zinc-200 outline-none placeholder:text-zinc-600"
                value={destOverride}
                onChange={(e) => setDestOverride(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-auto p-8 relative z-10">
          
          {/* LIBRARY TAB */}
          {activeTab === 'library' && (
            <div className="grid grid-cols-12 gap-8 h-full max-w-7xl mx-auto">
              {/* Folder Sidebar */}
              <div className="col-span-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-xl">
                <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50">
                  <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                    <HardDrive className="w-3.5 h-3.5" /> Mounted Volumes
                  </h3>
                </div>
                <div className="p-3 overflow-y-auto flex-1 space-y-1">
                  {folders.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => loadFolderFiles(f.path)}
                      className={`w-full text-left px-4 py-3 rounded-xl text-sm flex items-center gap-3 transition-all ${
                        selectedFolder === f.path 
                          ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-sm' 
                          : 'hover:bg-zinc-800/50 text-zinc-300 border border-transparent'
                      }`}
                    >
                      <Folder className={`w-4 h-4 shrink-0 ${selectedFolder === f.path ? 'fill-indigo-500/20' : 'text-zinc-500'}`} />
                      <span className="truncate font-medium">{f.name}</span>
                    </button>
                  ))}
                  {folders.length === 0 && (
                    <div className="p-8 text-center text-zinc-600 flex flex-col items-center">
                      <Folder className="w-8 h-8 mb-3 opacity-20" />
                      <span className="text-xs font-medium">No folders found</span>
                    </div>
                  )}
                </div>
              </div>

              {/* File List */}
              <div className="col-span-8 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl flex flex-col overflow-hidden backdrop-blur-xl shadow-xl">
                <div className="p-5 border-b border-zinc-800/80 bg-zinc-900/50 flex justify-between items-center h-[72px]">
                  {selectedFolder ? (
                    <div>
                      <h3 className="font-semibold text-zinc-100 text-sm truncate max-w-[300px]">
                        {selectedFolder.split('/').pop()}
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">{files.length} tracks found</p>
                    </div>
                  ) : (
                    <h3 className="text-sm font-medium text-zinc-500">Select a folder to view files</h3>
                  )}
                  
                  {files.length > 0 && (
                    <button
                      onClick={() => enqueue(files.map(f => f.path), true)}
                      disabled={isUploading}
                      className="bg-zinc-100 hover:bg-white text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-2 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                      <PlayCircle className="w-4 h-4" /> Upload Full Album
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {files.length > 0 ? (
                    <table className="w-full text-left text-sm border-separate border-spacing-y-1">
                      <thead>
                        <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-4">
                          <th className="font-medium pb-2 pl-4">Track Info</th>
                          <th className="font-medium pb-2 w-24">Size</th>
                          <th className="font-medium pb-2 text-right pr-4">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {files.map((file) => (
                          <tr key={file.path} className="group bg-zinc-950/20 hover:bg-zinc-800/40 transition-colors rounded-xl">
                            <td className="py-3 pl-4 rounded-l-xl">
                              <div className="font-semibold text-zinc-200 truncate max-w-sm">{file.metadata.title || file.filename}</div>
                              <div className="text-xs text-zinc-500 mt-0.5 truncate">{file.metadata.artist || 'Unknown Artist'}</div>
                            </td>
                            <td className="py-3 text-zinc-400 text-xs font-medium">
                              {(file.size / (1024 * 1024)).toFixed(1)} MB
                            </td>
                            <td className="py-3 pr-4 text-right rounded-r-xl">
                              <button
                                onClick={() => enqueue([file.path])}
                                className="opacity-0 group-hover:opacity-100 bg-zinc-800 hover:bg-indigo-500 hover:text-white text-zinc-300 text-xs font-semibold px-3 py-1.5 rounded-md transition-all shadow-sm"
                              >
                                Upload
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-zinc-700/50 flex items-center justify-center bg-zinc-900/20">
                        <Music className="w-8 h-8 text-zinc-700" />
                      </div>
                      <p className="text-sm font-medium">Folder is empty</p>
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
                  <h3 className="text-lg font-bold text-zinc-100">Upload Task Queue</h3>
                  <p className="text-xs text-zinc-500 mt-1">Monitoring background upload workers</p>
                </div>
                <button
                  onClick={() => fetch('/api/queue/clear', { method: 'POST' }).then(fetchQueue)}
                  className="text-xs font-semibold bg-zinc-800/80 hover:bg-red-500/20 hover:text-red-400 border border-zinc-700 hover:border-red-500/30 px-4 py-2 rounded-lg text-zinc-300 transition-all flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Clear History
                </button>
              </div>
              
              <div className="p-4 space-y-2 overflow-y-auto flex-1">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-zinc-950/40 border border-zinc-800/60 p-4 rounded-xl flex items-center justify-between hover:border-zinc-700/80 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`mt-0.5 w-2 h-2 rounded-full ${
                        job.status === 'done' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 
                        job.status === 'failed' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' : 
                        job.status === 'uploading' ? 'bg-indigo-500 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]' : 'bg-zinc-600'
                      }`} />
                      <div>
                        <div className="text-sm font-semibold text-zinc-200 max-w-[400px] truncate">
                          {job.file_path.split('/').pop()}
                        </div>
                        <div className="text-xs font-medium text-zinc-500 mt-1 flex items-center gap-2">
                          <Send className="w-3 h-3" /> {job.destination}
                        </div>
                        {job.error_msg && (
                          <div className="text-[11px] font-semibold text-red-400 mt-2 bg-red-500/10 px-2 py-1 rounded border border-red-500/20 inline-block">
                            {job.error_msg}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end w-48 shrink-0">
                      <div className="flex justify-between w-full mb-2 text-[10px] font-bold uppercase tracking-wider">
                        <span className={`
                          ${job.status === 'done' ? 'text-emerald-400' : ''}
                          ${job.status === 'failed' ? 'text-red-400' : ''}
                          ${job.status === 'uploading' ? 'text-indigo-400' : ''}
                          ${job.status === 'pending' ? 'text-zinc-500' : ''}
                        `}>{job.status}</span>
                        <span className="text-zinc-500">{job.progress}%</span>
                      </div>
                      <div className="w-full bg-zinc-800/80 rounded-full h-1.5 overflow-hidden border border-zinc-700/50">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            job.status === 'done' ? 'bg-emerald-500' : 
                            job.status === 'failed' ? 'bg-red-500' : 
                            'bg-indigo-500 relative overflow-hidden'
                          }`}
                          style={{ width: `${job.progress}%` }}
                        >
                          {job.status === 'uploading' && (
                            <div className="absolute inset-0 bg-white/20 animate-[shimmer_1.5s_infinite] -skew-x-12"></div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-600 mt-12">
                    <List className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium">Upload queue is empty</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* SETTINGS TAB */}
          {activeTab === 'settings' && (
            <div className="max-w-2xl mx-auto">
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl overflow-hidden shadow-xl backdrop-blur-xl">
                <div className="p-6 border-b border-zinc-800/80 bg-zinc-900/50">
                  <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                    <SettingsIcon className="w-5 h-5 text-indigo-400" />
                    Engine Configuration
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">Manage API credentials and rate limits</p>
                </div>
                
                <div className="p-8 space-y-6">
                  {/* Token */}
                  <div>
                    <label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Telegram Bot Token
                    </label>
                    <input
                      type="password"
                      placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                      className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none transition-all font-mono"
                      value={settings.bot_token}
                      onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
                    />
                    <p className="text-[11px] text-zinc-600 font-medium mt-2 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Must be generated via @BotFather
                    </p>
                  </div>

                  {/* Channel */}
                  <div>
                    <label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                      Default Destination
                    </label>
                    <input
                      type="text"
                      placeholder="@my_music_channel or -1001234567890"
                      className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none transition-all font-mono"
                      value={settings.default_dest}
                      onChange={(e) => setSettings({ ...settings, default_dest: e.target.value })}
                    />
                  </div>

                  {/* Limits */}
                  <div className="grid grid-cols-2 gap-6 pt-4 border-t border-zinc-800/50">
                    <div>
                      <label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        Min Delay (Seconds)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none transition-all"
                        value={settings.delay_per_file_min}
                        onChange={(e) => setSettings({ ...settings, delay_per_file_min: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="flex text-xs font-bold uppercase tracking-wider text-zinc-500 mb-2">
                        Max Delay (Seconds)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-zinc-950/50 border border-zinc-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-zinc-100 outline-none transition-all"
                        value={settings.delay_per_file_max}
                        onChange={(e) => setSettings({ ...settings, delay_per_file_max: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 bg-zinc-900/80 border-t border-zinc-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={testBot} 
                      className="bg-indigo-600 hover:bg-indigo-500 text-sm font-semibold px-6 py-2.5 rounded-xl text-white transition-all shadow-lg shadow-indigo-500/25"
                    >
                      Save Configuration
                    </button>
                  </div>
                  {botStatus && (
                    <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                      botStatus.includes('Error') 
                        ? 'bg-red-500/10 text-red-400 border-red-500/20' 
                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    }`}>
                      {botStatus}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
