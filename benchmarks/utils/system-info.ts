import { cpus, totalmem, platform, arch } from 'os';

export interface SystemInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  cpu: string;
  memory: string;
  timestamp: string;
}

export function getSystemInfo(): SystemInfo {
  const cpuInfo = cpus();
  const cpu = cpuInfo.length > 0 ? cpuInfo[0].model : 'Unknown';
  const memoryGB = Math.round(totalmem() / 1024 ** 3);

  return {
    nodeVersion: process.version,
    platform: `${platform()} ${arch()}`,
    arch: arch(),
    cpu,
    memory: `${memoryGB}GB`,
    timestamp: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
  };
}
