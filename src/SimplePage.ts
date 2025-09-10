import type { CDPSession, Page as PlaywrightPage, Frame } from "playwright";
import { selectors } from "playwright";
import { scriptContent } from "./scriptContent";
import type { Protocol } from "devtools-protocol";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { v4 as uuid } from "uuid";

async function getCurrentRootFrameId(session: CDPSession): Promise<string> {
  const { frameTree } = (await session.send(
    "Page.getFrameTree",
  )) as Protocol.Page.GetFrameTreeResponse;
  return frameTree.frame.id;
}

interface Action {
  type: 'create' | 'act' | 'close' | 'navigate' | 'navigateBack' | 'navigateForward' | 'reload' | 'wait' | 'condition' | 'getListHtml' | 'getListHtmlByParent' | 'getElementHtml';
  url?: string;
  method?: string;
  xpath?: string;
  encodedId?: string;
  selector?: string;
  args?: string[];
  description?: string;
  timestamp: number;
  timeout?: number;
  structure?: string;
  xpathMap?: string;
  screenshot?: string;
  listFile?: string;
  elementFile?: string;
  count?: number;
  pattern?: string;
  flags?: string;
  matched?: boolean;
}

interface PageState {
  id: string;
  description?: string;
  actions: Action[];
}

export class SimplePage {
  public page: PlaywrightPage;  // Made public for getAccessibilityTree
  private logger: any;
  private cdpClient: CDPSession | null = null;
  private initialized: boolean = false;
  private domSettleTimeoutMs: number = 30000;
  private readonly cdpClients = new WeakMap<
    PlaywrightPage | Frame,
    CDPSession
  >();
  private fidOrdinals: Map<string | undefined, number> = new Map([
    [undefined, 0],
  ]);

  private rootFrameId!: string;
  private pageId: string | null = null;
  private pageDir: string | null = null;
  private pageState: PageState | null = null;
  private consoleLogPath: string | null = null;
  private consoleLogStream: fs.WriteStream | null = null;
  private enableScreenshot: boolean = false;
  private recordingEnabled: boolean = true;
  private onAction?: (pageId: string, action: Action) => void;

  public get frameId(): string {
    return this.rootFrameId;
  }

  public updateRootFrameId(newId: string): void {
    this.rootFrameId = newId;
  }

  constructor(page: PlaywrightPage, id?: string, name?: string, description?: string, enableScreenshot: boolean = false, recordActions: boolean = true) {
    this.page = page;
    this.enableScreenshot = enableScreenshot;
    this.recordingEnabled = recordActions;
    this.logger = (info: any) => {
      if (info.level === 1) {
        console.error(info.message);
      } else if (info.level === 2) {
        console.warn(info.message);
      } else {
        console.log(info.message || '');
      }
    };
    
    if (id && recordActions) {
      this.initializePageState(id, name, description);
    }
  }

  private initializePageState(id: string, name?: string, description?: string) {
    this.pageId = id;
    this.pageDir = path.join(os.tmpdir(), 'simplepage', id);
    const dataDir = path.join(this.pageDir, 'data');
    
    // Create directories
    if (!fs.existsSync(this.pageDir)) {
      fs.mkdirSync(this.pageDir, { recursive: true });
    }
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Initialize console log path
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.consoleLogPath = path.join(dataDir, `console-${timestamp}.log`);
    
    // Initialize or load page state
    const actionsFile = path.join(this.pageDir, 'actions.json');
    if (fs.existsSync(actionsFile)) {
      this.pageState = JSON.parse(fs.readFileSync(actionsFile, 'utf-8'));
    } else {
      this.pageState = {
        id,
        name,
        description,
        actions: []
      };
      this.savePageState();
    }
  }

  private setupConsoleLogListener() {
    if (!this.consoleLogPath) return;
    
    // Create write stream for console logs
    this.consoleLogStream = fs.createWriteStream(this.consoleLogPath, { flags: 'a' });
    
    // Listen to console events
    this.page.on('console', (msg) => {
      const timestamp = new Date().toISOString();
      const type = msg.type();
      const text = msg.text();
      
      // Format log entry
      const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${text}\n`;
      
      // Write to file
      if (this.consoleLogStream) {
        this.consoleLogStream.write(logEntry);
      }
      
      // Also handle arguments for more detailed logging
      if (type === 'error' || type === 'warning') {
        msg.args().forEach((arg, index) => {
          arg.jsonValue().then(value => {
            if (value && typeof value === 'object' && value.stack) {
              const stackEntry = `[${timestamp}] [${type.toUpperCase()}-STACK] ${value.stack}\n`;
              if (this.consoleLogStream) {
                this.consoleLogStream.write(stackEntry);
              }
            }
          }).catch(() => {
            // Ignore errors in getting argument values
          });
        });
      }
    });
    
    // Listen to page errors
    this.page.on('pageerror', (error) => {
      const timestamp = new Date().toISOString();
      const errorEntry = `[${timestamp}] [PAGE-ERROR] ${error.message}\n${error.stack || ''}\n`;
      
      if (this.consoleLogStream) {
        this.consoleLogStream.write(errorEntry);
      }
    });
  }

  private savePageState() {
    if (!this.pageState || !this.pageDir) return;
    const actionsFile = path.join(this.pageDir, 'actions.json');
    fs.writeFileSync(actionsFile, JSON.stringify(this.pageState, null, 2));
  }

  private async saveSnapshot(action: Action) {
    if (!this.pageDir) return;
    
    const timestamp = Date.now();
    const dataDir = path.join(this.pageDir, 'data');
    
    // Get page structure
    const structure = await this.getPageStructure();
    
    // Save structure file
    const structureFile = `${timestamp}-structure.txt`;
    const structurePath = path.join(dataDir, structureFile);
    fs.writeFileSync(structurePath, structure.simplified);
    action.structure = structureFile;
    
    // Save xpathMap file
    const xpathFile = `${timestamp}-xpath.json`;
    const xpathPath = path.join(dataDir, xpathFile);
    fs.writeFileSync(xpathPath, JSON.stringify(structure.xpathMap, null, 2));
    action.xpathMap = xpathFile;
    
    // Save screenshot if enabled
    if (this.enableScreenshot) {
      const screenshotFile = `${timestamp}-screenshot.png`;
      const screenshotPath = path.join(dataDir, screenshotFile);
      await this.page.screenshot({ path: screenshotPath });
      action.screenshot = screenshotFile;
    }
  }

  private async recordAction(action: Omit<Action, 'timestamp'>) {
    if (!this.pageState || !this.recordingEnabled) return;
    
    const fullAction: Action = {
      ...action,
      timestamp: Date.now()
    };
    
    // Save snapshot for this action (except for close)
    if (action.type !== 'close') {
      await this.saveSnapshot(fullAction);
    }
    
    // Add to actions array
    this.pageState.actions.push(fullAction);
    
    // Save updated state
    this.savePageState();
    
    // Call callback if set
    if (this.onAction && this.pageId) {
      this.onAction(this.pageId, fullAction);
    }
  }

  public async recordClose() {
    if (this.pageState) {
      await this.recordAction({
        type: 'close'
      });
    }
    
    // Close console log stream
    if (this.consoleLogStream) {
      this.consoleLogStream.end();
      this.consoleLogStream = null;
    }
  }

  // Get console log file path
  public getConsoleLogPath(): string | null {
    return this.consoleLogPath;
  }

  // Set callback for action events
  public setOnAction(callback: (pageId: string, action: Action) => void) {
    this.onAction = callback;
  }

  // For compatibility with getAccessibilityTree
  public get context() {
    return this.page.context();
  }

  public ordinalForFrameId(fid: string | undefined): number {
    if (fid === undefined) return 0;

    const cached = this.fidOrdinals.get(fid);
    if (cached !== undefined) return cached;

    const next: number = this.fidOrdinals.size;
    this.fidOrdinals.set(fid, next);
    return next;
  }

  public encodeWithFrameId(
    fid: string | undefined,
    backendId: number,
  ): EncodedId {
    return `${this.ordinalForFrameId(fid)}-${backendId}` as EncodedId;
  }

  public resetFrameOrdinals(): void {
    this.fidOrdinals = new Map([[undefined, 0]]);
  }

  private async ensureSimplePageScript(): Promise<void> {
    try {
      const injected = await this.page.evaluate(
        () => !!window.__simplePageInjected,
      );

      if (injected) return;

      const guardedScript = `if (!window.__simplePageInjected) { \
window.__simplePageInjected = true; \
${scriptContent} \
}`;

      await this.page.addInitScript({ content: guardedScript });
      await this.page.evaluate(guardedScript);
    } catch (err) {
      console.error("Failed to inject SimplePage helper script", err);
      throw err;
    }
  }

  /** Register the custom selector engine that pierces open/closed shadow roots. */
  private async ensureSimplePageSelectorEngine(): Promise<void> {
    const registerFn = () => {
      type Backdoor = {
        getClosedRoot?: (host: Element) => ShadowRoot | undefined;
      };

      function parseSelector(input: string): { name: string; value: string } {
        // Accept either:  "abc123"  → uses DEFAULT_ATTR
        // or explicitly:  "data-__simplepage-id=abc123"
        const raw = input.trim();
        const eq = raw.indexOf("=");
        if (eq === -1) {
          return {
            name: "data-__simplepage-id",
            value: raw.replace(/^["']|["']$/g, ""),
          };
        }
        const name = raw.slice(0, eq).trim();
        const value = raw
          .slice(eq + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        return { name, value };
      }

      function pushChildren(node: Node, stack: Node[]): void {
        if (node.nodeType === Node.DOCUMENT_NODE) {
          const de = (node as Document).documentElement;
          if (de) stack.push(de);
          return;
        }

        if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
          const frag = node as DocumentFragment;
          const hc = frag.children as HTMLCollection | undefined;
          if (hc && hc.length) {
            for (let i = hc.length - 1; i >= 0; i--)
              stack.push(hc[i] as Element);
          } else {
            const cn = frag.childNodes;
            for (let i = cn.length - 1; i >= 0; i--) stack.push(cn[i]);
          }
          return;
        }

        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          for (let i = el.children.length - 1; i >= 0; i--)
            stack.push(el.children[i]);
        }
      }

      function* traverseAllTrees(
        start: Node,
      ): Generator<Element, void, unknown> {
        const backdoor = window.__simplepage__ as Backdoor | undefined;
        const stack: Node[] = [];

        if (start.nodeType === Node.DOCUMENT_NODE) {
          const de = (start as Document).documentElement;
          if (de) stack.push(de);
        } else {
          stack.push(start);
        }

        while (stack.length) {
          const node = stack.pop()!;
          if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            yield el;

            // open shadow
            const open = el.shadowRoot as ShadowRoot | null;
            if (open) stack.push(open);

            // closed shadow via backdoor
            const closed = backdoor?.getClosedRoot?.(el);
            if (closed) stack.push(closed);
          }
          pushChildren(node, stack);
        }
      }

      return {
        query(root: Node, selector: string): Element | null {
          const { name, value } = parseSelector(selector);
          for (const el of traverseAllTrees(root)) {
            if (el.getAttribute(name) === value) return el;
          }
          return null;
        },
        queryAll(root: Node, selector: string): Element[] {
          const { name, value } = parseSelector(selector);
          const out: Element[] = [];
          for (const el of traverseAllTrees(root)) {
            if (el.getAttribute(name) === value) out.push(el);
          }
          return out;
        },
      };
    };

    try {
      await selectors.register("simplepage", registerFn);
    } catch (err) {
      if (
        err instanceof Error &&
        err.message.match(/selector engine has been already registered/)
      ) {
        // ignore
      } else {
        throw err;
      }
    }
  }


  async init(): Promise<SimplePage> {
    try {
      // Initialize CDP session
      const session = await this.getCDPClient(this.page);
      await session.send("Page.enable");

      // Set up frame ID
      const rootId = await getCurrentRootFrameId(session);
      this.updateRootFrameId(rootId);

      // Ensure selector engine and scripts are ready BEFORE recording
      await this.ensureSimplePageSelectorEngine();
      await this.ensureSimplePageScript();

      // Set up console log listener
      this.setupConsoleLogListener();
      
      this.initialized = true;

      // Record page creation if tracking is enabled (AFTER scripts are ready)
      if (this.pageState) {
        await this.recordAction({
          type: 'create',
          url: this.page.url(),
          description: this.pageState.description
        });
      }
      return this;
    } catch (err: unknown) {
      console.error("Failed to initialize SimplePage", err);
      throw err;
    }
  }


  // 直接获取页面的 Accessibility Tree（无需 AI）
  public async getPageStructure(selector?: string) {
    const { getAccessibilityTree } = require("./utils");
    
    // 保存原始 HTML 用于调试
    let htmlPath: string | undefined;
    let axTreePath: string | undefined;
    
    if (this.pageState && this.pageDir) {
      const timestamp = Date.now();
      const dataDir = path.join(this.pageDir, 'data');
      
      // 保存原始 HTML
      try {
        const html = await this.page.content();
        htmlPath = path.join(dataDir, `${timestamp}-page.html`);
        fs.writeFileSync(htmlPath, html);
        console.log(`[DEBUG] Saved HTML to: ${htmlPath}`);
      } catch (e) {
        console.error('[DEBUG] Failed to save HTML:', e);
      }
      
      // 获取并保存原始 Accessibility Tree
      try {
        const client = await this.getCDPClient();
        const axTree = await client.send("Accessibility.getFullAXTree", { depth: -1 });
        axTreePath = path.join(dataDir, `${timestamp}-axtree.json`);
        fs.writeFileSync(axTreePath, JSON.stringify(axTree, null, 2));
        console.log(`[DEBUG] Saved AX Tree to: ${axTreePath}`);
      } catch (e) {
        console.error('[DEBUG] Failed to save AX Tree:', e);
      }
    }
    
    const result = await getAccessibilityTree(
      false, // experimental
      this,
      this.logger,
      selector,
      undefined // targetFrame
    );
    
    // 保存 xpathMap 供后续操作使用
    (global as any).__simplepage_xpath_map = result.xpathMap;
    (global as any).__simplepage_current_page = this;
    
    return {
      simplified: result.simplified,
      xpathMap: result.xpathMap,
      idToUrl: result.idToUrl,
      tree: result.tree,
      htmlPath,
      axTreePath
    };
  }

  // 直接通过 XPath 操作元素
  public async actByXPath(xpath: string, method: string, args: string[] = [], description?: string, waitTimeout?: number): Promise<void> {
    // 使用 Playwright 的 locator API 进行操作
    // Ensure XPath is properly formatted for Playwright
    const locator = this.page.locator(`xpath=${xpath}`);
    
    if (method === 'fill' && args[0]) {
      await locator.fill(args[0]);
    } else if (method === 'click') {
      await locator.click({ force: true });
    } else if (method === 'select' && args[0]) {
      await locator.selectOption(args[0]);
    } else if (method === 'check') {
      await locator.check();
    } else if (method === 'uncheck') {
      await locator.uncheck();
    } else if (method === 'hover') {
      await locator.hover();
    } else if (method === 'press' && args[0]) {
      await locator.press(args[0]);
    } else if (method === 'scrollY' && args[0]) {
      const target = args[0];
      
      if (target === 'top') {
        await locator.evaluate(el => {
          const isBody = el.tagName.toLowerCase() === 'body';
          if (isBody) {
            window.scrollTo(0, 0);
          } else {
            el.scrollTop = 0;
          }
        });
      } else if (target === 'bottom') {
        await locator.evaluate(el => {
          const isBody = el.tagName.toLowerCase() === 'body';
          if (isBody) {
            window.scrollTo(0, document.documentElement.scrollHeight);
          } else {
            el.scrollTop = el.scrollHeight;
          }
        });
      } else {
        const pixels = parseInt(target);
        if (pixels > 0) {
          // 相对滚动（向下）
          await locator.evaluate((el, px) => {
            const isBody = el.tagName.toLowerCase() === 'body';
            if (isBody) {
              window.scrollBy(0, px);
            } else {
              el.scrollTop += px;
            }
          }, pixels);
        } else {
          // 绝对位置
          await locator.evaluate((el, px) => {
            const isBody = el.tagName.toLowerCase() === 'body';
            if (isBody) {
              window.scrollTo(0, Math.abs(px));
            } else {
              el.scrollTop = Math.abs(px);
            }
          }, Math.abs(pixels));
        }
      }
    } else if (method === 'scrollX' && args[0]) {
      const target = args[0];
      
      if (target === 'left') {
        await locator.evaluate(el => {
          const isBody = el.tagName.toLowerCase() === 'body';
          if (isBody) {
            window.scrollTo(0, window.scrollY);
          } else {
            el.scrollLeft = 0;
          }
        });
      } else if (target === 'right') {
        await locator.evaluate(el => {
          const isBody = el.tagName.toLowerCase() === 'body';
          if (isBody) {
            window.scrollTo(document.documentElement.scrollWidth, window.scrollY);
          } else {
            el.scrollLeft = el.scrollWidth;
          }
        });
      } else {
        const pixels = parseInt(target);
        if (pixels > 0) {
          // 相对滚动（向右）
          await locator.evaluate((el, px) => {
            const isBody = el.tagName.toLowerCase() === 'body';
            if (isBody) {
              window.scrollBy(px, 0);
            } else {
              el.scrollLeft += px;
            }
          }, pixels);
        } else {
          // 绝对位置
          await locator.evaluate((el, px) => {
            const isBody = el.tagName.toLowerCase() === 'body';
            if (isBody) {
              window.scrollTo(Math.abs(px), window.scrollY);
            } else {
              el.scrollLeft = Math.abs(px);
            }
          }, Math.abs(pixels));
        }
      }
    } else if (method === 'handleDialog' && args[0]) {
      const action = args[0]; // 'accept' or 'dismiss'
      const promptText = args[1]; // Optional text for prompt dialogs
      
      // Set up dialog handler before triggering the action
      this.page.once('dialog', async dialog => {
        if (action === 'accept') {
          await dialog.accept(promptText || '');
        } else if (action === 'dismiss') {
          await dialog.dismiss();
        }
      });
      
      // Click the element that triggers the dialog
      await locator.click();
    } else if (method === 'fileUpload' && args.length > 0) {
      // Handle file upload
      const filePaths = Array.isArray(args) ? args : [args[0]];
      await locator.setInputFiles(filePaths);
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
    
    // Wait for DOM to settle after all actions
    await this._waitForSettledDom(waitTimeout);
    
    // Record action after execution
    if (this.pageState) {
      await this.recordAction({
        type: 'act',
        method,
        xpath,
        args,
        description
      });
    }
  }

  // 通过 EncodedId 操作元素（内部调用 actByXPath）
  public async actByEncodedId(encodedId: string, method: string, args: string[] = [], description?: string, waitTimeout?: number): Promise<void> {
    const xpathMap = (global as any).__simplepage_xpath_map;
    if (!xpathMap) {
      throw new Error("XPath map not available. Run getPageStructure first.");
    }
    
    const xpath = xpathMap[encodedId];
    if (!xpath) {
      throw new Error(`No XPath found for EncodedId: ${encodedId}`);
    }
    
    // Just convert and forward to actByXPath
    return this.actByXPath(xpath, method, args, description, waitTimeout);
  }

  // Navigate to a URL
  public async navigate(url: string, timeout: number = 3000, description?: string): Promise<void> {
    await this.page.goto(url, { timeout });
    
    // Wait for DOM to settle after navigation
    await this._waitForSettledDom();
    
    // Record navigation if tracking is enabled
    if (this.pageState) {
      await this.recordAction({
        type: 'navigate',
        url,
        timeout,
        description: description || `Navigate to ${url}`
      });
    }
  }

  // Navigate back in browser history
  public async navigateBack(description?: string): Promise<void> {
    await this.page.goBack();
    
    // Wait for DOM to settle after navigation
    await this._waitForSettledDom();
    
    // Record navigation if tracking is enabled
    if (this.pageState) {
      await this.recordAction({
        type: 'navigateBack',
        description: description || 'Navigate back'
      });
    }
  }

  // Navigate forward in browser history
  public async navigateForward(description?: string): Promise<void> {
    await this.page.goForward();
    
    // Wait for DOM to settle after navigation
    await this._waitForSettledDom();
    
    // Record navigation if tracking is enabled
    if (this.pageState) {
      await this.recordAction({
        type: 'navigateForward',
        description: description || 'Navigate forward'
      });
    }
  }

  // Reload the current page
  public async reload(timeout: number = 3000, description?: string): Promise<void> {
    await this.page.reload({ timeout });
    
    // Wait for DOM to settle after reload
    await this._waitForSettledDom();
    
    // Record reload if tracking is enabled
    if (this.pageState) {
      await this.recordAction({
        type: 'reload',
        timeout,
        description: description || 'Reload page'
      });
    }
  }

  // Wait for a timeout
  public async waitForTimeout(timeout: number, description?: string): Promise<void> {
    await this.page.waitForTimeout(timeout);
    
    // Record wait if tracking is enabled
    if (this.pageState) {
      await this.recordAction({
        type: 'wait',
        timeout,
        description: description || `Wait for ${timeout}ms`
      });
    }
  }

  // Check condition against page structure using regex
  public async checkCondition(pattern: RegExp | string, description?: string): Promise<boolean> {
    const structure = await this.getPageStructure();
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    const matched = regex.test(structure.simplified);
    
    // Record condition check if tracking is enabled
    if (this.pageState) {
      await this.recordAction({
        type: 'condition',
        pattern: regex.source,
        flags: regex.flags,
        matched,
        description: description || `Check condition: ${regex.source}`
      });
    }
    
    return matched;
  }

  // Get actions.json file path
  public getActionsPath(): string | null {
    return this.pageDir ? path.join(this.pageDir, 'actions.json') : null;
  }

  // Get list of outerHTML from elements matching selector (CSS or XPath) and save to file
  public async getListHtml(selector: string): Promise<string | null> {
    // Initialize pageDir if not already initialized
    if (!this.pageDir) {
      if (!this.pageId) {
        this.pageId = uuid();
      }
      this.pageDir = path.join(os.tmpdir(), 'simplepage', this.pageId);
    }
    
    // Check if selector is XPath or CSS
    const isXPath = selector.startsWith('/') || selector.startsWith('(') || selector.includes('::');
    
    const htmlList = await this.page.evaluate(({ selector, isXPath }) => {
      let elements: Element[] = [];
      
      if (isXPath) {
        // Use XPath to get all matching elements
        const result = document.evaluate(selector, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        for (let i = 0; i < result.snapshotLength; i++) {
          const node = result.snapshotItem(i);
          if (node && node.nodeType === Node.ELEMENT_NODE) {
            elements.push(node as Element);
          }
        }
      } else {
        // Use CSS selector to get all matching elements
        elements = Array.from(document.querySelectorAll(selector));
      }
      
      // Get outerHTML of all matching elements
      return elements.map(element => element.outerHTML);
    }, { selector, isXPath });
    
    // 确保 data 目录存在
    const dataDir = path.join(this.pageDir, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 保存到文件
    const timestamp = Date.now();
    const listFile = `${timestamp}-list.json`;
    const listPath = path.join(dataDir, listFile);
    
    fs.writeFileSync(listPath, JSON.stringify(htmlList, null, 2));
    
    // 记录 action
    if (this.pageState) {
      await this.recordAction({
        type: 'getListHtml',
        selector: selector,
        listFile: listFile,
        count: htmlList.length,
        description: `Extract list from ${selector}`
      });
    }
    
    return listFile;
  }

  // Get list of outerHTML from all direct children of a parent element and save to file
  public async getListHtmlByParent(selector: string): Promise<string | null> {
    // Initialize pageDir if not already initialized
    if (!this.pageDir) {
      if (!this.pageId) {
        this.pageId = uuid();
      }
      this.pageDir = path.join(os.tmpdir(), 'simplepage', this.pageId);
    }
    
    // Check if selector is XPath or CSS
    const isXPath = selector.startsWith('/') || selector.startsWith('(') || selector.includes('::');
    
    const htmlList = await this.page.evaluate(({ selector, isXPath }) => {
      let parent: Element | null = null;
      
      if (isXPath) {
        const result = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = result.singleNodeValue;
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          parent = node as Element;
        }
      } else {
        parent = document.querySelector(selector);
      }
      
      if (!parent || !parent.children) return [];
      
      // 获取所有直接子元素的 outerHTML
      return Array.from(parent.children).map(child => child.outerHTML);
    }, { selector, isXPath });
    
    // 确保 data 目录存在
    const dataDir = path.join(this.pageDir, 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // 保存到文件
    const timestamp = Date.now();
    const listFile = `${timestamp}-list.json`;
    const listPath = path.join(dataDir, listFile);
    
    fs.writeFileSync(listPath, JSON.stringify(htmlList, null, 2));
    
    // 记录 action
    if (this.pageState) {
      await this.recordAction({
        type: 'getListHtmlByParent',
        selector: selector,
        listFile: listFile,
        count: htmlList.length,
        description: `Extract list from ${selector}`
      });
    }
    
    return listFile;
  }

  // Get outerHTML of a single element matching selector (CSS or XPath) and save to file
  public async getElementHtml(selector: string): Promise<string | null> {
    // Initialize pageDir if not already initialized
    if (!this.pageDir) {
      if (!this.pageId) {
        this.pageId = uuid();
      }
      this.pageDir = path.join(os.tmpdir(), 'simplepage', this.pageId);
    }
    
    // Check if selector is XPath or CSS
    const isXPath = selector.startsWith('/') || selector.startsWith('(') || selector.includes('::');
    
    const elementHtml = await this.page.evaluate(({ selector, isXPath }) => {
      let element: Element | null = null;
      
      if (isXPath) {
        // Use XPath to get first matching element
        const result = document.evaluate(selector, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const node = result.singleNodeValue;
        if (node && node.nodeType === Node.ELEMENT_NODE) {
          element = node as Element;
        }
      } else {
        // Use CSS selector to get first matching element
        element = document.querySelector(selector);
      }
      
      // Get outerHTML of the element
      return element ? element.outerHTML : null;
    }, { selector, isXPath });
    
    if (!elementHtml) {
      return null;
    }
    
    // Ensure data directory exists
    const dataDir = path.join(this.pageDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });
    
    // Create unique filename with timestamp
    const timestamp = Date.now();
    const elementFile = `${timestamp}-element.html`;
    const elementPath = path.join(dataDir, elementFile);
    
    // Save element HTML to file
    fs.writeFileSync(elementPath, elementHtml);
    
    // Record action
    if (this.pageState) {
      await this.recordAction({
        type: 'getElementHtml',
        selector: selector,
        elementFile: elementFile,
        description: `Extract element from ${selector}`
      });
    }
    
    return elementFile;
  }

  // Delete a specific action from the recording
  public async deleteAction(index: number): Promise<boolean> {
    if (!this.pageState || !this.pageDir) {
      return false;
    }
    
    if (index < 0 || index >= this.pageState.actions.length) {
      return false;
    }
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Get the action to be deleted
      const actionToDelete = this.pageState.actions[index];
      
      // Delete associated files
      const dataDir = path.join(this.pageDir, 'data');
      
      // Delete screenshot if exists
      if (actionToDelete.screenshot) {
        const screenshotPath = path.join(dataDir, actionToDelete.screenshot);
        if (fs.existsSync(screenshotPath)) {
          fs.unlinkSync(screenshotPath);
        }
      }
      
      // Delete structure file if exists
      if (actionToDelete.structure) {
        const structurePath = path.join(dataDir, actionToDelete.structure);
        if (fs.existsSync(structurePath)) {
          fs.unlinkSync(structurePath);
        }
      }
      
      // Delete xpathMap file if exists
      if (actionToDelete.xpathMap) {
        const xpathPath = path.join(dataDir, actionToDelete.xpathMap);
        if (fs.existsSync(xpathPath)) {
          fs.unlinkSync(xpathPath);
        }
      }
      
      // Delete list file if exists
      if (actionToDelete.listFile) {
        const listPath = path.join(dataDir, actionToDelete.listFile);
        if (fs.existsSync(listPath)) {
          fs.unlinkSync(listPath);
        }
      }
      
      // Delete element file if exists
      if (actionToDelete.elementFile) {
        const elementPath = path.join(dataDir, actionToDelete.elementFile);
        if (fs.existsSync(elementPath)) {
          fs.unlinkSync(elementPath);
        }
      }
      
      // Remove the action from the array
      this.pageState.actions.splice(index, 1);
      
      // Save the updated actions
      const actionsPath = path.join(this.pageDir, 'actions.json');
      fs.writeFileSync(actionsPath, JSON.stringify(this.pageState, null, 2));
      
      return true;
    } catch (error) {
      console.error('Error deleting action:', error);
      return false;
    }
  }
  
  // Delete all recording data (actions.json and all associated files)
  public async deleteAllRecords(): Promise<boolean> {
    if (!this.pageDir) {
      return false;
    }
    
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Remove the entire page directory
      if (fs.existsSync(this.pageDir)) {
        fs.rmSync(this.pageDir, { recursive: true, force: true });
      }
      
      // Clear the page state
      this.pageState = null;
      
      return true;
    } catch (error) {
      console.error('Error deleting all records:', error);
      return false;
    }
  }

  /**
   * `_waitForSettledDom` waits until the DOM is settled, and therefore is
   * ready for actions to be taken.
   *
   * **Definition of "settled"**
   *   • No in-flight network requests (except WebSocket / Server-Sent-Events).
   *   • That idle state lasts for at least **500 ms** (the "quiet-window").
   *
   * **How it works**
   *   1.  Subscribes to CDP Network and Page events for the main target and all
   *       out-of-process iframes (via `Target.setAutoAttach { flatten:true }`).
   *   2.  Every time `Network.requestWillBeSent` fires, the request ID is added
   *       to an **`inflight`** `Set`.
   *   3.  When the request finishes—`loadingFinished`, `loadingFailed`,
   *       `requestServedFromCache`, or a *data:* response—the request ID is
   *       removed.
   *   4.  *Document* requests are also mapped **frameId → requestId**; when
   *       `Page.frameStoppedLoading` fires the corresponding Document request is
   *       removed immediately (covers iframes whose network events never close).
   *   5.  A **stalled-request sweep timer** runs every 500 ms.  If a *Document*
   *       request has been open for ≥ 2 s it is forcibly removed; this prevents
   *       ad/analytics iframes from blocking the wait forever.
   *   6.  When `inflight` becomes empty the helper starts a 500 ms timer.
   *       If no new request appears before the timer fires, the promise
   *       resolves → **DOM is considered settled**.
   *   7.  A global guard (`timeoutMs` or `simplepage.domSettleTimeoutMs`,
   *       default ≈ 30 s) ensures we always resolve; if it fires we log how many
   *       requests were still outstanding.
   *
   * @param timeoutMs – Optional hard cap (ms).  Defaults to
   *                    `this.simplepage.domSettleTimeoutMs`.
   */
  public async _waitForSettledDom(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? this.domSettleTimeoutMs;  // Use configured default
    const client = await this.getCDPClient();

    const hasDoc = !!(await this.page.title().catch(() => false));
    if (!hasDoc) await this.page.waitForLoadState("domcontentloaded");

    await client.send("Network.enable");
    await client.send("Page.enable");
    await client.send("Target.setAutoAttach", {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
      filter: [
        { type: "worker", exclude: true },
        { type: "shared_worker", exclude: true },
      ],
    });

    return new Promise<void>((resolve) => {
      const inflight = new Set<string>();
      const meta = new Map<string, { url: string; start: number }>();
      const docByFrame = new Map<string, string>();

      let quietTimer: NodeJS.Timeout | null = null;
      let stalledRequestSweepTimer: NodeJS.Timeout | null = null;

      const clearQuiet = () => {
        if (quietTimer) {
          clearTimeout(quietTimer);
          quietTimer = null;
        }
      };

      const maybeQuiet = () => {
        if (inflight.size === 0 && !quietTimer)
          quietTimer = setTimeout(() => resolveDone(), 500);
      };

      const finishReq = (id: string) => {
        if (!inflight.delete(id)) return;
        meta.delete(id);
        for (const [fid, rid] of docByFrame)
          if (rid === id) docByFrame.delete(fid);
        clearQuiet();
        maybeQuiet();
      };

      const onRequest = (p: Protocol.Network.RequestWillBeSentEvent) => {
        if (p.type === "WebSocket" || p.type === "EventSource") return;

        inflight.add(p.requestId);
        meta.set(p.requestId, { url: p.request.url, start: Date.now() });

        if (p.type === "Document" && p.frameId)
          docByFrame.set(p.frameId, p.requestId);

        clearQuiet();
      };

      const onFinish = (p: { requestId: string }) => finishReq(p.requestId);
      const onCached = (p: { requestId: string }) => finishReq(p.requestId);
      const onDataUrl = (p: Protocol.Network.ResponseReceivedEvent) =>
        p.response.url.startsWith("data:") && finishReq(p.requestId);

      const onFrameStop = (f: Protocol.Page.FrameStoppedLoadingEvent) => {
        const id = docByFrame.get(f.frameId);
        if (id) finishReq(id);
      };

      client.on("Network.requestWillBeSent", onRequest);
      client.on("Network.loadingFinished", onFinish);
      client.on("Network.loadingFailed", onFinish);
      client.on("Network.requestServedFromCache", onCached);
      client.on("Network.responseReceived", onDataUrl);
      client.on("Page.frameStoppedLoading", onFrameStop);

      stalledRequestSweepTimer = setInterval(() => {
        const now = Date.now();
        for (const [id, m] of meta) {
          if (now - m.start > 2_000) {
            inflight.delete(id);
            meta.delete(id);
            console.log("⏳ forcing completion of stalled iframe document", m.url.slice(0, 120));
          }
        }
        maybeQuiet();
      }, 500);

      maybeQuiet();

      const guard = setTimeout(() => {
        if (inflight.size)
          console.warn(`⚠️ DOM-settle timeout reached – ${inflight.size} network requests still pending`);
        resolveDone();
      }, timeout);

      const resolveDone = () => {
        client.off("Network.requestWillBeSent", onRequest);
        client.off("Network.loadingFinished", onFinish);
        client.off("Network.loadingFailed", onFinish);
        client.off("Network.requestServedFromCache", onCached);
        client.off("Network.responseReceived", onDataUrl);
        client.off("Page.frameStoppedLoading", onFrameStop);
        if (quietTimer) clearTimeout(quietTimer);
        if (stalledRequestSweepTimer) clearInterval(stalledRequestSweepTimer);
        clearTimeout(guard);
        resolve();
      };
    });
  }


  /**
   * Get or create a CDP session for the given target.
   * @param target  The Page or (OOPIF) Frame you want to talk to.
   */
  async getCDPClient(
    target: PlaywrightPage | Frame = this.page,
  ): Promise<CDPSession> {
    const cached = this.cdpClients.get(target);
    if (cached) return cached;

    try {
      const session = await this.page.context().newCDPSession(target);
      this.cdpClients.set(target, session);
      return session;
    } catch (err) {
      // Fallback for same-process iframes
      const msg = (err as Error).message ?? "";
      if (msg.includes("does not have a separate CDP session")) {
        // Re-use / create the top-level session instead
        const rootSession = await this.getCDPClient(this.page);
        // cache the alias so we don't try again for this frame
        this.cdpClients.set(target, rootSession);
        return rootSession;
      }
      throw err;
    }
  }

  /**
   * Send a CDP command to the chosen DevTools target.
   *
   * @param method  Any valid CDP method, e.g. `"DOM.getDocument"`.
   * @param params  Command parameters (optional).
   * @param target  A `Page` or OOPIF `Frame`. Defaults to the main page.
   *
   * @typeParam T  Expected result shape (defaults to `unknown`).
   */
  async sendCDP<T = unknown>(
    method: string,
    params: Record<string, unknown> = {},
    target?: PlaywrightPage | Frame,
  ): Promise<T> {
    const client = await this.getCDPClient(target ?? this.page);

    return client.send(
      method as Parameters<CDPSession["send"]>[0],
      params as Parameters<CDPSession["send"]>[1],
    ) as Promise<T>;
  }

  /** Enable a CDP domain (e.g. `"Network"` or `"DOM"`) on the chosen target. */
  async enableCDP(
    domain: string,
    target?: PlaywrightPage | Frame,
  ): Promise<void> {
    await this.sendCDP<void>(`${domain}.enable`, {}, target);
  }

  /** Disable a CDP domain on the chosen target. */
  async disableCDP(
    domain: string,
    target?: PlaywrightPage | Frame,
  ): Promise<void> {
    await this.sendCDP<void>(`${domain}.disable`, {}, target);
  }
}
