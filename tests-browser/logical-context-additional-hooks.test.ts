import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  TestServerManager,
  waitForPageReady,
  runBrowserTest,
} from './test-helpers';

test.describe('Browser Additional Hooks - LogicalContext', () => {
  let serverManager: TestServerManager;

  test.beforeEach(async ({ page }) => {
    // Start test server for this test (port auto-assigned)
    serverManager = new TestServerManager();
    await serverManager.start();

    // Enable console logging
    page.on('console', (msg) => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', (error) => console.log('PAGE ERROR:', error));

    // Wait for page to be ready
    await waitForPageReady(page, serverManager.getBaseUrl());
  });

  test.afterEach(async () => {
    // Stop test server after each test
    if (serverManager) {
      await serverManager.stop();
    }
  });

  test('MutationObserver should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'mutation-observer-context';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create a target element
        const targetDiv = document.createElement('div');
        targetDiv.id = 'mutation-target';
        document.body.appendChild(targetDiv);

        // Create MutationObserver
        await new Promise(resolve => {
          const observer = new MutationObserver((mutations) => {
            capturedValue = window.getLogicalContextValue(testKey);
            observer.disconnect();
            resolve();
          });

          observer.observe(targetDiv, { 
            attributes: true, 
            childList: true, 
            subtree: true 
          });

          // Trigger mutation
          targetDiv.setAttribute('data-test', 'changed');
        });

        // Clean up
        document.body.removeChild(targetDiv);
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('MutationObserver test failed:', result.error);
    }
  });

  test('ResizeObserver should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'resize-observer-context';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create a target element
        const targetDiv = document.createElement('div');
        targetDiv.style.width = '100px';
        targetDiv.style.height = '100px';
        targetDiv.style.backgroundColor = 'red';
        document.body.appendChild(targetDiv);

        // Create ResizeObserver
        await new Promise(resolve => {
          const observer = new ResizeObserver((entries) => {
            capturedValue = window.getLogicalContextValue(testKey);
            observer.disconnect();
            resolve();
          });

          observer.observe(targetDiv);

          // Trigger resize after a small delay to ensure observer is active
          setTimeout(() => {
            targetDiv.style.width = '200px';
          }, 10);
        });

        // Clean up
        document.body.removeChild(targetDiv);
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('ResizeObserver test failed:', result.error);
    }
  });

  test('IntersectionObserver should maintain logical context', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'intersection-observer-context';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create a target element
        const targetDiv = document.createElement('div');
        targetDiv.style.width = '100px';
        targetDiv.style.height = '100px';
        targetDiv.style.backgroundColor = 'blue';
        targetDiv.style.position = 'absolute';
        targetDiv.style.top = '2000px'; // Initially out of viewport
        document.body.appendChild(targetDiv);

        // Create IntersectionObserver
        await new Promise(resolve => {
          const observer = new IntersectionObserver((entries) => {
            capturedValue = window.getLogicalContextValue(testKey);
            observer.disconnect();
            resolve();
          }, {
            threshold: 0.1
          });

          observer.observe(targetDiv);

          // Move element into viewport to trigger intersection
          setTimeout(() => {
            targetDiv.style.top = '0px';
          }, 10);
        });

        // Clean up
        document.body.removeChild(targetDiv);
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('IntersectionObserver test failed:', result.error);
    }
  });

  test('WebSocket should maintain logical context in event handlers', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'websocket-context';
      let capturedOpenValue;
      let capturedMessageValue;
      let capturedErrorValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create WebSocket (use a test echo server or mock)
        const ws = new WebSocket('wss://echo.websocket.org/');

        await new Promise((resolve, reject) => {
          let openHandled = false;
          let messageHandled = false;

          const checkComplete = () => {
            if (openHandled && messageHandled) {
              ws.close();
              resolve();
            }
          };

          ws.onopen = () => {
            capturedOpenValue = window.getLogicalContextValue(testKey);
            openHandled = true;
            // Send a test message
            ws.send('test message');
          };

          ws.onmessage = (event) => {
            capturedMessageValue = window.getLogicalContextValue(testKey);
            messageHandled = true;
            checkComplete();
          };

          ws.onerror = (error) => {
            capturedErrorValue = window.getLogicalContextValue(testKey);
            reject(error);
          };

          // Timeout after 5 seconds
          setTimeout(() => {
            if (!openHandled || !messageHandled) {
              ws.close();
              reject(new Error('WebSocket test timeout'));
            }
          }, 5000);
        });
      });

      // Change context in root context (should not affect captured values)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedOpenValue !== testValue) {
        throw new Error(\`onopen: Expected '\${testValue}', got '\${capturedOpenValue}'\`);
      }
      if (capturedMessageValue !== testValue) {
        throw new Error(\`onmessage: Expected '\${testValue}', got '\${capturedMessageValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('WebSocket test failed:', result.error);
    }
  });

  test('Worker should maintain logical context in message handlers', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'worker-context';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create a simple worker script as a blob
        const workerScript = \`
          self.onmessage = function(e) {
            // Echo the message back
            self.postMessage('Echo: ' + e.data);
          };
        \`;

        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);

        const worker = new Worker(workerUrl);

        await new Promise((resolve, reject) => {
          worker.onmessage = (event) => {
            capturedValue = window.getLogicalContextValue(testKey);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            resolve();
          };

          worker.onerror = (error) => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(error);
          };

          // Send a test message
          worker.postMessage('test message');

          // Timeout after 3 seconds
          setTimeout(() => {
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
            reject(new Error('Worker test timeout'));
          }, 3000);
        });
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Worker test failed:', result.error);
    }
  });

  test('MessageChannel should maintain logical context in port handlers', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'message-channel-context';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create MessageChannel
        const channel = new MessageChannel();

        await new Promise((resolve, reject) => {
          channel.port1.onmessage = (event) => {
            capturedValue = window.getLogicalContextValue(testKey);
            resolve();
          };

          // Start the port
          channel.port1.start();
          channel.port2.start();

          // Send message from port2 to port1
          channel.port2.postMessage('test message');

          // Timeout after 1 second
          setTimeout(() => {
            reject(new Error('MessageChannel test timeout'));
          }, 1000);
        });

        // Close the ports
        channel.port1.close();
        channel.port2.close();
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('MessageChannel test failed:', result.error);
    }
  });

  test('MessageChannel with addEventListener should maintain logical context', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'message-channel-listener-context';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create MessageChannel
        const channel = new MessageChannel();

        await new Promise((resolve, reject) => {
          channel.port1.addEventListener('message', (event) => {
            capturedValue = window.getLogicalContextValue(testKey);
            resolve();
          });

          // Start the port
          channel.port1.start();
          channel.port2.start();

          // Send message from port2 to port1
          channel.port2.postMessage('test message with addEventListener');

          // Timeout after 1 second
          setTimeout(() => {
            reject(new Error('MessageChannel addEventListener test timeout'));
          }, 1000);
        });

        // Close the ports
        channel.port1.close();
        channel.port2.close();
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error(
        'MessageChannel addEventListener test failed:',
        result.error
      );
    }
  });

  test('Context isolation across different Observer instances', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const value1 = 'observer-context-1';
      const value2 = 'observer-context-2';
      let capturedValue1;
      let capturedValue2;

      // Create target elements
      const targetDiv1 = document.createElement('div');
      const targetDiv2 = document.createElement('div');
      targetDiv1.id = 'target1';
      targetDiv2.id = 'target2';
      document.body.appendChild(targetDiv1);
      document.body.appendChild(targetDiv2);

      // Run first observer in isolated context 1
      await window.runOnNewLogicalContext('test1', async () => {
        window.setLogicalContextValue(testKey, value1);

        await new Promise(resolve => {
          const observer1 = new MutationObserver((mutations) => {
            capturedValue1 = window.getLogicalContextValue(testKey);
            observer1.disconnect();
            resolve();
          });

          observer1.observe(targetDiv1, { attributes: true });
          targetDiv1.setAttribute('data-test1', 'changed');
        });
      });

      // Run second observer in isolated context 2
      await window.runOnNewLogicalContext('test2', async () => {
        window.setLogicalContextValue(testKey, value2);

        await new Promise(resolve => {
          const observer2 = new MutationObserver((mutations) => {
            capturedValue2 = window.getLogicalContextValue(testKey);
            observer2.disconnect();
            resolve();
          });

          observer2.observe(targetDiv2, { attributes: true });
          targetDiv2.setAttribute('data-test2', 'changed');
        });
      });

      // Clean up
      document.body.removeChild(targetDiv1);
      document.body.removeChild(targetDiv2);

      if (capturedValue1 !== value1) {
        throw new Error(\`Observer1: Expected '\${value1}', got '\${capturedValue1}'\`);
      }
      if (capturedValue2 !== value2) {
        throw new Error(\`Observer2: Expected '\${value2}', got '\${capturedValue2}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Context isolation test failed:', result.error);
    }
  });

  test('Integration: setTimeout + MutationObserver should maintain context', async ({
    page,
  }) => {
    const result = await runBrowserTest(
      page,
      `
      const testKey = window.createTestKey();
      const testValue = 'integration-context';
      let capturedValue1;
      let capturedValue2;

      // Test setTimeout in isolation first
      await window.runOnNewLogicalContext('timeout-test', async () => {
        window.setLogicalContextValue(testKey, testValue);
        
        await new Promise(resolve => {
          setTimeout(() => {
            capturedValue1 = window.getLogicalContextValue(testKey);
            resolve();
          }, 50);
        });
      });

      // Test MutationObserver in isolation
      await window.runOnNewLogicalContext('mutation-test', async () => {
        window.setLogicalContextValue(testKey, testValue);
        
        const targetDiv = document.createElement('div');
        document.body.appendChild(targetDiv);

        await new Promise(resolve => {
          const observer = new MutationObserver((mutations) => {
            capturedValue2 = window.getLogicalContextValue(testKey);
            observer.disconnect();
            resolve();
          });

          observer.observe(targetDiv, { attributes: true });
          
          setTimeout(() => {
            targetDiv.setAttribute('data-test', 'changed');
          }, 10);
        });

        document.body.removeChild(targetDiv);
      });

      if (capturedValue1 !== testValue) {
        throw new Error(\`setTimeout: Expected '\${testValue}', got '\${capturedValue1}'\`);
      }
      if (capturedValue2 !== testValue) {
        throw new Error(\`MutationObserver: Expected '\${testValue}', got '\${capturedValue2}'\`);
      }
    `
    );

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('Integration test failed:', result.error);
    }
  });
});
