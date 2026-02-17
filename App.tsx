
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import FileExplorer from './components/FileExplorer';
import TerminalContainer, { TerminalHandle } from './components/TerminalContainer';
import ProcessManager from './components/ProcessManager';
import DashboardHeader from './components/DashboardHeader';
import Editor from './components/Editor';
import Auth from './components/Auth';
import { ProjectFile, UserProcess, ContainerStats } from './types';
import { X, Code as CodeIcon, Settings, Shield, Bell, CreditCard, ChevronLeft, Save, Trash2, Key, Plus, Lock, Globe, Server } from 'lucide-react';

const STORAGE_KEY = 'pyhost_v1_files_data';
const AUTH_KEY = 'pyhost_v1_auth_session';
const SETTINGS_KEY = 'pyhost_v1_settings';
const UI_STATE_KEY = 'pyhost_v1_ui_state';

const INITIAL_FILES: ProjectFile[] = [
  {
    id: 'root',
    name: 'project',
    type: 'directory',
    path: '/home/python/app',
    children: [
      { id: '1', name: 'main.py', type: 'file', path: '/home/python/app/main.py', content: 'import os\nimport time\n\nprint("🚀 Starting PyHost Worker...")\nwhile True:\n    print(f"Ping from {os.name} at {time.ctime()}")\n    time.sleep(10)' },
      { id: '2', name: 'requirements.txt', type: 'file', path: '/home/python/app/requirements.txt', content: 'discord.py-self\nPyNaCl\nrequests' },
      { id: '3', name: 'utils', type: 'directory', path: '/home/python/app/utils', children: [
        { id: '4', name: 'config.json', type: 'file', path: '/home/python/app/utils/config.json', content: '{\n  "version": "1.0.0",\n  "env": "production"\n}' }
      ]}
    ]
  }
];

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'ide' | 'processes' | 'settings' | 'profile'>('ide');
  const [activeSettingsSection, setActiveSettingsSection] = useState<string | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>(INITIAL_FILES);
  const [openFilePaths, setOpenFilePaths] = useState<string[]>(['/home/python/app/main.py']);
  const [activeFilePath, setActiveFilePath] = useState<string>('/home/python/app/main.py');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [processes, setProcesses] = useState<UserProcess[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Settings State
  const [projectSettings, setProjectSettings] = useState({
    projectName: 'Production Container 6AYR',
    envVars: [{ key: 'PYTHONUNBUFFERED', value: '1' }],
    publicAccess: false,
    autoRestart: true,
    sshKeys: [] as { id: string, name: string, key: string }[],
    notifications: {
      onCrash: true,
      onLimitReach: true,
      onDeploy: false
    }
  });

  const terminalRef = useRef<TerminalHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stats, setStats] = useState<ContainerStats>({
    cpuUsage: 4.2,
    memoryUsage: 128,
    memoryLimit: 1024,
    diskUsage: 22,
    diskLimit: 10000
  });

  // Load persistence logic
  useEffect(() => {
    const savedAuth = localStorage.getItem(AUTH_KEY);
    if (savedAuth) {
      try {
        const parsedAuth = JSON.parse(savedAuth);
        setIsAuthenticated(true);
        setUser(parsedAuth);
      } catch (e) { console.error("Auth parse error", e); }
    }

    const savedFiles = localStorage.getItem(STORAGE_KEY);
    if (savedFiles) {
      try {
        const parsed = JSON.parse(savedFiles);
        if (Array.isArray(parsed) && parsed.length > 0) setFiles(parsed);
      } catch (e) { console.error("Failed to load saved files", e); }
    }

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
        setProjectSettings(JSON.parse(savedSettings));
      } catch (e) { console.error("Failed to load settings", e); }
    }

    const savedUI = localStorage.getItem(UI_STATE_KEY);
    if (savedUI) {
      try {
        const ui = JSON.parse(savedUI);
        if (ui.openFilePaths) setOpenFilePaths(ui.openFilePaths);
        if (ui.activeFilePath) setActiveFilePath(ui.activeFilePath);
        if (ui.activeTab) setActiveTab(ui.activeTab);
      } catch (e) { console.error("Failed to load UI state", e); }
    }

    setIsLoaded(true);
  }, []);

  // Save changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(projectSettings));
      localStorage.setItem(UI_STATE_KEY, JSON.stringify({
        openFilePaths,
        activeFilePath,
        activeTab
      }));
    }
  }, [files, projectSettings, isLoaded, openFilePaths, activeFilePath, activeTab]);

  const handleLogin = (email: string, remember: boolean) => {
    const userData = { email };
    setIsAuthenticated(true);
    setUser(userData);
    if (remember) localStorage.setItem(AUTH_KEY, JSON.stringify(userData));
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(UI_STATE_KEY);
  };

  const findFile = (path: string, currentFiles: ProjectFile[]): ProjectFile | null => {
    if (!currentFiles) return null;
    for (const file of currentFiles) {
      if (file.path === path) return file;
      if (file.children) {
        const found = findFile(path, file.children);
        if (found) return found;
      }
    }
    return null;
  };

  const getAllPaths = (currentFiles: ProjectFile[]): string[] => {
    let paths: string[] = [];
    if (!currentFiles) return paths;
    currentFiles.forEach(f => {
      paths.push(f.path);
      if (f.children) paths = [...paths, ...getAllPaths(f.children)];
    });
    return paths;
  };

  const handleSelectAll = useCallback(() => {
    const all = getAllPaths(files);
    setSelectedPaths(new Set(all));
  }, [files]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
          e.preventDefault();
          handleSelectAll();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSelectAll]);

  const activeFile = findFile(activeFilePath, files);

  const handleFileSelect = (path: string, isMulti: boolean = false) => {
    const file = findFile(path, files);
    if (!file) return;

    if (isMulti) {
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        return next;
      });
    } else {
      setSelectedPaths(new Set([path]));
      if (file.type === 'file') {
        if (!openFilePaths.includes(path)) setOpenFilePaths(prev => [...prev, path]);
        setActiveFilePath(path);
        setActiveTab('ide');
      }
    }
  };

  const closeTab = (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPaths = openFilePaths.filter(p => p !== path);
    setOpenFilePaths(newPaths);
    if (activeFilePath === path && newPaths.length > 0) {
      setActiveFilePath(newPaths[newPaths.length - 1]);
    } else if (newPaths.length === 0) {
      setActiveFilePath('');
    }
  };

  const updateFileContent = (path: string, content: string) => {
    const updateRecursive = (items: ProjectFile[]): ProjectFile[] => {
      return items.map(item => {
        if (item.path === path) return { ...item, content };
        if (item.children) return { ...item, children: updateRecursive(item.children) };
        return item;
      });
    };
    setFiles(prev => updateRecursive(prev));
  };

  const handleCreateFile = (type: 'file' | 'directory') => {
    const name = prompt(`Enter ${type} name:`);
    if (!name || name.trim() === '') return;
    
    const fileName = name.trim();
    const newFile: ProjectFile = {
      id: Math.random().toString(36).substr(2, 9),
      name: fileName,
      type,
      path: `/home/python/app/${fileName}`,
      content: type === 'file' ? '' : undefined,
      children: type === 'directory' ? [] : undefined
    };

    setFiles(prev => {
      const updatedFiles = prev.length > 0 ? [...prev] : [{ ...INITIAL_FILES[0], children: [] }];
      const root = { ...updatedFiles[0] };
      const children = root.children ? [...root.children] : [];
      
      if (children.some(c => c.name === fileName)) {
        alert(`A ${type} with this name already exists.`);
        return prev;
      }
      
      root.children = [...children, newFile];
      updatedFiles[0] = root;
      return updatedFiles;
    });
  };

  const handleUploadFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files;
    if (!uploaded || uploaded.length === 0) return;
    try {
      const newFiles: ProjectFile[] = [];
      for (let i = 0; i < uploaded.length; i++) {
        const file = uploaded[i];
        if (file.size > 1024 * 1024) continue;
        const content = await file.text();
        newFiles.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          type: 'file',
          path: `/home/python/app/${file.name}`,
          content
        });
      }
      setFiles(prev => {
        const updatedFiles = prev.length > 0 ? [...prev] : [{ ...INITIAL_FILES[0], children: [] }];
        const root = { ...updatedFiles[0] };
        const children = root.children ? [...root.children] : [];
        const existingNames = new Set(children.map(c => c.name));
        const filteredNewFiles = newFiles.filter(nf => !existingNames.has(nf.name));
        root.children = [...children, ...filteredNewFiles];
        updatedFiles[0] = root;
        return updatedFiles;
      });
    } catch (err) {
      alert("Failed to upload files");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRunScript = () => {
    if (!activeFile) {
      alert("Please open a file to run it.");
      return;
    }
    const cmd = `python3 ${activeFile.name}`;
    terminalRef.current?.executeCommand(cmd);
    const newProc: UserProcess = {
      id: Math.random().toString(36).substr(2, 9),
      name: activeFile.name,
      status: 'starting',
      cpu: 0,
      memory: 0,
      uptime: '0s',
      command: cmd
    };
    setProcesses(prev => [newProc, ...prev]);
    setTimeout(() => {
      setProcesses(prev => prev.map(p => p.id === newProc.id ? { 
        ...p, status: 'running', cpu: 1.5, memory: 42, uptime: '1s' 
      } : p));
    }, 2000);
  };

  const deleteSelected = () => {
    if (selectedPaths.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPaths.size} item(s)?`)) return;
    const removeRecursive = (items: ProjectFile[]): ProjectFile[] => {
      return items.filter(item => !selectedPaths.has(item.path)).map(item => {
        if (item.children) return { ...item, children: removeRecursive(item.children) };
        return item;
      });
    };
    setFiles(prev => removeRecursive(prev));
    setOpenFilePaths(prev => prev.filter(p => !selectedPaths.has(p)));
    if (selectedPaths.has(activeFilePath)) setActiveFilePath('');
    setSelectedPaths(new Set());
  };

  if (!isAuthenticated) return <Auth onLogin={handleLogin} />;

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden text-zinc-300">
      <Sidebar activeTab={activeTab} setActiveTab={(t) => { setActiveTab(t); setActiveSettingsSection(null); }} />
      
      <main className="flex-1 flex flex-col min-w-0">
        <DashboardHeader 
          projectName={projectSettings.projectName} 
          stats={stats} 
          onRun={handleRunScript}
        />
        
        <div className="flex-1 flex overflow-hidden p-3 gap-3">
          {activeTab === 'ide' && (
            <div className="w-64 flex flex-col bg-zinc-900/40 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
              <div className="p-3 border-b border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Explorer</span>
                <div className="flex gap-2">
                  <button onClick={() => handleCreateFile('file')} className="p-1 text-zinc-500 hover:text-white transition-colors"><CodeIcon className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleCreateFile('directory')} className="p-1 text-zinc-500 hover:text-white transition-colors"><CodeIcon className="w-3.5 h-3.5" /></button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-1 text-zinc-500 hover:text-white transition-colors"><CodeIcon className="w-3.5 h-3.5" /></button>
                  <input type="file" multiple ref={fileInputRef} onChange={handleUploadFiles} className="hidden" />
                </div>
              </div>
              {selectedPaths.size > 0 && (
                <div className="px-3 py-1.5 bg-blue-500/10 border-b border-zinc-800 flex items-center justify-between">
                  <span className="text-[10px] text-blue-400 font-bold uppercase">{selectedPaths.size} Selected</span>
                  <button onClick={deleteSelected} className="text-[10px] text-red-400 hover:text-red-300 uppercase font-bold">Delete</button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-2">
                <FileExplorer 
                  files={files} onSelect={handleFileSelect} activePath={activeFilePath} 
                  onDelete={(p) => { setSelectedPaths(new Set([p])); deleteSelected(); }} 
                  selectedPaths={selectedPaths}
                />
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {activeTab === 'ide' ? (
              <>
                <div className="flex-[3] flex flex-col bg-zinc-900/20 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md">
                  <div className="flex bg-zinc-950/50 border-b border-zinc-800/50 overflow-x-auto scrollbar-hide">
                    {openFilePaths.map(path => (
                      <div
                        key={path} onClick={() => setActiveFilePath(path)}
                        className={`group flex items-center gap-2 px-4 py-2.5 text-xs border-r border-zinc-800 cursor-pointer min-w-[120px] transition-all relative ${
                          activeFilePath === path ? 'bg-zinc-900 text-blue-400 font-medium' : 'text-zinc-500 hover:bg-zinc-800/40'
                        }`}
                      >
                        <span className="truncate">{path.split('/').pop()}</span>
                        <button onClick={(e) => closeTab(path, e)} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-zinc-700 rounded transition-opacity"><X className="w-3 h-3" /></button>
                        {activeFilePath === path && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 relative">
                    {activeFile ? (
                      <Editor 
                        content={activeFile.content || ''} 
                        onChange={(val) => updateFileContent(activeFilePath, val)} filename={activeFile.name}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-zinc-600 space-y-4">
                        <CodeIcon className="w-12 h-12 opacity-20" />
                        <p className="text-sm">Welcome to PyHost IDE.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex-[2] flex flex-col bg-black border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                  <TerminalContainer ref={terminalRef} />
                </div>
              </>
            ) : activeTab === 'processes' ? (
              <div className="flex-1 flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl">
                <ProcessManager processes={processes} onRestart={(id) => {
                  setProcesses(prev => prev.map(p => p.id === id ? {...p, status: 'starting', uptime: '0s'} : p));
                  setTimeout(() => setProcesses(prev => prev.map(p => p.id === id ? {...p, status: 'running'} : p)), 1000);
                }} />
              </div>
            ) : activeTab === 'settings' ? (
              <OverlayView title="Settings" onClose={() => setActiveTab('ide')}>
                {!activeSettingsSection ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 animate-in slide-in-from-bottom-2 duration-300">
                    <SettingsCard icon={Settings} title="General" description="Adjust your workspace and environment preferences." onClick={() => setActiveSettingsSection('general')} />
                    <SettingsCard icon={Shield} title="Security" description="Manage SSH keys, firewall rules, and tokens." onClick={() => setActiveSettingsSection('security')} />
                    <SettingsCard icon={Bell} title="Notifications" description="Configure alerts for resource limits and crashes." onClick={() => setActiveSettingsSection('notifications')} />
                    <SettingsCard icon={CreditCard} title="Billing" description="Review your usage plans and payment methods." onClick={() => setActiveSettingsSection('billing')} />
                  </div>
                ) : (
                  <div className="flex flex-col h-full animate-in slide-in-from-right-4 duration-300">
                    <div className="p-4 border-b border-zinc-800 flex items-center gap-4 bg-zinc-900/20">
                      <button onClick={() => setActiveSettingsSection(null)} className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"><ChevronLeft className="w-5 h-5" /></button>
                      <h3 className="font-bold text-lg capitalize">{activeSettingsSection} Settings</h3>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-10">
                      {activeSettingsSection === 'general' && (
                        <div className="max-w-3xl space-y-8">
                          <section className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Container Details</h4>
                            <div className="space-y-2">
                              <label className="text-xs text-zinc-400">Project Name</label>
                              <input 
                                type="text" 
                                value={projectSettings.projectName}
                                onChange={(e) => setProjectSettings({...projectSettings, projectName: e.target.value})}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                          </section>
                          
                          <section className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Environment Variables</h4>
                              <button 
                                onClick={() => setProjectSettings({...projectSettings, envVars: [...projectSettings.envVars, {key: '', value: ''}]})}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                              ><Plus className="w-3 h-3" /> Add Var</button>
                            </div>
                            <div className="space-y-3">
                              {projectSettings.envVars.map((ev, i) => (
                                <div key={i} className="flex gap-3">
                                  <input 
                                    placeholder="KEY" value={ev.key} 
                                    onChange={(e) => {
                                      const newVars = [...projectSettings.envVars];
                                      newVars[i].key = e.target.value;
                                      setProjectSettings({...projectSettings, envVars: newVars});
                                    }}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs font-mono"
                                  />
                                  <input 
                                    placeholder="VALUE" value={ev.value} 
                                    onChange={(e) => {
                                      const newVars = [...projectSettings.envVars];
                                      newVars[i].value = e.target.value;
                                      setProjectSettings({...projectSettings, envVars: newVars});
                                    }}
                                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs font-mono"
                                  />
                                  <button onClick={() => {
                                    const newVars = projectSettings.envVars.filter((_, idx) => idx !== i);
                                    setProjectSettings({...projectSettings, envVars: newVars});
                                  }} className="p-2 text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className="p-6 bg-zinc-800/20 border border-zinc-800 rounded-2xl flex items-center justify-between">
                            <div>
                              <h4 className="font-bold text-white mb-1 flex items-center gap-2"><Globe className="w-4 h-4 text-green-500" /> Public Access</h4>
                              <p className="text-xs text-zinc-500">Allow your web app to be accessible via the assigned public URL.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" checked={projectSettings.publicAccess} onChange={(e) => setProjectSettings({...projectSettings, publicAccess: e.target.checked})} className="sr-only peer" />
                              <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </section>
                        </div>
                      )}

                      {activeSettingsSection === 'security' && (
                        <div className="max-w-3xl space-y-8">
                          <section className="space-y-4">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-zinc-500 flex items-center gap-2"><Key className="w-4 h-4" /> SSH Access Keys</h4>
                            <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-xl space-y-4">
                              {projectSettings.sshKeys.length === 0 ? (
                                <p className="text-xs text-zinc-500 italic text-center py-4">No SSH keys added yet.</p>
                              ) : (
                                projectSettings.sshKeys.map((key) => (
                                  <div key={key.id} className="flex items-center justify-between border-b border-zinc-800 pb-3 last:border-0">
                                    <div className="flex items-center gap-3">
                                      <div className="p-2 bg-zinc-800 rounded-lg text-blue-400"><Lock className="w-4 h-4" /></div>
                                      <div>
                                        <div className="text-sm font-medium text-white">{key.name}</div>
                                        <div className="text-[10px] text-zinc-600 font-mono truncate max-w-xs">{key.key}</div>
                                      </div>
                                    </div>
                                    <button onClick={() => setProjectSettings({...projectSettings, sshKeys: projectSettings.sshKeys.filter(k => k.id !== key.id)})} className="p-2 text-zinc-600 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                                  </div>
                                ))
                              )}
                              <button onClick={() => {
                                const name = prompt("Key name (e.g. My Laptop):");
                                const keyVal = prompt("Paste your public SSH key:");
                                if (name && keyVal) setProjectSettings({...projectSettings, sshKeys: [...projectSettings.sshKeys, {id: Date.now().toString(), name, key: keyVal}]});
                              }} className="w-full py-2 bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-blue-400 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2">
                                <Plus className="w-3 h-3" /> Add SSH Key
                              </button>
                            </div>
                          </section>
                        </div>
                      )}

                      {activeSettingsSection === 'notifications' && (
                        <div className="max-w-2xl space-y-6">
                           {[
                             {id: 'onCrash', label: 'Process Crash', desc: 'Alert me immediately when a bot or script exits unexpectedly.'},
                             {id: 'onLimitReach', label: 'Resource Limits', desc: 'Notify when CPU or Memory usage exceeds 90%.'},
                             {id: 'onDeploy', label: 'Successful Deploy', desc: 'Send a ping when the environment is rebuilt.'}
                           ].map(item => (
                             <div key={item.id} className="flex items-center justify-between p-4 bg-zinc-950/30 border border-zinc-800 rounded-xl">
                               <div>
                                 <h5 className="font-bold text-sm text-zinc-200">{item.label}</h5>
                                 <p className="text-xs text-zinc-500">{item.desc}</p>
                               </div>
                               <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" checked={(projectSettings.notifications as any)[item.id]} onChange={(e) => setProjectSettings({...projectSettings, notifications: {...projectSettings.notifications, [item.id]: e.target.checked}})} className="sr-only peer" />
                                  <div className="w-10 h-5 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                               </label>
                             </div>
                           ))}
                        </div>
                      )}

                      {activeSettingsSection === 'billing' && (
                        <div className="max-w-3xl space-y-8">
                          <div className="p-8 bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-zinc-700 rounded-3xl relative overflow-hidden">
                            <div className="relative z-10 flex items-start justify-between">
                              <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Current Plan</span>
                                <h3 className="text-3xl font-black text-white mt-2">Pro Tier</h3>
                                <p className="text-zinc-400 text-sm mt-1">Unlimited 24/7 Bots • 2GB RAM • Dedicated IP</p>
                              </div>
                              <span className="bg-white/10 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-white border border-white/10">$12 / mo</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex justify-end">
                       <button onClick={() => { setActiveSettingsSection(null); }} className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-900/40"><Save className="w-4 h-4" /> Save Changes</button>
                    </div>
                  </div>
                )}
              </OverlayView>
            ) : activeTab === 'profile' ? (
              <OverlayView title="User Profile" onClose={() => setActiveTab('ide')}>
                <div className="p-8 flex flex-col items-center max-w-2xl mx-auto w-full">
                  <div className="w-32 h-32 rounded-full border-4 border-zinc-800 overflow-hidden shadow-2xl mb-6">
                    <img src="https://picsum.photos/200/200" alt="avatar" className="w-full h-full object-cover" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">{user?.email.split('@')[0]}</h2>
                  <p className="text-zinc-500 font-mono text-sm mb-8">{user?.email}</p>
                  
                  <div className="w-full space-y-4">
                    <div className="p-4 bg-zinc-950/50 rounded-xl border border-zinc-800 flex justify-between items-center">
                      <span className="text-sm font-medium">Account Type</span>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs font-bold rounded uppercase">Pro Tier</span>
                    </div>
                    <button 
                      onClick={handleLogout}
                      className="w-full p-4 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 hover:bg-red-500/20 transition-all font-bold"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </OverlayView>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
};

const OverlayView = ({ title, children, onClose }: any) => (
  <div className="flex-1 flex flex-col bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
    <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-all"><X className="w-5 h-5" /></button>
    </div>
    <div className="flex-1 overflow-hidden bg-zinc-900/50 backdrop-blur-xl">
      {children}
    </div>
  </div>
);

const SettingsCard = ({ icon: Icon, title, description, onClick }: any) => (
  <button onClick={onClick} className="flex items-start gap-4 p-6 bg-zinc-950/30 border border-zinc-800 rounded-2xl hover:bg-zinc-800/40 hover:border-zinc-700 transition-all text-left group">
    <div className="p-3 bg-zinc-800 group-hover:bg-blue-600 transition-colors rounded-xl text-blue-400 group-hover:text-white"><Icon className="w-6 h-6" /></div>
    <div>
      <h3 className="font-bold text-white mb-1">{title}</h3>
      <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
    </div>
  </button>
);

export default App;
