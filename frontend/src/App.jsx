import React, { useState, useEffect } from 'react';
import { Folder, Music, Send, CheckCircle2, AlertCircle, RefreshCw, Settings as SettingsIcon, List, Server } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('library');
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({ bot_token: '', default_dest: '', delay_per_file_min: 3, delay_per_file_max: 7 });
  const [destOverride, setDestOverride] = useState('');
  const [botStatus, setBotStatus] = useState('');
  const [authRequired, setAuthRequired] = useState(false);
  const [password, setPassword] = useState('');

  // Initial Load
  useEffect(() => {
    fetchSettings();
    fetchFolders();
    fetchQueue();

    // WebSocket for progress
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
    const res = await fetch(`/api/library/files?path=${encodeURIComponent(folderPath)}`);
    if (res.ok) {
      const data = await res.json();
      setFiles(data);
      setSelectedFiles([]);
    }
  };

  const fetchQueue = async () => {
    const res = await fetch('/api/queue');
    if (res.ok) setJobs(await res.json());
  };

  const testBot = async () => {
    setBotStatus('Testing...');
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    const data = await res.json();
    if (res.ok && data.bot_username) {
      setBotStatus(`Connected as @${data.bot_username}`);
    } else {
      setBotStatus(`Error: ${data.detail || 'Connection failed'}`);
    }
  };

  const enqueue = async (filePaths, includeCover = false) => {
    const dest = destOverride || settings.default_dest;
    if (!dest) return alert('Please enter a destination channel (@channel or ID)');
    
    await fetch('/api/queue/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ files: filePaths, destination: dest, include_cover: includeCover })
    });
    fetchQueue();
    setActiveTab('queue');
  };

  if (authRequired) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 w-96">
          <h2 className="text-xl font-bold mb-4 text-white">Admin Login</h2>
          <input
            type="password"
            placeholder="Password"
            className="w-full bg-slate-800 border border-slate-700 p-2.5 rounded text-white mb-4"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-500 py-2.5 rounded text-white font-medium">
            Unlock Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center gap-2">
          <Music className="w-6 h-6 text-blue-500" />
          <span className="font-bold text-lg">Telegram Audio</span>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          <button
            onClick={() => setActiveTab('library')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeTab === 'library' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <Folder className="w-4 h-4" /> Library Browser
          </button>
          <button
            onClick={() => { setActiveTab('queue'); fetchQueue(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeTab === 'queue' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <List className="w-4 h-4" /> Upload Queue ({jobs.filter(j => j.status === 'uploading' || j.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeTab === 'settings' ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-slate-800 text-slate-400'
            }`}
          >
            <SettingsIcon className="w-4 h-4" /> Bot & Upload Settings
          </button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-400">
            Host: <span className="text-slate-200">185.224.129.220:8081</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">Destination:</span>
            <input
              type="text"
              placeholder="@channel_username or ID"
              className="bg-slate-900 border border-slate-700 text-xs px-3 py-1.5 rounded w-56 text-white"
              value={destOverride}
              onChange={(e) => setDestOverride(e.target.value)}
            />
          </div>
        </header>

        {/* Workspace Views */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'library' && (
            <div className="grid grid-cols-12 gap-6 h-full">
              {/* Folder Selector */}
              <div className="col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-y-auto">
                <h3 className="font-semibold text-sm text-slate-400 uppercase tracking-wider mb-3">Folders (/music)</h3>
                <div className="space-y-1">
                  {folders.map((f) => (
                    <button
                      key={f.path}
                      onClick={() => loadFolderFiles(f.path)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 truncate ${
                        selectedFolder === f.path ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <Folder className="w-4 h-4 shrink-0" />
                      <span className="truncate">{f.name}</span>
                    </button>
                  ))}
                  {folders.length === 0 && <div className="text-xs text-slate-500">No folders found in mounted volume</div>}
                </div>
              </div>

              {/* Files in Folder */}
              <div className="col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-sm text-slate-400 truncate max-w-sm">
                    {selectedFolder ? selectedFolder.split('/').pop() : 'Select a folder'}
                  </h3>
                  {files.length > 0 && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => enqueue(files.map(f => f.path), true)}
                        className="bg-blue-600 hover:bg-blue-500 text-xs font-semibold px-3 py-1.5 rounded flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" /> Upload Album (With Cover)
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto">
                  <table className="w-full text-left text-xs text-slate-400">
                    <thead className="border-b border-slate-800 uppercase text-slate-500">
                      <tr>
                        <th className="pb-2">Title / Artist</th>
                        <th className="pb-2">Size</th>
                        <th className="pb-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {files.map((file) => (
                        <tr key={file.path} className="hover:bg-slate-800/30">
                          <td className="py-2.5">
                            <div className="font-medium text-slate-200">{file.metadata.title || file.filename}</div>
                            <div className="text-slate-500">{file.metadata.artist}</div>
                          </td>
                          <td className="py-2.5">{(file.size / (1024 * 1024)).toFixed(1)} MB</td>
                          <td className="py-2.5 text-right">
                            <button
                              onClick={() => enqueue([file.path])}
                              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1 rounded"
                            >
                              Upload
                            </button>
                          </td>
                        </tr>
                      ))}
                      {files.length === 0 && (
                        <tr>
                          <td colSpan="3" className="py-8 text-center text-slate-500">
                            No MP3 files found in this folder
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'queue' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-200">Upload Task Queue</h3>
                <button
                  onClick={() => fetch('/api/queue/clear', { method: 'POST' }).then(fetchQueue)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-slate-300"
                >
                  Clear Finished
                </button>
              </div>
              <div className="space-y-3">
                {jobs.map((job) => (
                  <div key={job.id} className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                    <div className="max-w-md truncate">
                      <div className="text-xs font-semibold text-slate-200 truncate">{job.file_path.split('/').pop()}</div>
                      <div className="text-[11px] text-slate-500">Target: {job.destination}</div>
                      {job.error_msg && <div className="text-[11px] text-red-400 mt-1">{job.error_msg}</div>}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-32 bg-slate-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${job.status === 'done' ? 'bg-emerald-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium uppercase text-slate-400 w-16 text-right">{job.status}</span>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <div className="text-center text-slate-500 text-xs py-8">Queue is empty</div>}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="max-w-2xl bg-slate-900 border border-slate-800 rounded-xl p-6">
              <h3 className="font-semibold text-slate-200 mb-4">Telegram Bot Credentials</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Bot Token</label>
                  <input
                    type="password"
                    placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white"
                    value={settings.bot_token}
                    onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Obtained from @BotFather</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Default Destination Channel / Group</label>
                  <input
                    type="text"
                    placeholder="@my_music_channel or -1001234567890"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white"
                    value={settings.default_dest}
                    onChange={(e) => setSettings({ ...settings, default_dest: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Min Delay per Song (sec)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white"
                      value={settings.delay_per_file_min}
                      onChange={(e) => setSettings({ ...settings, delay_per_file_min: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Max Delay per Song (sec)</label>
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-white"
                      value={settings.delay_per_file_max}
                      onChange={(e) => setSettings({ ...settings, delay_per_file_max: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-slate-800">
                  <button onClick={testBot} className="bg-blue-600 hover:bg-blue-500 text-xs font-medium px-4 py-2 rounded text-white">
                    Save & Test Connection
                  </button>
                  {botStatus && <span className="text-xs text-slate-300">{botStatus}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
