import { Task } from 'tinybench';
import { SystemInfo } from './system-info.js';

export interface BenchmarkResult {
  name: string;
  opsPerSec: number;
  avgTime: number;
  medianTime: number;
  totalTime: number;
  stdDev: number;
}

export function formatResults(tasks: Task[], systemInfo: SystemInfo, outputFormat: 'markdown' | 'json' = 'markdown'): string {
  const results: BenchmarkResult[] = tasks.map(task => ({
    name: task.name,
    opsPerSec: Math.round(task.result?.hz || 0),
    avgTime: parseFloat(((task.result?.mean || 0) * 1000).toFixed(3)),
    medianTime: parseFloat(((task.result?.latency?.p50 || 0) * 1000).toFixed(3)),
    totalTime: parseFloat(((task.result?.totalTime || 0)).toFixed(2)),
    stdDev: parseFloat(((task.result?.sd || 0) * 1000).toFixed(3))
  }));

  if (outputFormat === 'json') {
    return JSON.stringify({
      results,
      systemInfo,
      generatedAt: new Date().toISOString()
    }, null, 2);
  }

  const tableRows = results.map(result => 
    `| ${result.name} | ${result.opsPerSec.toLocaleString()} | ${result.avgTime} | ${result.medianTime} | ${result.stdDev} | ${result.totalTime} |`
  ).join('\n');

  return `| Benchmark | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
|-----------|----------------|---------------|------------------|--------------|-----------------|
${tableRows}

**Test Environment:** Node.js ${systemInfo.nodeVersion}, ${systemInfo.platform}  
**CPU:** ${systemInfo.cpu}  
**Memory:** ${systemInfo.memory}  
**Last Updated:** ${systemInfo.timestamp}`;
} 