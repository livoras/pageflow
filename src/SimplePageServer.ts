import express from 'express';
import type { Request, Response } from 'express';
import * as playwright from 'playwright';
import { v4 as uuid } from 'uuid';
import type { Server } from 'http';
import * as path from 'path';
import * as os from 'os';
import { SimplePage } from './SimplePage';
import { browserDOMHighlighterScript } from './utils/browser-dom-highlighter';
import * as fs from 'fs';
import { WebSocketServer } from 'ws';
import type { WebSocket } from 'ws';

interface PageInfo {
  id: string;
  name: string;
  description?: string;
  page: playwright.Page;
  simplePage: SimplePage;
  createdAt: Date;
  cachedXPathMap?: Record<string, string>;
}

export class SimplePageServer {
  private app: express.Application;
  private httpServer: Server | null = null;
  private browser: playwright.Browser | null = null;
  private persistentContext: playwright.BrowserContext | null = null;
  private pages = new Map<string, PageInfo>();
  private userDataDir: string;
  private headless: boolean;
  private wss: WebSocketServer | null = null;
  private wsClients = new Set<WebSocket>();

  constructor(private port: number = parseInt(process.env.PORT || '3100')) {
    this.headless = process.env.HEADLESS === 'true';
    this.userDataDir = process.env.USER_DATA_DIR || 
      path.join(os.homedir(), '.simple-page-server', 'user-data');
    
    this.app = express();
    this.app.use(express.json());
    
    // Enable CORS for viewer on port 3102
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', 'http://localhost:3102');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }
      next();
    });
    
    this.registerRoutes();
  }


  private registerRoutes() {
    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ 
        status: 'ok', 
        pages: this.pages.size,
        browserConnected: this.persistentContext !== null 
      });
    });

    // List all pages
    this.app.get('/api/pages', (req: Request, res: Response) => {
      const pages = Array.from(this.pages.values()).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        url: p.page.url(),
        createdAt: p.createdAt,
        consoleLogPath: p.simplePage.getConsoleLogPath()
      }));
      res.json(pages);
    });

    // Create new page
    this.app.post('/api/pages', async (req: Request, res: Response) => {
      try {
        const { name, description, url, timeout = 10000 } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Page name is required' });
        }

        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        if (description) {
          console.log(`[CreatePage] ${description}`);
        }

        const pageId = await this.createPage(name, description, url, timeout);
        const pageInfo = this.pages.get(pageId)!;
        
        res.json({
          id: pageInfo.id,
          name: pageInfo.name,
          description: pageInfo.description,
          url: pageInfo.page.url(),
          createdAt: pageInfo.createdAt,
          consoleLogPath: pageInfo.simplePage.getConsoleLogPath()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Close page
    this.app.delete('/api/pages/:pageId', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        await this.closePage(pageId);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Navigate page
    this.app.post('/api/pages/:pageId/navigate', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { url, timeout = 3000, description } = req.body;
        
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        if (description) {
          console.log(`[Navigate] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.navigate(url, timeout, description);
        
        res.json({ 
          success: true,
          url: pageInfo.page.url()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Navigate back
    this.app.post('/api/pages/:pageId/navigate-back', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { description } = req.body;

        if (description) {
          console.log(`[NavigateBack] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.navigateBack(description);
        
        res.json({ 
          success: true,
          url: pageInfo.page.url()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Navigate forward
    this.app.post('/api/pages/:pageId/navigate-forward', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { description } = req.body;

        if (description) {
          console.log(`[NavigateForward] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.navigateForward(description);
        
        res.json({ 
          success: true,
          url: pageInfo.page.url()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Reload page
    this.app.post('/api/pages/:pageId/reload', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { timeout = 3000, description } = req.body;

        if (description) {
          console.log(`[Reload] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.reload(timeout, description);
        
        res.json({ 
          success: true,
          url: pageInfo.page.url()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get page structure (simplified only)
    this.app.get('/api/pages/:pageId/structure', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { selector } = req.query;
        
        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        const structure = await pageInfo.simplePage.getPageStructure(selector as string | undefined);
        
        // Cache the xpathMap for later use
        pageInfo.cachedXPathMap = structure.xpathMap;
        
        // Return simplified content, htmlPath and actionsPath
        res.json({ 
          structure: structure.simplified,
          htmlPath: structure.htmlPath,
          actionsPath: pageInfo.simplePage.getActionsPath(),
          consoleLogPath: pageInfo.simplePage.getConsoleLogPath()
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Act by XPath
    this.app.post('/api/pages/:pageId/act-xpath', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { xpath, method, args = [], description } = req.body;
        
        if (!xpath || !method) {
          return res.status(400).json({ error: 'xpath and method are required' });
        }

        if (description) {
          console.log(`[ActByXPath] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.actByXPath(xpath, method, args, description);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Act by EncodedId
    this.app.post('/api/pages/:pageId/act-id', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { encodedId, method, args = [], description } = req.body;
        
        if (!encodedId || !method) {
          return res.status(400).json({ error: 'encodedId and method are required' });
        }

        if (description) {
          console.log(`[ActByEncodedId] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.actByEncodedId(encodedId, method, args, description);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Wait for timeout
    this.app.post('/api/pages/:pageId/wait', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { timeout, description } = req.body;
        
        if (!timeout || typeof timeout !== 'number') {
          return res.status(400).json({ error: 'Timeout (number) is required' });
        }

        if (description) {
          console.log(`[Wait] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.simplePage.waitForTimeout(timeout, description);
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Check condition
    this.app.post('/api/pages/:pageId/condition', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { pattern, flags, description } = req.body;
        
        if (!pattern) {
          return res.status(400).json({ error: 'Pattern is required' });
        }

        if (description) {
          console.log(`[Condition] ${description}`);
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        // Create regex from pattern and optional flags
        const regexPattern = flags ? new RegExp(pattern, flags) : new RegExp(pattern);
        const matched = await pageInfo.simplePage.checkCondition(regexPattern, description);
        
        res.json({ matched });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Take screenshot
    this.app.get('/api/pages/:pageId/screenshot', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        
        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        const screenshot = await pageInfo.page.screenshot();
        res.set('Content-Type', 'image/png');
        res.send(screenshot);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get page info
    this.app.get('/api/pages/:pageId', (req: Request, res: Response) => {
      const { pageId } = req.params;
      const pageInfo = this.pages.get(pageId);
      
      if (!pageInfo) {
        return res.status(404).json({ error: 'Page not found' });
      }

      res.json({
        id: pageInfo.id,
        name: pageInfo.name,
        description: pageInfo.description,
        url: pageInfo.page.url(),
        title: pageInfo.page.title(),
        createdAt: pageInfo.createdAt,
        consoleLogPath: pageInfo.simplePage.getConsoleLogPath()
      });
    });

    // Get XPath by EncodedId
    this.app.get('/api/pages/:pageId/xpath/:encodedId', (req: Request, res: Response) => {
      const { pageId, encodedId } = req.params;
      const pageInfo = this.pages.get(pageId);
      
      if (!pageInfo) {
        return res.status(404).json({ error: 'Page not found' });
      }

      if (!pageInfo.cachedXPathMap) {
        return res.status(400).json({ error: 'XPath map not cached. Call /structure first' });
      }

      const xpath = pageInfo.cachedXPathMap[encodedId];
      if (!xpath) {
        return res.status(404).json({ error: 'EncodedId not found in XPath map' });
      }

      res.json({ xpath });
    });

    // Highlight single element
    this.app.post('/api/pages/:pageId/highlight', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { xpath, color, label } = req.body;
        
        if (!xpath) {
          return res.status(400).json({ error: 'xpath is required' });
        }
        
        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        // Inject highlighter script if not already injected
        await pageInfo.page.evaluate(browserDOMHighlighterScript);
        
        // Execute highlighting
        const result = await pageInfo.page.evaluate(`
          (() => {
            const element = window.highlight(${JSON.stringify(xpath)}, ${JSON.stringify(color)}, ${JSON.stringify(label)});
            return { success: element !== null };
          })()
        `);
        
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Remove highlight from element
    this.app.post('/api/pages/:pageId/unhighlight', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        const { xpath } = req.body;
        
        if (!xpath) {
          return res.status(400).json({ error: 'xpath is required' });
        }
        
        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        const result = await pageInfo.page.evaluate(`
          (() => {
            if (window.unhighlight) {
              return { success: window.unhighlight(${JSON.stringify(xpath)}) };
            }
            return { success: false, error: 'Highlighter not initialized' };
          })()
        `);
        
        res.json(result);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Clear all highlights
    this.app.post('/api/pages/:pageId/clear-highlights', async (req: Request, res: Response) => {
      try {
        const { pageId } = req.params;
        
        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.page.evaluate(() => {
          if ((window as any).clearAllHighlights) {
            (window as any).clearAllHighlights();
          }
        });
        
        res.json({ success: true });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get all recordings
    this.app.get('/api/recordings', async (_req: Request, res: Response) => {
      try {
        const recordingsBaseDir = os.tmpdir();
        const simplepageDir = path.join(recordingsBaseDir, 'simplepage');
        
        if (!fs.existsSync(simplepageDir)) {
          return res.json([]);
        }

        const recordings = [];
        const dirs = fs.readdirSync(simplepageDir);
        
        for (const dir of dirs) {
          const recordingPath = path.join(simplepageDir, dir);
          const actionsPath = path.join(recordingPath, 'actions.json');
          
          if (fs.existsSync(actionsPath)) {
            try {
              const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
              const actionsData = JSON.parse(actionsContent);
              
              // Get directory creation time as fallback
              const stats = fs.statSync(recordingPath);
              
              recordings.push({
                id: actionsData.id || dir,
                description: actionsData.description || 'Unknown',
                actionsCount: actionsData.actions ? actionsData.actions.length : 0,
                lastAction: actionsData.actions && actionsData.actions.length > 0 
                  ? actionsData.actions[actionsData.actions.length - 1].type 
                  : null,
                createdAt: actionsData.actions && actionsData.actions.length > 0
                  ? new Date(actionsData.actions[0].timestamp).toISOString()
                  : stats.birthtime.toISOString()
              });
            } catch (e) {
              console.error(`Error reading actions.json for ${dir}:`, e);
            }
          }
        }

        // Sort by creation time, newest first
        recordings.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        res.json(recordings);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Get specific recording
    this.app.get('/api/recordings/:recordingId', async (req: Request, res: Response) => {
      try {
        const { recordingId } = req.params;
        const recordingsBaseDir = os.tmpdir();
        const recordingPath = path.join(recordingsBaseDir, 'simplepage', recordingId);
        const actionsPath = path.join(recordingPath, 'actions.json');
        
        if (!fs.existsSync(actionsPath)) {
          return res.status(404).json({ error: 'Recording not found' });
        }

        const actionsContent = fs.readFileSync(actionsPath, 'utf-8');
        const actionsData = JSON.parse(actionsContent);
        
        // Add base path for files
        const response = {
          ...actionsData,
          basePath: recordingPath,
          dataPath: path.join(recordingPath, 'data')
        };
        
        res.json(response);
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Serve recording files (screenshots, etc)
    this.app.get('/api/recordings/:recordingId/files/:filename', (req: Request, res: Response) => {
      const { recordingId, filename } = req.params;
      const recordingsBaseDir = os.tmpdir();
      const filePath = path.join(recordingsBaseDir, 'simplepage', recordingId, 'data', filename);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      // Security check - ensure we're not serving files outside the recording directory
      const resolvedPath = path.resolve(filePath);
      const expectedBase = path.resolve(path.join(recordingsBaseDir, 'simplepage', recordingId, 'data'));
      if (!resolvedPath.startsWith(expectedBase)) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.sendFile(resolvedPath);
    });

  }

  async start() {
    // Initialize browser with persistent context
    await this.initBrowser();
    
    // Start HTTP server
    this.httpServer = this.app.listen(this.port, () => {
      console.log(`SimplePageServer running on http://localhost:${this.port}`);
      console.log(`User data directory: ${this.userDataDir}`);
    });

    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected');
      this.wsClients.add(ws);

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.wsClients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.wsClients.delete(ws);
      });
    });
  }

  async stop() {
    // Close all pages
    for (const [pageId] of this.pages) {
      await this.closePage(pageId);
    }

    // Close browser
    if (this.persistentContext) {
      await this.persistentContext.close();
      this.persistentContext = null;
    }

    // Close WebSocket connections
    if (this.wss) {
      this.wsClients.forEach(ws => ws.close());
      this.wss.close();
      this.wss = null;
    }

    // Stop HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
      this.httpServer = null;
    }
  }

  private async initBrowser() {
    // Create user data directory if it doesn't exist
    const fs = await import('fs');
    if (!fs.existsSync(this.userDataDir)) {
      fs.mkdirSync(this.userDataDir, { recursive: true });
    }

    // Launch persistent context
    this.persistentContext = await playwright.chromium.launchPersistentContext(
      this.userDataDir,
      {
        headless: this.headless,
        args: [
          // 反自动化检测
          '--disable-blink-features=AutomationControlled',
          '--exclude-switches=enable-automation',
          '--enable-automation=false',
          
          // 性能和资源管理
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-features=IsolateOrigins,site-per-process',
          '--window-size=1920,1080',
          '--start-maximized',
          
          // 禁用通知和扩展
          '--disable-notifications',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-infobars',
          '--mute-audio',
          '--no-first-run',
          
          // 后台进程控制
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          
          // 网络和安全
          '--enable-features=NetworkService,NetworkServiceInProcess',
          '--disable-web-security',
          '--allow-running-insecure-content',
          
          // 语言设置
          '--lang=zh-CN',
          '--disable-features=UserAgentClientHint'
        ]
      }
    );
  }

  private broadcast(type: string, data: any) {
    const message = JSON.stringify({ type, data });
    this.wsClients.forEach(ws => {
      if (ws.readyState === ws.OPEN) {
        ws.send(message);
      }
    });
  }

  private async createPage(name: string, description: string | undefined, url: string, timeout: number = 10000): Promise<string> {
    if (!this.persistentContext) {
      throw new Error('Browser not initialized');
    }

    const id = uuid();
    const page = await this.persistentContext.newPage();
    const enableScreenshot = process.env.SCREENSHOT === 'true';
    const simplePage = new SimplePage(page, id, description, enableScreenshot);
    
    // Set callback to broadcast action events
    simplePage.setOnAction((pageId: string, action: any) => {
      this.broadcast('action-recorded', { pageId, action });
    });
    
    await simplePage.init();

    await simplePage.navigate(url, timeout, `Initial navigation to ${url}`);

    const pageInfo: PageInfo = {
      id,
      name,
      description,
      page,
      simplePage,
      createdAt: new Date()
    };

    this.pages.set(id, pageInfo);

    // Broadcast new page event
    this.broadcast('page-created', {
      id,
      name,
      description,
      url: page.url(),
      createdAt: pageInfo.createdAt
    });

    return id;
  }

  private async closePage(pageId: string) {
    const pageInfo = this.pages.get(pageId);
    if (!pageInfo) {
      throw new Error('Page not found');
    }

    // Record close action before closing
    await pageInfo.simplePage.recordClose();
    
    await pageInfo.page.close();
    this.pages.delete(pageId);
  }
}