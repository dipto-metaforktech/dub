// logger.ts
import {
  AxiomJSTransport,
  ConsoleTransport,
  Logger,
  LogLevel,
} from "@axiomhq/logging";
import {
  createAxiomRouteHandler,
  nextJsFormatters,
  transformRouteHandlerSuccessResult,
} from "@axiomhq/nextjs";
import { getSearchParams } from "@dub/utils";
import { getAxiomClient } from "./axiom";

// Load client safely
const axiomClient = getAxiomClient();

const isAxiomEnabled =
  Boolean(process.env.AXIOM_DATASET) && Boolean(axiomClient);

const getLogLevelFromStatusCode = (statusCode: number) => {
  if (statusCode >= 100 && statusCode < 400) {
    return LogLevel.info;
  } else if (statusCode >= 400 && statusCode < 500) {
    return LogLevel.warn;
  } else if (statusCode >= 500) {
    return LogLevel.error;
  }

  return LogLevel.info;
};

export const logger = new Logger({
  transports: isAxiomEnabled
    ? [
        new AxiomJSTransport({
          axiom: axiomClient!,
          dataset: process.env.AXIOM_DATASET!,
        }),
      ]
    : [new ConsoleTransport()],
  formatters: nextJsFormatters,
});

export const withAxiomBodyLog = createAxiomRouteHandler(logger, {
  onSuccess: async (data) => {
    const [message, report] = transformRouteHandlerSuccessResult(data);

    // Add body if POST, PATCH, PUT
    if (["POST", "PATCH", "PUT"].includes(data.req.method)) {
      try {
        report.body = await data.req.json();
      } catch {
        // Ignore empty/invalid bodies
      }
    }

    // Add search params
    report.searchParams = getSearchParams(data.req.url);

    logger.log(getLogLevelFromStatusCode(data.res.status), message, report);
    await logger.flush();
  },
});

export const withAxiom = createAxiomRouteHandler(logger);
