/**
 * 极简浏览器自动化框架
 * 只保留核心功能：页面创建、结构提取、元素操作
 */

import { chromium, Browser, Page as PlaywrightPage, BrowserContext } from 'playwright';
import { StagehandPage } from './StagehandPage';

/**
 * 使用原始 StagehandPage 的包装类
 */
export class Page {
  private stagehandPage: StagehandPage;
  private browser: Browser;
  private context: BrowserContext;

  constructor(stagehandPage: StagehandPage, browser: Browser, context: BrowserContext) {
    this.stagehandPage = stagehandPage;
    this.browser = browser;
    this.context = context;
  }

  /**
   * 获取页面的 Accessibility Tree 结构
   */
  async getPageStructure(selector?: string) {
    return await this.stagehandPage.getPageStructure(selector);
  }

  /**
   * 通过 EncodedId 操作元素
   */
  async actByEncodedId(encodedId: string, method: string, args: string[] = []): Promise<void> {
    return await this.stagehandPage.actByEncodedId(encodedId, method, args);
  }

  /**
   * 导航到指定 URL
   */
  async goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }) {
    await this.stagehandPage.page.goto(url, options);
  }

  /**
   * 等待指定时间
   */
  async waitForTimeout(timeout: number) {
    await this.stagehandPage.page.waitForTimeout(timeout);
  }

  /**
   * 关闭页面和浏览器
   */
  async close() {
    await this.stagehandPage.page.close();
    await this.browser.close();
  }

  /**
   * 获取原始 Playwright Page 对象（如需要额外功能）
   */
  get playwrightPage(): PlaywrightPage {
    return this.stagehandPage.page;
  }
}

/**
 * 创建页面实例
 */
export async function createPage(
  url?: string, 
  options?: {
    headless?: boolean;
    viewport?: { width: number; height: number };
  }
): Promise<Page> {
  const browser = await chromium.launch({ 
    headless: options?.headless ?? false 
  });
  
  const context = await browser.newContext({
    viewport: options?.viewport
  });
  
  const page = await context.newPage();
  
  // 创建一个最小的 Stagehand 对象和 StagehandContext 对象来满足 StagehandPage 的需求
  const stagehand = {
    logger: (logLine: any) => {
      if (logLine.level === 0 && !logLine.message?.includes('API key')) {
        console.error(logLine.message);
      }
    },
    log: (logLine: any) => {
      if (logLine.level === 0 && !logLine.message?.includes('API key')) {
        console.error(logLine.message);
      }
    },
    experimental: false,
    selfHeal: false,
    isClosed: false
  } as any;
  
  const stagehandContext = {
    client: null
  } as any;
  
  // 创建 StagehandPage 实例（不传递 llmClient 和其他 AI 相关参数）
  const stagehandPage = new StagehandPage(
    page,
    stagehand,
    stagehandContext,
    null, // llmClient
    undefined, // userProvidedInstructions
    undefined, // api
    false // waitForCaptchaSolves
  );
  
  // 初始化 StagehandPage
  await stagehandPage.init();
  
  if (url) {
    await page.goto(url);
  }
  
  return new Page(stagehandPage, browser, context);
}