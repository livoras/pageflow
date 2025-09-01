import { ZodError } from "zod/v3";

export class SimplePageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class SimplePageDefaultError extends SimplePageError {
  constructor(error?: unknown) {
    if (error instanceof Error || error instanceof SimplePageError) {
      super(
        `\nHey! We're sorry you ran into an error. \nIf you need help, please open a Github issue.\n\nFull error:\n${error.message}`,
      );
    }
  }
}


export class SimplePageNotInitializedError extends SimplePageError {
  constructor(prop: string) {
    super(
      `You seem to be calling \`${prop}\` on a page in an uninitialized \`SimplePage\` object. ` +
        `Ensure you are running \`await simplePage.init()\` on the SimplePage object before ` +
        `referencing the \`page\` object.`,
    );
  }
}


export class SimplePageInvalidArgumentError extends SimplePageError {
  constructor(message: string) {
    super(`InvalidArgumentError: ${message}`);
  }
}

export class SimplePageElementNotFoundError extends SimplePageError {
  constructor(xpaths: string[]) {
    super(`Could not find an element for the given xPath(s): ${xpaths}`);
  }
}


export class SimplePageDomProcessError extends SimplePageError {
  constructor(message: string) {
    super(`Error Processing Dom: ${message}`);
  }
}

export class SimplePageClickError extends SimplePageError {
  constructor(message: string, selector: string) {
    super(
      `Error Clicking Element with selector: ${selector} Reason: ${message}`,
    );
  }
}


export class SimplePageIframeError extends SimplePageError {
  constructor(frameUrl: string, message: string) {
    super(
      `Unable to resolve frameId for iframe with URL: ${frameUrl} Full error: ${message}`,
    );
  }
}

export class ContentFrameNotFoundError extends SimplePageError {
  constructor(selector: string) {
    super(`Unable to obtain a content frame for selector: ${selector}`);
  }
}

export class XPathResolutionError extends SimplePageError {
  constructor(xpath: string) {
    super(`XPath "${xpath}" does not resolve in the current page or frames`);
  }
}


export class ZodSchemaValidationError extends Error {
  constructor(
    public readonly received: unknown,
    public readonly issues: ReturnType<ZodError["format"]>,
  ) {
    super(`Zod schema validation failed

— Received —
${JSON.stringify(received, null, 2)}

— Issues —
${JSON.stringify(issues, null, 2)}`);
    this.name = "ZodSchemaValidationError";
  }
}

export class SimplePageInitError extends SimplePageError {
  constructor(message: string) {
    super(message);
  }
}

export class SimplePageShadowRootMissingError extends SimplePageError {
  constructor(detail?: string) {
    super(
      `No shadow root present on the resolved host` +
        (detail ? `: ${detail}` : ""),
    );
  }
}

export class SimplePageShadowSegmentEmptyError extends SimplePageError {
  constructor() {
    super(`Empty selector segment after shadow-DOM hop ("//")`);
  }
}

export class SimplePageShadowSegmentNotFoundError extends SimplePageError {
  constructor(segment: string, hint?: string) {
    super(
      `Shadow segment '${segment}' matched no element inside shadow root` +
        (hint ? ` ${hint}` : ""),
    );
  }
}
