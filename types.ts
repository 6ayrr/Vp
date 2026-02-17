
export interface ProjectFile {
  id: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: ProjectFile[];
  path: string;
}

export interface UserProcess {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'errored' | 'starting';
  cpu: number;
  memory: number;
  uptime: string;
  command: string;
}

export interface ContainerStats {
  cpuUsage: number;
  memoryUsage: number;
  memoryLimit: number;
  diskUsage: number;
  diskLimit: number;
}
