import { handleAndReturnErrorResponse } from "@/lib/api/errors";
import { verifyQstashSignature } from "@/lib/cron/verify-qstash";
import { firstPromoterImportPayloadSchema } from "@/lib/firstpromoter/schemas";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (process.env.VERCEL) {
    return new Response("Skipping cron job on Vercel build", { status: 200 });
  }
  try {
    const rawBody = await req.text();

    await verifyQstashSignature({
      req,
      rawBody,
    });

    const payload = firstPromoterImportPayloadSchema.parse(JSON.parse(rawBody));

    switch (payload.action) {
      case "import-campaigns":
        const { importCampaigns } = await import(
          "@/lib/firstpromoter/import-campaigns"
        );
        await importCampaigns(payload);
        break;
      case "import-partners":
        const { importPartners } = await import(
          "@/lib/firstpromoter/import-partners"
        );
        await importPartners(payload);
        break;
      case "import-customers":
        const { importCustomers } = await import(
          "@/lib/firstpromoter/import-customers"
        );
        await importCustomers(payload);
        break;
      case "import-commissions":
        const { importCommissions } = await import(
          "@/lib/firstpromoter/import-commissions"
        );
        await importCommissions(payload);
        break;
      case "update-stripe-customers":
        const { updateStripeCustomers } = await import(
          "@/lib/firstpromoter/update-stripe-customers"
        );
        await updateStripeCustomers(payload);
        break;
      default:
        throw new Error(`Unknown action: ${payload.action}`);
    }

    return NextResponse.json("OK");
  } catch (error) {
    return handleAndReturnErrorResponse(error);
  }
}
