import { ZodError } from "zod/v3";

export class StagehandError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class StagehandDefaultError extends StagehandError {
  constructor(error?: unknown) {
    if (error instanceof Error || error instanceof StagehandError) {
      super(
        `\nHey! We're sorry you ran into an error. \nIf you need help, please open a Github issue or reach out to us on Slack: https://stagehand.dev/slack\n\nFull error:\n${error.message}`,
      );
    }
  }
}


export class StagehandNotInitializedError extends StagehandError {
  constructor(prop: string) {
    super(
      `You seem to be calling \`${prop}\` on a page in an uninitialized \`Stagehand\` object. ` +
        `Ensure you are running \`await stagehand.init()\` on the Stagehand object before ` +
        `referencing the \`page\` object.`,
    );
  }
}


export class StagehandInvalidArgumentError extends StagehandError {
  constructor(message: string) {
    super(`InvalidArgumentError: ${message}`);
  }
}

export class StagehandElementNotFoundError extends StagehandError {
  constructor(xpaths: string[]) {
    super(`Could not find an element for the given xPath(s): ${xpaths}`);
  }
}


export class StagehandDomProcessError extends StagehandError {
  constructor(message: string) {
    super(`Error Processing Dom: ${message}`);
  }
}

export class StagehandClickError extends StagehandError {
  constructor(message: string, selector: string) {
    super(
      `Error Clicking Element with selector: ${selector} Reason: ${message}`,
    );
  }
}


export class StagehandIframeError extends StagehandError {
  constructor(frameUrl: string, message: string) {
    super(
      `Unable to resolve frameId for iframe with URL: ${frameUrl} Full error: ${message}`,
    );
  }
}

export class ContentFrameNotFoundError extends StagehandError {
  constructor(selector: string) {
    super(`Unable to obtain a content frame for selector: ${selector}`);
  }
}

export class XPathResolutionError extends StagehandError {
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

export class StagehandInitError extends StagehandError {
  constructor(message: string) {
    super(message);
  }
}

export class StagehandShadowRootMissingError extends StagehandError {
  constructor(detail?: string) {
    super(
      `No shadow root present on the resolved host` +
        (detail ? `: ${detail}` : ""),
    );
  }
}

export class StagehandShadowSegmentEmptyError extends StagehandError {
  constructor() {
    super(`Empty selector segment after shadow-DOM hop ("//")`);
  }
}

export class StagehandShadowSegmentNotFoundError extends StagehandError {
  constructor(segment: string, hint?: string) {
    super(
      `Shadow segment '${segment}' matched no element inside shadow root` +
        (hint ? ` ${hint}` : ""),
    );
  }
}
