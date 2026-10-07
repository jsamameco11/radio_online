<?php

namespace App\Http\Controllers\Webhooks;

use App\Domain\Payments\StripeWebhook;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Exception\SignatureVerificationException;
use UnexpectedValueException;

/** POST /webhooks/stripe: only payloads signed with STRIPE_WEBHOOK_SECRET are applied. */
class StripeWebhookController extends Controller
{
    public function __invoke(Request $request, StripeWebhook $webhook): JsonResponse
    {
        if (! StripeWebhook::isConfigured()) {
            return response()->json(['message' => 'Webhook not configured.'], 503);
        }

        try {
            $webhook->handle($request->getContent(), (string) $request->header('Stripe-Signature'));
        } catch (SignatureVerificationException|UnexpectedValueException) {
            return response()->json(['message' => 'Invalid payload or signature.'], 400);
        }

        return response()->json(['received' => true]);
    }
}
