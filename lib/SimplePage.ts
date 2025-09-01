import type { CDPSession, Page as PlaywrightPage, Frame } from "playwright";
import { selectors } from "playwright";
import { scriptContent } from "./dom/build/scriptContent";
import type { Protocol } from "devtools-protocol";

async function getCurrentRootFrameId(session: CDPSession): Promise<string> {
  const { frameTree } = (await session.send(
    "Page.getFrameTree",
  )) as Protocol.Page.GetFrameTreeResponse;
  return frameTree.frame.id;
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

  public get frameId(): string {
    return this.rootFrameId;
  }

  public updateRootFrameId(newId: string): void {
    this.rootFrameId = newId;
  }

  constructor(page: PlaywrightPage) {
    this.page = page;
    this.logger = (info: any) => {
      if (info.level === 1) {
        console.error(info.message);
      } else if (info.level === 2) {
        console.warn(info.message);
      } else {
        console.log(info.message || '');
      }
    };
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

  private async ensureStagehandScript(): Promise<void> {
    try {
      const injected = await this.page.evaluate(
        () => !!window.__stagehandInjected,
      );

      if (injected) return;

      const guardedScript = `if (!window.__stagehandInjected) { \
window.__stagehandInjected = true; \
${scriptContent} \
}`;

      await this.page.addInitScript({ content: guardedScript });
      await this.page.evaluate(guardedScript);
    } catch (err) {
      console.error("Failed to inject Stagehand helper script", err);
      throw err;
    }
  }

  /** Register the custom selector engine that pierces open/closed shadow roots. */
  private async ensureStagehandSelectorEngine(): Promise<void> {
    const registerFn = () => {
      type Backdoor = {
        getClosedRoot?: (host: Element) => ShadowRoot | undefined;
      };

      function parseSelector(input: string): { name: string; value: string } {
        // Accept either:  "abc123"  → uses DEFAULT_ATTR
        // or explicitly:  "data-__stagehand-id=abc123"
        const raw = input.trim();
        const eq = raw.indexOf("=");
        if (eq === -1) {
          return {
            name: "data-__stagehand-id",
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
        const backdoor = window.__stagehand__ as Backdoor | undefined;
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
      await selectors.register("stagehand", registerFn);
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

      // Ensure selector engine and scripts are ready
      await this.ensureStagehandSelectorEngine();
      await this.ensureStagehandScript();

      this.initialized = true;
      return this;
    } catch (err: unknown) {
      console.error("Failed to initialize SimplePage", err);
      throw err;
    }
  }


  // 直接获取页面的 Accessibility Tree（无需 AI）
  public async getPageStructure(selector?: string) {
    const { getAccessibilityTree } = require("./a11y/utils");
    
    const result = await getAccessibilityTree(
      false, // experimental
      this,
      this.logger,
      selector,
      undefined // targetFrame
    );
    
    // 保存 xpathMap 供后续操作使用
    (global as any).__stagehand_xpath_map = result.xpathMap;
    (global as any).__stagehand_current_page = this;
    
    return {
      simplified: result.simplified,
      xpathMap: result.xpathMap,
      idToUrl: result.idToUrl,
      tree: result.tree
    };
  }

  // 直接通过 XPath 操作元素
  public async actByXPath(xpath: string, method: string, args: string[] = []): Promise<void> {
    // 使用 evaluate 直接操作 DOM，避免 Playwright 的 __name 错误
    if (method === 'fill' && args[0]) {
      await this.page.evaluate(({ xpath, value }) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLInputElement;
        if (element) {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { xpath, value: args[0] });
    } else if (method === 'click') {
      await this.page.evaluate(({ xpath }) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLElement;
        if (element && typeof element.click === 'function') {
          element.click();
        } else if (element) {
          // Fallback for elements that don't have a click method
          const event = new MouseEvent('click', { bubbles: true, cancelable: true });
          element.dispatchEvent(event);
        }
      }, { xpath });
    } else if (method === 'select' && args[0]) {
      await this.page.evaluate(({ xpath, value }) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLSelectElement;
        if (element) {
          element.value = value;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { xpath, value: args[0] });
    } else if (method === 'check') {
      await this.page.evaluate(({ xpath }) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLInputElement;
        if (element && !element.checked) {
          element.checked = true;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { xpath });
    } else if (method === 'uncheck') {
      await this.page.evaluate(({ xpath }) => {
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const element = result.singleNodeValue as HTMLInputElement;
        if (element && element.checked) {
          element.checked = false;
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, { xpath });
    } else {
      throw new Error(`Unsupported method: ${method}`);
    }
  }

  // 通过 EncodedId 操作元素（内部调用 actByXPath）
  public async actByEncodedId(encodedId: string, method: string, args: string[] = []): Promise<void> {
    const xpathMap = (global as any).__stagehand_xpath_map;
    if (!xpathMap) {
      throw new Error("XPath map not available. Run getPageStructure first.");
    }
    
    const xpath = xpathMap[encodedId];
    if (!xpath) {
      throw new Error(`No XPath found for EncodedId: ${encodedId}`);
    }
    
    return this.actByXPath(xpath, method, args);
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
   *   7.  A global guard (`timeoutMs` or `stagehand.domSettleTimeoutMs`,
   *       default ≈ 30 s) ensures we always resolve; if it fires we log how many
   *       requests were still outstanding.
   *
   * @param timeoutMs – Optional hard cap (ms).  Defaults to
   *                    `this.stagehand.domSettleTimeoutMs`.
   */
  public async _waitForSettledDom(timeoutMs?: number): Promise<void> {
    const timeout = timeoutMs ?? 30000;  // Default 30 seconds
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
