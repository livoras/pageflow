import { SimplePageClient } from './client/SimplePageClient';
import * as fs from 'fs';
import * as path from 'path';

// Import Action interface from SimplePage
interface Action {
  type: 'create' | 'act' | 'close' | 'navigate' | 'navigateBack' | 'navigateForward' | 'reload' | 'wait' | 'condition';
  url?: string;
  method?: string;
  xpath?: string;
  encodedId?: string;
  args?: string[];
  description?: string;
  timestamp: number;
  timeout?: number;
  structure?: string;
  xpathMap?: string;
  screenshot?: string;
  pattern?: string;
  flags?: string;
  matched?: boolean;
}

export interface ReplayOptions {
  serverUrl?: string;
  delay?: number; // Delay between actions in milliseconds
  verbose?: boolean; // Log each action
  continueOnError?: boolean; // Continue replay even if an action fails
}

export interface ReplayResult {
  success: boolean;
  executedActions: number;
  errors: Array<{
    action: Action;
    error: string;
  }>;
  pageId?: string;
}

// Helper function to sleep
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function replay(actions: Action[], options: ReplayOptions = {}): Promise<ReplayResult> {
  const client = new SimplePageClient(options.serverUrl || 'http://localhost:3100');
  const result: ReplayResult = {
    success: true,
    executedActions: 0,
    errors: []
  };
  
  let pageId: string | null = null;
  
  if (options.verbose) {
    console.log(`🎬 Starting replay of ${actions.length} actions...`);
  }

  for (const action of actions) {
    try {
      if (options.verbose) {
        console.log(`▶️  Executing ${action.type}: ${action.description || ''}`);
      }

      switch (action.type) {
        case 'create': {
          // Create a new page
          const page = await client.createPage(
            action.description || 'Replay page',
            action.url || 'about:blank',
            { timeout: action.timeout, recordActions: false }
          );
          pageId = page.id;
          result.pageId = pageId;
          break;
        }

        case 'navigate': {
          if (!pageId) throw new Error('No page created yet');
          await client.navigate(pageId, action.url!, {
            timeout: action.timeout,
            description: action.description
          });
          break;
        }

        case 'navigateBack': {
          if (!pageId) throw new Error('No page created yet');
          // Note: SimplePageClient doesn't have navigateBack yet
          // You might need to extend it or use a different approach
          console.warn('navigateBack not implemented in SimplePageClient');
          break;
        }

        case 'navigateForward': {
          if (!pageId) throw new Error('No page created yet');
          // Note: SimplePageClient doesn't have navigateForward yet
          console.warn('navigateForward not implemented in SimplePageClient');
          break;
        }

        case 'reload': {
          if (!pageId) throw new Error('No page created yet');
          // Note: SimplePageClient doesn't have reload yet
          console.warn('reload not implemented in SimplePageClient');
          break;
        }

        case 'act': {
          if (!pageId) throw new Error('No page created yet');
          
          // Determine whether to use xpath or encodedId
          if (action.xpath) {
            await client.actByXPath(
              pageId,
              action.xpath,
              action.method!,
              action.args || [],
              action.description
            );
          } else if (action.encodedId) {
            await client.actById(
              pageId,
              action.encodedId,
              action.method!,
              action.args || [],
              action.description
            );
          } else {
            throw new Error('Action missing xpath or encodedId');
          }
          break;
        }

        case 'wait': {
          if (!pageId) throw new Error('No page created yet');
          
          if (action.timeout) {
            await client.wait(pageId, action.timeout, action.description);
          }
          break;
        }

        case 'condition': {
          if (!pageId) throw new Error('No page created yet');
          
          if (action.pattern) {
            const result = await client.checkCondition(
              pageId,
              action.pattern,
              action.flags,
              action.description
            );
            if (options.verbose) {
              console.log(`   Condition matched: ${result.matched}`);
            }
          }
          break;
        }

        case 'close': {
          if (pageId) {
            await client.closePage(pageId);
            pageId = null;
          }
          break;
        }

        default:
          console.warn(`Unknown action type: ${action.type}`);
      }

      result.executedActions++;

      // Add optional delay between actions
      if (options.delay && action.type !== 'wait') {
        await sleep(options.delay);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      result.errors.push({
        action,
        error: errorMessage
      });
      
      if (options.verbose) {
        console.error(`❌ Failed to execute ${action.type}: ${errorMessage}`);
      }
      
      if (!options.continueOnError) {
        result.success = false;
        break;
      }
    }
  }

  // Clean up: close the page if still open
  if (pageId) {
    try {
      await client.closePage(pageId);
    } catch (error) {
      // Ignore errors during cleanup
    }
  }

  if (options.verbose) {
    console.log(`\n🏁 Replay completed:`);
    console.log(`   Actions executed: ${result.executedActions}/${actions.length}`);
    console.log(`   Errors: ${result.errors.length}`);
    console.log(`   Success: ${result.success && result.errors.length === 0}`);
  }

  return result;
}

// Utility function to replay from a JSON file
export async function replayFromFile(
  filePath: string, 
  options: ReplayOptions = {}
): Promise<ReplayResult> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  // Handle both full actions.json format and plain action arrays
  const actions = data.actions || data;
  
  if (!Array.isArray(actions)) {
    throw new Error('Invalid file format: expected actions array');
  }
  
  return replay(actions, options);
}

// Utility function to replay specific actions by indices
export async function replayPartial(
  actions: Action[],
  indices: number[],
  options: ReplayOptions = {}
): Promise<ReplayResult> {
  const selectedActions = indices.map(i => actions[i]).filter(Boolean);
  return replay(selectedActions, options);
}

// Example usage:
// const result = await replayFromFile('/tmp/simplepage/abc123/actions.json', {
//   verbose: true,
//   delay: 1000,
//   continueOnError: true
// });