import { Browser, chromium } from "playwright";
import fs from "fs";
import os from "os";
import path from "path";
import { BrowserResult } from "../types/browser";
import { EnhancedContext } from "../types/context";
import { LogLine } from "../types/log";
import { BrowserContext, Page } from "../types/page";
import {
  ConstructorParams,
  InitResult,
  LocalBrowserLaunchOptions,
} from "../types/stagehand";
import { StagehandContext } from "./StagehandContext";
import { StagehandPage } from "./StagehandPage";
import { scriptContent } from "./dom/build/scriptContent";

import {
  StagehandError,
  StagehandNotInitializedError,
  MissingEnvironmentVariableError,
  StagehandInitError,
} from "../types/stagehandErrors";


const defaultLogger = async (logLine: LogLine) => {
  console.log(logLine.message);
};

async function getBrowser(
  headless: boolean = false,
  logger: (message: LogLine) => void,
  localBrowserLaunchOptions?: LocalBrowserLaunchOptions,
): Promise<BrowserResult> {
    if (localBrowserLaunchOptions?.cdpUrl) {
      if (!localBrowserLaunchOptions.cdpUrl.includes("connect.connect")) {
        logger({
          category: "init",
          message: "connecting to local browser via CDP URL",
          level: 1,
          auxiliary: {
            cdpUrl: {
              value: localBrowserLaunchOptions.cdpUrl,
              type: "string",
            },
          },
        });
      }

      const browser = await chromium.connectOverCDP(
        localBrowserLaunchOptions.cdpUrl,
      );
      const context = browser.contexts()[0];
      return { browser, context };
    }

    let userDataDir = localBrowserLaunchOptions?.userDataDir;
    if (!userDataDir) {
      const tmpDirPath = path.join(os.tmpdir(), "stagehand");
      if (!fs.existsSync(tmpDirPath)) {
        fs.mkdirSync(tmpDirPath, { recursive: true });
      }

      const tmpDir = fs.mkdtempSync(path.join(tmpDirPath, "ctx_"));
      fs.mkdirSync(path.join(tmpDir, "userdir/Default"), { recursive: true });

      const defaultPreferences = {
        plugins: {
          always_open_pdf_externally: true,
        },
      };

      fs.writeFileSync(
        path.join(tmpDir, "userdir/Default/Preferences"),
        JSON.stringify(defaultPreferences),
      );
      userDataDir = path.join(tmpDir, "userdir");
    }

    let downloadsPath = localBrowserLaunchOptions?.downloadsPath;
    if (!downloadsPath) {
      downloadsPath = path.join(process.cwd(), "downloads");
      fs.mkdirSync(downloadsPath, { recursive: true });
    }

    const context = await chromium.launchPersistentContext(userDataDir, {
      acceptDownloads: localBrowserLaunchOptions?.acceptDownloads ?? true,
      headless: localBrowserLaunchOptions?.headless ?? headless,
      viewport: {
        width: localBrowserLaunchOptions?.viewport?.width ?? 1024,
        height: localBrowserLaunchOptions?.viewport?.height ?? 768,
      },
      locale: localBrowserLaunchOptions?.locale ?? "en-US",
      timezoneId: localBrowserLaunchOptions?.timezoneId ?? "America/New_York",
      deviceScaleFactor: localBrowserLaunchOptions?.deviceScaleFactor ?? 1,
      args: localBrowserLaunchOptions?.args ?? [
        "--disable-blink-features=AutomationControlled",
      ],
      bypassCSP: localBrowserLaunchOptions?.bypassCSP ?? true,
      proxy: localBrowserLaunchOptions?.proxy,
      geolocation: localBrowserLaunchOptions?.geolocation,
      hasTouch: localBrowserLaunchOptions?.hasTouch ?? true,
      ignoreHTTPSErrors: localBrowserLaunchOptions?.ignoreHTTPSErrors ?? true,
      permissions: localBrowserLaunchOptions?.permissions,
      recordHar: localBrowserLaunchOptions?.recordHar,
      recordVideo: localBrowserLaunchOptions?.recordVideo,
      tracesDir: localBrowserLaunchOptions?.tracesDir,
      extraHTTPHeaders: localBrowserLaunchOptions?.extraHTTPHeaders,
      chromiumSandbox: localBrowserLaunchOptions?.chromiumSandbox ?? false,
      devtools: localBrowserLaunchOptions?.devtools ?? false,
      env: localBrowserLaunchOptions?.env,
      executablePath: localBrowserLaunchOptions?.executablePath,
      handleSIGHUP: localBrowserLaunchOptions?.handleSIGHUP ?? true,
      handleSIGINT: localBrowserLaunchOptions?.handleSIGINT ?? true,
      handleSIGTERM: localBrowserLaunchOptions?.handleSIGTERM ?? true,
      ignoreDefaultArgs: localBrowserLaunchOptions?.ignoreDefaultArgs,
    });

    if (localBrowserLaunchOptions?.cookies) {
      context.addCookies(localBrowserLaunchOptions.cookies);
    }
    // This will always be when null launched with chromium.launchPersistentContext, but not when connected over CDP to an existing browser
    const browser = context.browser();

    logger({
      category: "init",
      message: "local browser started successfully.",
    });

    await applyStealthScripts(context);

    return { browser, context, contextPath: userDataDir };
}

async function applyStealthScripts(context: BrowserContext) {
  await context.addInitScript(() => {
    // Override the navigator.webdriver property
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Mock languages and plugins to mimic a real browser
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });

    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3, 4, 5],
    });

    // Remove Playwright-specific properties
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;

    // Redefine the headless property
    Object.defineProperty(navigator, "headless", {
      get: () => false,
    });

    // Override the permissions API
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({
            state: Notification.permission,
          } as PermissionStatus)
        : originalQuery(parameters);
  });
}

export class Stagehand {
  private stagehandPage!: StagehandPage;
  private stagehandContext!: StagehandContext;
  public readonly domSettleTimeoutMs: number;
  public readonly debugDom: boolean;
  public readonly headless: boolean;
  public verbose: 0 | 1 | 2;
  private externalLogger?: (logLine: LogLine) => void;
  public variables: { [key: string]: unknown };
  private contextPath?: string;
  public readonly waitForCaptchaSolves: boolean;
  private localBrowserLaunchOptions?: LocalBrowserLaunchOptions;
  private _browser: Browser | undefined;
  private _isClosed: boolean = false;
  private _livePageProxy?: Page;

  private createLivePageProxy<T extends Page>(): T {
    const proto = Object.getPrototypeOf(this.stagehandPage.page) as object;
    const target = Object.create(proto) as T;

    const handler: ProxyHandler<T> = {
      get: (_t, prop, receiver) => {
        // 优先从 StagehandPage 获取方法
        if (prop in this.stagehandPage) {
          const stagehandValue = Reflect.get(this.stagehandPage, prop, this.stagehandPage);
          return typeof stagehandValue === "function" ? stagehandValue.bind(this.stagehandPage) : stagehandValue;
        }
        // 如果 StagehandPage 没有，则从 Playwright Page 获取
        const real = this.stagehandPage.page as unknown as T;
        const value = Reflect.get(real, prop, receiver);
        return typeof value === "function" ? value.bind(real) : value;
      },
      set: (_t, prop, value) => {
        const real = this.stagehandPage.page as unknown as T;
        Reflect.set(real, prop, value);
        return true;
      },
      has: (_t, prop) => prop in (this.stagehandPage.page as unknown as T),
      getPrototypeOf: () => proto,
    };

    return new Proxy(target, handler);
  }

  protected setActivePage(page: StagehandPage): void {
    this.stagehandPage = page;
  }

  public get page(): Page {
    if (!this.stagehandContext) {
      throw new StagehandNotInitializedError("page");
    }
    if (!this._livePageProxy) {
      this._livePageProxy = this.createLivePageProxy<Page>();
    }
    return this._livePageProxy;
  }



  public get isClosed(): boolean {
    return this._isClosed;
  }


  constructor(
    {
      verbose,
      logger,
      domSettleTimeoutMs,
      localBrowserLaunchOptions,
      waitForCaptchaSolves = false,
    }: ConstructorParams = {},
  ) {
    this.externalLogger = logger || ((logLine: LogLine) => defaultLogger(logLine));
    this.verbose = verbose ?? 0;
    this.domSettleTimeoutMs = domSettleTimeoutMs ?? 30_000;
    this.headless = localBrowserLaunchOptions?.headless ?? false;
    this.waitForCaptchaSolves = waitForCaptchaSolves;
    this.localBrowserLaunchOptions = localBrowserLaunchOptions;

  }


  public get logger(): (logLine: LogLine) => void {
    return (logLine: LogLine) => {
      this.log(logLine);
    };
  }

  public get downloadsPath(): string {
    return this.localBrowserLaunchOptions?.downloadsPath ??
          path.resolve(process.cwd(), "downloads");
  }

  public get context(): EnhancedContext {
    if (!this.stagehandContext) {
      throw new StagehandNotInitializedError("context");
    }
    return this.stagehandContext.context;
  }

  async init(): Promise<InitResult> {
    // Check if running in Bun
    const isRunningInBun = typeof process !== "undefined" && 
      typeof process.versions !== "undefined" && 
      typeof (process.versions as any).bun === "string";
    
    if (isRunningInBun) {
      throw new StagehandError(
        "Playwright does not currently support the Bun runtime environment. " +
          "Please use Node.js instead. For more information, see: " +
          "https://github.com/microsoft/playwright/issues/27139",
      );
    }

    // if (this.usingAPI) {
    //   this.apiClient = new StagehandAPI({
    //     apiKey: this.apiKey,
    //     projectId: this.projectId,
    //     logger: this.logger,
    //   });

    //   const modelApiKey = this.modelClientOptions?.apiKey;
    //   const { sessionId, available } = await this.apiClient.init({
    //     modelName: this.modelName,
    //     modelApiKey: modelApiKey,
    //     domSettleTimeoutMs: this.domSettleTimeoutMs,
    //     verbose: this.verbose,
    //     debugDom: this.debugDom,
    //     systemPrompt: this.userProvidedInstructions,
    //     selfHeal: this.selfHeal,
    //     waitForCaptchaSolves: this.waitForCaptchaSolves,
    //     actionTimeoutMs: this.actTimeoutMs,
    //     browserbaseSessionCreateParams: this.browserbaseSessionCreateParams,
    //     browserbaseSessionID: this.browserbaseSessionID,
    //   });
    //   if (!available) {
    //     this.apiClient = null;
    //   }
    //   this.browserbaseSessionID = sessionId;
    // }

    const { browser, context, contextPath } =
      await getBrowser(
        this.headless,
        this.logger,
        this.localBrowserLaunchOptions,
      ).catch((e) => {
        console.error("Error in init:", e);
        const br: BrowserResult = {
          context: undefined,
        };
        return br;
      });
    this.contextPath = contextPath;
    this._browser = browser;
    if (!context) {
      const errorMessage =
        "The browser context is undefined. This means the CDP connection to the browser failed";
      throw new StagehandInitError(errorMessage);
    }
    this.stagehandContext = await StagehandContext.init(context, this);

    const defaultPage = (await this.stagehandContext.getStagehandPages())[0];
    this.stagehandPage = defaultPage;

    if (this.headless) {
      await this.page.setViewportSize({ width: 1280, height: 720 });
    }

    const guardedScript = `
  if (!window.__stagehandInjected) {
    window.__stagehandInjected = true;
    ${scriptContent}
  }
`;
    await this.context.addInitScript({
      content: guardedScript,
    });

    const session = await this.context.newCDPSession(this.page);
    await session.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: this.downloadsPath,
      eventsEnabled: true,
    });

    return { debugUrl: undefined, sessionUrl: undefined, sessionId: undefined };
  }

  log(logObj: LogLine): void {
    logObj.level = logObj.level ?? 1;
    console.log(logObj.message);
  }

  async close(): Promise<void> {
    this._isClosed = true;
    // if (this.apiClient) {
    //   const response = await this.apiClient.end();
    //   const body: ApiResponse<unknown> = await response.json();
    //   if (!body.success) {
    //     if (response.status == 409) {
    //       this.log({
    //         category: "close",
    //         message:
    //           "Warning: attempted to end a session that is not currently active",
    //         level: 0,
    //       });
    //     } else {
    //       throw new StagehandError((body as ErrorResponse).message);
    //     }
    //   }
    //   this.apiClient = null;
    //   return;
    // }
    await this.context.close();
    if (this._browser) {
      await this._browser.close();
    }

    if (
      this.contextPath &&
      !this.localBrowserLaunchOptions?.preserveUserDataDir
    ) {
      try {
        fs.rmSync(this.contextPath, { recursive: true, force: true });
      } catch (e) {
        console.error("Error deleting context directory:", e);
      }
    }
  }


}

export * from "../types/browser";
export * from "../types/log";
export * from "../types/page";
export * from "../types/playwright";
export * from "../types/stagehand";
export * from "../types/stagehandErrors";
