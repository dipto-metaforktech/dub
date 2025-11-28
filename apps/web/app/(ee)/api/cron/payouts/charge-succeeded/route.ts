import { z } from "zod";

export const dynamic = "force-dynamic";
export const maxDuration = 600; // This function can run for a maximum of 10 minutes

const payloadSchema = z.object({
  invoiceId: z.string(),
});

// POST /api/cron/payouts/charge-succeeded
// This route is used to process the charge-succeeded event from Stripe.
// We're intentionally offloading this to a cron job so we can return a 200 to Stripe immediately.
export async function POST(req: Request) {
  if (process.env.VERCEL) {
    return new Response("Skipping cron job on Vercel build", { status: 200 });
  }
  const { handleAndReturnErrorResponse } = await import(
    "@/lib/api/errors"
  );
  const { verifyQstashSignature } = await import(
    "@/lib/cron/verify-qstash"
  );
  const { prisma } = await import("@dub/prisma");
  const { log } = await import("@dub/utils");
  const { logAndRespond } = await import("../../utils");
  const { queueExternalPayouts } = await import(
    "./queue-external-payouts"
  );
  const { queueStripePayouts } = await import("./queue-stripe-payouts");
  const { sendPaypalPayouts } = await import("./send-paypal-payouts");

  try {
    const rawBody = await req.text();
    await verifyQstashSignature({ req, rawBody });

    const { invoiceId } = payloadSchema.parse(JSON.parse(rawBody));

    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
      },
      include: {
        _count: {
          select: {
            payouts: {
              where: {
                status: "processing",
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return logAndRespond(`Invoice ${invoiceId} not found.`);
    }

    if (invoice._count.payouts === 0) {
      return logAndRespond(
        `No payouts found with status 'processing' for invoice ${invoiceId}, skipping...`,
      );
    }

    await Promise.allSettled([
      // Queue Stripe payouts
      queueStripePayouts(invoice),
      // Send PayPal payouts
      sendPaypalPayouts(invoice),
      // Queue external payouts
      queueExternalPayouts(invoice),
    ]);

    return logAndRespond(
      `Completed processing all payouts for invoice ${invoiceId}.`,
    );
  } catch (error) {
    await log({
      message: `Error sending payouts for invoice: ${error.message}`,
      type: "cron",
    });

    return handleAndReturnErrorResponse(error);
  }
}
