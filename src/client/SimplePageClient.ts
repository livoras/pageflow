export interface PageInfo {
  id: string;
  name: string;
  description?: string;
  url: string;
  createdAt: string;
  consoleLogPath?: string;
  title?: string;
}

export interface HealthStatus {
  status: string;
  pages: number;
  browserConnected: boolean;
}

export interface ActionResponse {
  success: boolean;
  error?: string;
}

export interface NavigateResponse extends ActionResponse {
  url?: string;
}

export interface StructureResponse {
  structure: string;
  htmlPath: string;
  actionsPath: string;
  consoleLogPath: string;
}

export interface XPathResponse {
  xpath: string;
}

export interface ConditionResponse {
  matched: boolean;
}

export interface PageOptions {
  timeout?: number;
  description?: string;
  recordActions?: boolean;
}

class Page {
  constructor(
    private client: SimplePageClient,
    public readonly id: string,
    public readonly info: PageInfo
  ) {}

  async navigate(url: string, options?: PageOptions): Promise<NavigateResponse> {
    return this.client.navigate(this.id, url, options);
  }

  async click(xpath: string, description?: string): Promise<ActionResponse> {
    return this.client.clickByXPath(this.id, xpath, description);
  }

  async clickById(encodedId: string, description?: string): Promise<ActionResponse> {
    return this.client.clickById(this.id, encodedId, description);
  }

  async fill(xpath: string, text: string, description?: string): Promise<ActionResponse> {
    return this.client.fillByXPath(this.id, xpath, text, description);
  }

  async fillById(encodedId: string, text: string, description?: string): Promise<ActionResponse> {
    return this.client.fillById(this.id, encodedId, text, description);
  }

  async type(xpath: string, text: string, description?: string): Promise<ActionResponse> {
    return this.fill(xpath, text, description);
  }

  async typeById(encodedId: string, text: string, description?: string): Promise<ActionResponse> {
    return this.fillById(encodedId, text, description);
  }

  async wait(timeout: number, description?: string): Promise<ActionResponse> {
    return this.client.wait(this.id, timeout, description);
  }

  async checkCondition(pattern: string | RegExp, flags?: string, description?: string): Promise<ConditionResponse> {
    return this.client.checkCondition(this.id, pattern, flags, description);
  }

  async getStructure(selector?: string): Promise<StructureResponse> {
    return this.client.getStructure(this.id, selector);
  }

  async getXPath(encodedId: string): Promise<XPathResponse> {
    return this.client.getXPath(this.id, encodedId);
  }

  async screenshot(): Promise<Buffer> {
    return this.client.screenshot(this.id);
  }

  async close(): Promise<ActionResponse> {
    return this.client.closePage(this.id);
  }
}

export class SimplePageClient {
  constructor(private baseUrl: string = 'http://localhost:3100') {}

  private async request(path: string, options?: RequestInit): Promise<any> {
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers || {})
        }
      });

      // Check content type before reading body
      const contentType = response.headers.get('content-type');
      
      // Handle binary responses (like screenshots)
      if (contentType?.includes('image/png')) {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }

      // Handle text/json responses
      const text = await response.text();
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      return text ? JSON.parse(text) : {};
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Request failed: ${String(error)}`);
    }
  }

  // Health check
  async health(): Promise<HealthStatus> {
    return this.request('/health');
  }

  // Page management
  async createPage(name: string, url: string, options?: PageOptions): Promise<Page> {
    const body = {
      name,
      url,
      description: options?.description,
      timeout: options?.timeout || 10000,
      recordActions: options?.recordActions !== false // Default to true
    };
    
    const pageInfo: PageInfo = await this.request('/api/pages', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    
    return new Page(this, pageInfo.id, pageInfo);
  }

  async listPages(): Promise<PageInfo[]> {
    return this.request('/api/pages');
  }

  async getPageInfo(pageId: string): Promise<PageInfo> {
    return this.request(`/api/pages/${pageId}`);
  }

  async getPage(pageId: string): Promise<Page> {
    const info = await this.getPageInfo(pageId);
    return new Page(this, pageId, info);
  }

  async closePage(pageId: string): Promise<ActionResponse> {
    return this.request(`/api/pages/${pageId}`, {
      method: 'DELETE'
    });
  }

  // Navigation
  async navigate(pageId: string, url: string, options?: PageOptions): Promise<NavigateResponse> {
    const body = {
      url,
      timeout: options?.timeout || 30000,
      description: options?.description
    };
    
    return this.request(`/api/pages/${pageId}/navigate`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  // Actions by XPath
  async actByXPath(pageId: string, xpath: string, method: string, args: any[] = [], description?: string): Promise<ActionResponse> {
    const body = { xpath, method, args, description };
    
    return this.request(`/api/pages/${pageId}/act-xpath`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async clickByXPath(pageId: string, xpath: string, description?: string): Promise<ActionResponse> {
    return this.actByXPath(pageId, xpath, 'click', [], description);
  }

  async fillByXPath(pageId: string, xpath: string, value: string, description?: string): Promise<ActionResponse> {
    return this.actByXPath(pageId, xpath, 'fill', [value], description);
  }

  // Actions by EncodedId
  async actById(pageId: string, encodedId: string, method: string, args: any[] = [], description?: string): Promise<ActionResponse> {
    const body = { encodedId, method, args, description };
    
    return this.request(`/api/pages/${pageId}/act-id`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  async clickById(pageId: string, encodedId: string, description?: string): Promise<ActionResponse> {
    return this.actById(pageId, encodedId, 'click', [], description);
  }

  async fillById(pageId: string, encodedId: string, value: string, description?: string): Promise<ActionResponse> {
    return this.actById(pageId, encodedId, 'fill', [value], description);
  }

  // Wait
  async wait(pageId: string, timeout: number, description?: string): Promise<ActionResponse> {
    const body = { timeout, description };
    
    return this.request(`/api/pages/${pageId}/wait`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  // Condition check
  async checkCondition(pageId: string, pattern: string | RegExp, flags?: string, description?: string): Promise<ConditionResponse> {
    const body = { 
      pattern: pattern instanceof RegExp ? pattern.source : pattern,
      flags: flags || (pattern instanceof RegExp ? pattern.flags : undefined),
      description 
    };
    
    return this.request(`/api/pages/${pageId}/condition`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  // Structure and XPath
  async getStructure(pageId: string, selector?: string): Promise<StructureResponse> {
    const params = selector ? `?selector=${encodeURIComponent(selector)}` : '';
    return this.request(`/api/pages/${pageId}/structure${params}`);
  }

  async getXPath(pageId: string, encodedId: string): Promise<XPathResponse> {
    return this.request(`/api/pages/${pageId}/xpath/${encodedId}`);
  }

  // Screenshot
  async screenshot(pageId: string): Promise<Buffer> {
    return this.request(`/api/pages/${pageId}/screenshot`);
  }

  // Replay actions
  async replay(actions: any[], options?: {
    delay?: number;
    verbose?: boolean;
    continueOnError?: boolean;
  }): Promise<any> {
    const body = {
      actions,
      options: options || {}
    };
    
    return this.request('/api/replay', {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }
}