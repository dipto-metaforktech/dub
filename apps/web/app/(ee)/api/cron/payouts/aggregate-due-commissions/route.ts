import { handleAndReturnErrorResponse } from "@/lib/api/errors";
import { verifyQstashSignature } from "@/lib/cron/verify-qstash";
import { verifyVercelSignature } from "@/lib/cron/verify-vercel";
import { log } from "@dub/utils";
import { logAndRespond } from "../../utils";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 1000;

// This cron job aggregates due commissions (pending commissions that are past the program holding period) into payouts.
// Runs once every hour (0 * * * *) + calls itself recursively to look through all pending commissions available.
async function handler(req: Request) {
  if (process.env.VERCEL) {
    return new Response("Skipping cron job on Vercel build", { status: 200 });
  }
  try {
    if (req.method === "GET") {
      await verifyVercelSignature(req);
    } else if (req.method === "POST") {
      const rawBody = await req.text();
      await verifyQstashSignature({
        req,
        rawBody,
      });
    }

    const { BATCH_SIZE, default: run } = await import("./run");

    await run();

    return logAndRespond(
      "Finished aggregating due commissions into payouts for all batches.",
    );
  } catch (error) {
    await log({
      message: `Error aggregating due commissions into payouts: ${error.message}`,
      type: "errors",
      mention: true,
    });
    return handleAndReturnErrorResponse(error);
  }
}

// GET/POST /api/cron/payouts/aggregate-due-commissions
export { handler as GET, handler as POST };
