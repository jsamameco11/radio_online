<?php

use App\Http\Controllers\Webhooks\StripeWebhookController;
use Illuminate\Support\Facades\Route;

/*
| Payment provider notifications: no session and no CSRF token; every
| request is authenticated by its signature instead.
*/

Route::post('/webhooks/stripe', StripeWebhookController::class)->name('webhooks.stripe');
