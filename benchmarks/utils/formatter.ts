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

const toFiniteNumber = (value: number | undefined): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const roundMetric = (value: number | undefined, fractionDigits: number) => {
  return parseFloat(toFiniteNumber(value).toFixed(fractionDigits));
};

const getOpsPerSec = (task: Task): number => {
  return toFiniteNumber(task.result?.throughput?.mean ?? task.result?.hz);
};

const getAvgTime = (task: Task): number => {
  // tinybench 6 moved the latency aggregate metrics under result.latency.
  return toFiniteNumber(task.result?.latency?.mean ?? task.result?.mean);
};

const getMedianTime = (task: Task): number => {
  return toFiniteNumber(
    task.result?.latency?.p50 ?? task.result?.latency?.mean ?? task.result?.mean
  );
};

const getStdDev = (task: Task): number => {
  return toFiniteNumber(task.result?.latency?.sd ?? task.result?.sd);
};

export const formatResults = (
  tasks: Task[],
  systemInfo: SystemInfo,
  outputFormat: 'markdown' | 'json' = 'markdown'
): string => {
  const results: BenchmarkResult[] = tasks.map((task) => ({
    name: task.name,
    opsPerSec: Math.round(getOpsPerSec(task)),
    avgTime: roundMetric(getAvgTime(task), 3),
    medianTime: roundMetric(getMedianTime(task), 3),
    totalTime: roundMetric(task.result?.totalTime, 2),
    stdDev: roundMetric(getStdDev(task), 3),
  }));

  if (outputFormat === 'json') {
    return JSON.stringify(
      {
        results,
        systemInfo,
        generatedAt: new Date().toISOString(),
      },
      null,
      2
    );
  }

  const tableRows = results
    .map(
      (result) =>
        `| ${result.name} | ${result.opsPerSec.toLocaleString()} | ${result.avgTime} | ${result.medianTime} | ${result.stdDev} | ${result.totalTime} |`
    )
    .join('\n');

  return `| Benchmark | Operations/sec | Avg Time (ms) | Median Time (ms) | Std Dev (ms) | Total Time (ms) |
|-----------|----------------|---------------|------------------|--------------|-----------------|
${tableRows}

**Test Environment:** Node.js ${systemInfo.nodeVersion}, ${systemInfo.platform}  
**CPU:** ${systemInfo.cpu}  
**Memory:** ${systemInfo.memory}  
**Last Updated:** ${systemInfo.timestamp}`;
};
