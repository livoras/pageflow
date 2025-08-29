import Browserbase from "@browserbasehq/sdk";
import { LogLine } from "./log";

export interface ConstructorParams {
  env: "LOCAL" | "BROWSERBASE";
  apiKey?: string;
  projectId?: string;
  verbose?: 0 | 1 | 2;
  logger?: (message: LogLine) => void | Promise<void>;
  domSettleTimeoutMs?: number;
  browserbaseSessionCreateParams?: Browserbase.Sessions.SessionCreateParams;
  browserbaseSessionID?: string;
  localBrowserLaunchOptions?: LocalBrowserLaunchOptions;
  headless?: boolean;
}

export interface InitResult {
  debugUrl: string;
  sessionUrl: string;
  sessionId: string;
}

// Simplified - removed AI-related options
export interface ActOptions {
  action: string;
  domSettleTimeoutMs?: number;
  timeoutMs?: number;
}

export interface ActResult {
  success: boolean;
  message: string;
  action: string;
}

export interface ExtractOptions<T> {
  instruction?: string;
  schema?: T;
  domSettleTimeoutMs?: number;
  selector?: string;
}

export type ExtractResult<T> = any;

export interface ObserveOptions {
  instruction?: string;
  domSettleTimeoutMs?: number;
  returnAction?: boolean;
}

export interface ObserveResult {
  selector: string;
  description: string;
  backendNodeId?: number;
  method?: string;
  arguments?: string[];
}

export interface LocalBrowserLaunchOptions {
  args?: string[];
  chromiumSandbox?: boolean;
  devtools?: boolean;
  env?: Record<string, string | number | boolean>;
  executablePath?: string;
  handleSIGHUP?: boolean;
  handleSIGINT?: boolean;
  handleSIGTERM?: boolean;
  headless?: boolean;
  ignoreDefaultArgs?: boolean | Array<string>;
  proxy?: {
    server: string;
    bypass?: string;
    username?: string;
    password?: string;
  };
  tracesDir?: string;
  userDataDir?: string;
  preserveUserDataDir?: boolean;
  acceptDownloads?: boolean;
  downloadsPath?: string;
  extraHTTPHeaders?: Record<string, string>;
  geolocation?: { latitude: number; longitude: number; accuracy?: number };
  hasTouch?: boolean;
  ignoreHTTPSErrors?: boolean;
  locale?: string;
  permissions?: Array<string>;
  recordHar?: {
    omitContent?: boolean;
    content?: "omit" | "embed" | "attach";
    path: string;
    mode?: "full" | "minimal";
    urlFilter?: string | RegExp;
  };
  recordVideo?: {
    dir: string;
    size?: { width: number; height: number };
  };
  storageState?: string | any;
  strictSelectors?: boolean;
  timezoneId?: string;
  userAgent?: string;
  viewport?: { width: number; height: number } | null;
  javaScriptEnabled?: boolean;
  bypassCSP?: boolean;
  offline?: boolean;
  screenshot?: "on" | "off" | "only-on-failure";
  video?: "on" | "off" | "retain-on-failure" | "on-first-retry";
}

export type ActionConditionProps = {
  expectedOutputs?: string[];
  skipActionConditions?: boolean;
  customMessage?: string;
};

// Minimal definitions for compatibility
export interface AgentConfig {}
export interface HistoryEntry {
  role?: string;
  content?: string;
  method?: string;
}

export type StagehandFunctionName = "getPageStructure" | "actByEncodedId";

export interface StagehandMetrics {
  functionCalls: Record<StagehandFunctionName, number>;
  elapsedTime: number;
}