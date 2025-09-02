import express from 'express';
import type { Request, Response } from 'express';
import * as playwright from 'playwright';
import { v4 as uuid } from 'uuid';
import type { Server } from 'http';
import * as path from 'path';
import * as os from 'os';
import { SimplePage } from './SimplePage';

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

  constructor(private port: number = parseInt(process.env.PORT || '3000')) {
    this.headless = process.env.HEADLESS === 'true';
    this.userDataDir = process.env.USER_DATA_DIR || 
      path.join(os.homedir(), '.simple-page-server', 'user-data');
    
    this.app = express();
    this.app.use(express.json());
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
        createdAt: p.createdAt
      }));
      res.json(pages);
    });

    // Create new page
    this.app.post('/api/pages', async (req: Request, res: Response) => {
      try {
        const { name, description, url } = req.body;
        
        if (!name) {
          return res.status(400).json({ error: 'Page name is required' });
        }

        if (description) {
          console.log(`[CreatePage] ${description}`);
        }

        const pageId = await this.createPage(name, description, url);
        const pageInfo = this.pages.get(pageId)!;
        
        res.json({
          id: pageInfo.id,
          name: pageInfo.name,
          description: pageInfo.description,
          url: pageInfo.page.url(),
          createdAt: pageInfo.createdAt
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
        const { url } = req.body;
        
        if (!url) {
          return res.status(400).json({ error: 'URL is required' });
        }

        const pageInfo = this.pages.get(pageId);
        if (!pageInfo) {
          return res.status(404).json({ error: 'Page not found' });
        }

        await pageInfo.page.goto(url);
        await pageInfo.page.waitForLoadState('networkidle');
        
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
        
        // Only return simplified content
        res.json({ structure: structure.simplified });
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
        createdAt: pageInfo.createdAt
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
  }

  async start() {
    // Initialize browser with persistent context
    await this.initBrowser();
    
    // Start HTTP server
    this.httpServer = this.app.listen(this.port, () => {
      console.log(`SimplePageServer running on http://localhost:${this.port}`);
      console.log(`User data directory: ${this.userDataDir}`);
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
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    );
  }

  private async createPage(name: string, description?: string, url?: string): Promise<string> {
    if (!this.persistentContext) {
      throw new Error('Browser not initialized');
    }

    const id = uuid();
    const page = await this.persistentContext.newPage();
    const simplePage = new SimplePage(page, id, description);
    await simplePage.init();

    if (url) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }

    const pageInfo: PageInfo = {
      id,
      name,
      description,
      page,
      simplePage,
      createdAt: new Date()
    };

    this.pages.set(id, pageInfo);
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