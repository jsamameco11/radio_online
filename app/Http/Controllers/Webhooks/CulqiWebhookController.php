<?php

namespace App\Http\Controllers\Webhooks;

use App\Domain\Payments\CulqiWebhook;
use App\Domain\Payments\Exceptions\ChargePending;
use App\Domain\Payments\Exceptions\PaymentUnavailable;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/** POST /webhooks/culqi: Culqi retries any answer other than 2xx. */
class CulqiWebhookController extends Controller
{
    public function __invoke(Request $request, CulqiWebhook $webhook): Response
    {
        try {
            $webhook->handle($request->json()->all());
        } catch (PaymentUnavailable) {
            return response('Culqi no está configurado.', 503);
        } catch (ChargePending) {
            return response('Culqi no respondió; reintenta.', 503);
        }

        return response('OK');
    }
}
