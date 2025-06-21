import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { TestServerManager, waitForPageReady, runBrowserTest } from './test-helpers';

test.describe('Browser Logical Context Hooks', () => {
  let serverManager: TestServerManager;

  test.beforeEach(async ({ page }) => {
    // Start test server for this test (port auto-assigned)
    serverManager = new TestServerManager();
    await serverManager.start();

    // Enable console logging
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error));
    
    // Wait for page to be ready
    await waitForPageReady(page, serverManager.getBaseUrl());
  });

  test.afterEach(async () => {
    // Stop test server after each test
    if (serverManager) {
      await serverManager.stop();
    }
  });

  test('requestAnimationFrame should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'raf-context-value';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Schedule animation frame
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            capturedValue = window.getLogicalContextValue(testKey);
            resolve();
          });
        });
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('requestAnimationFrame test failed:', result.error);
    }
  });

  test('addEventListener should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'event-context-value';
      let capturedValue;

      // Run test in isolated logical context
      window.runOnNewLogicalContext('test', () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create button and add event listener
        const button = document.createElement('button');
        document.body.appendChild(button);

        button.addEventListener('click', () => {
          capturedValue = window.getLogicalContextValue(testKey);
        });

        // Trigger click event
        button.click();

        // Clean up
        document.body.removeChild(button);
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    if (!result.success) {
      console.error('addEventListener test failed:', result.error);
    }
    expect(result.success).toBe(true);
  });

  test('addEventListener with event listener object should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'event-object-context-value';
      let capturedValue;

      // Run test in isolated logical context
      window.runOnNewLogicalContext('test', () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create button and add event listener object
        const button = document.createElement('button');
        document.body.appendChild(button);

        const listenerObject = {
          handleEvent: () => {
            capturedValue = window.getLogicalContextValue(testKey);
          }
        };

        button.addEventListener('click', listenerObject);

        // Trigger click event
        button.click();

        // Clean up
        document.body.removeChild(button);
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    if (!result.success) {
      console.error('addEventListener with object test failed:', result.error);
    }
    expect(result.success).toBe(true);
  });

  test('XMLHttpRequest should maintain logical context in event handlers', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'xhr-context-value';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create XMLHttpRequest
        const xhr = new XMLHttpRequest();

        await new Promise((resolve, reject) => {
          xhr.onreadystatechange = function() {
            if (this.readyState === 4) {
              capturedValue = window.getLogicalContextValue(testKey);
              if (this.status === 200) {
                resolve();
              } else {
                reject(new Error('XHR failed'));
              }
            }
          };

          xhr.open('GET', '/api/test');
          xhr.send();
        });
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('XMLHttpRequest test failed:', result.error);
    }
  });

  test('XMLHttpRequest with addEventListener should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'xhr-listener-context-value';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Create XMLHttpRequest
        const xhr = new XMLHttpRequest();

        await new Promise((resolve, reject) => {
          xhr.addEventListener('load', () => {
            capturedValue = window.getLogicalContextValue(testKey);
            resolve();
          });

          xhr.addEventListener('error', () => {
            reject(new Error('XHR error'));
          });

          xhr.open('GET', '/api/test');
          xhr.send();
        });
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('XMLHttpRequest addEventListener test failed:', result.error);
    }
  });

  test('fetch should maintain logical context via Promise hooks', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'fetch-context-value';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Use fetch with promise handlers
        await fetch('/api/test')
          .then(response => {
            capturedValue = window.getLogicalContextValue(testKey);
            return response.json();
          });
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('fetch test failed:', result.error);
    }
  });

  test('fetch error handling should maintain logical context', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'fetch-error-context-value';
      let capturedValue;

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Use fetch with error handler
        try {
          await fetch('/api/error')
            .then(response => {
              if (!response.ok) {
                throw new Error('HTTP error');
              }
              return response.json();
            })
            .catch(error => {
              capturedValue = window.getLogicalContextValue(testKey);
              throw error;
            });
        } catch (error) {
          // Expected to throw
        }
      });

      // Change context in root context (should not affect captured value)
      window.setLogicalContextValue(testKey, 'changed-value');

      if (capturedValue !== testValue) {
        throw new Error(\`Expected '\${testValue}', got '\${capturedValue}'\`);
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('fetch error test failed:', result.error);
    }
  });

  test('complex integration: multiple async operations should maintain context', async ({ page }) => {
    const result = await runBrowserTest(page, `
      const testKey = window.createTestKey();
      const testValue = 'integration-context-value';
      const results = [];

      // Run test in isolated logical context
      await window.runOnNewLogicalContext('test', async () => {
        // Set context value in this isolated context
        window.setLogicalContextValue(testKey, testValue);

        // Chain multiple async operations
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            results.push(window.getLogicalContextValue(testKey));
            
            setTimeout(() => {
              results.push(window.getLogicalContextValue(testKey));
              
              fetch('/api/test')
                .then(response => {
                  results.push(window.getLogicalContextValue(testKey));
                  return response.json();
                })
                .then(data => {
                  results.push(window.getLogicalContextValue(testKey));
                  resolve();
                });
            }, 10);
          });
        });
      });

      // Change context in root context (should not affect captured values)
      window.setLogicalContextValue(testKey, 'different-value');

      // All results should have the original value
      const expectedResults = [testValue, testValue, testValue, testValue];
      if (JSON.stringify(results) !== JSON.stringify(expectedResults)) {
        throw new Error(\`Expected \${JSON.stringify(expectedResults)}, got \${JSON.stringify(results)}\`);
      }
    `);

    expect(result.success).toBe(true);
    if (!result.success) {
      console.error('complex integration test failed:', result.error);
    }
  });
}); 