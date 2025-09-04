import { spawn, ChildProcess } from 'child_process';
import { Page } from '@playwright/test';
import path from 'path';

export interface TestServerConfig {
  port: number;
  timeout?: number;
}

export class TestServerManager {
  private serverProcess: ChildProcess | null = null;
  private config: TestServerConfig;
  private static portCounter = 3001;

  constructor(config?: Partial<TestServerConfig>) {
    this.config = {
      port: TestServerManager.portCounter++,
      timeout: 10000,
      ...config,
    };
  }

  async start(): Promise<void> {
    if (this.serverProcess) {
      throw new Error('Test server is already running');
    }

    const serverPath = path.join(__dirname, 'test-server.js');

    return new Promise((resolve, reject) => {
      // Set the port via environment variable
      const env = { ...process.env, PORT: this.config.port.toString() };

      this.serverProcess = spawn('node', [serverPath], {
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let serverReady = false;
      const timeout = setTimeout(() => {
        if (!serverReady) {
          this.stop();
          reject(
            new Error(
              `Test server failed to start within ${this.config.timeout}ms`
            )
          );
        }
      }, this.config.timeout);

      this.serverProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        if (
          output.includes(`Test server running on port ${this.config.port}`)
        ) {
          serverReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      this.serverProcess.stderr?.on('data', (data) => {
        console.error('Test server error:', data.toString());
      });

      this.serverProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start test server: ${error.message}`));
      });

      this.serverProcess.on('exit', (code) => {
        if (!serverReady) {
          clearTimeout(timeout);
          reject(new Error(`Test server exited with code ${code}`));
        }
      });
    });
  }

  async stop(): Promise<void> {
    if (!this.serverProcess) {
      return;
    }

    return new Promise((resolve) => {
      const process = this.serverProcess!;
      this.serverProcess = null;

      process.on('exit', () => {
        resolve();
      });

      // Try graceful shutdown first
      process.kill('SIGTERM');

      // Force kill after 2 seconds if not stopped
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 2000);
    });
  }

  getBaseUrl(): string {
    return `http://localhost:${this.config.port}`;
  }
}

// Helper to wait for page to be ready
export async function waitForPageReady(page: Page, baseUrl: string) {
  await page.goto(`${baseUrl}/test.html`);

  try {
    await page.waitForFunction(
      () => {
        return (
          (window as any).setLogicalContextValue &&
          (window as any).getLogicalContextValue &&
          (window as any).getCurrentLogicalContextId &&
          (window as any).runOnNewLogicalContext
        );
      },
      { timeout: 10000 }
    );
  } catch (error) {
    const pageContent = await page.content();
    console.log('Page content length:', pageContent.length);

    // Check if library loaded
    const libraryLoaded = await page.evaluate(
      'typeof window.setLogicalContextValue'
    );
    console.log('Library loaded:', libraryLoaded);

    throw error;
  }
}

// Helper to run test in browser context
export async function runBrowserTest(
  page: Page,
  testFn: string
): Promise<{ success: boolean; error?: string }> {
  const result = (await page.evaluate(`
    (async () => {
      try {
        ${testFn}
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    })()
  `)) as { success: boolean; error?: string };
  return result;
}
