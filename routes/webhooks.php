<?php

use App\Http\Controllers\Webhooks\CulqiWebhookController;
use Illuminate\Support\Facades\Route;

/*
| Payment provider notifications: no session and no CSRF token. They are
| never trusted as such: each one is checked against the provider's API.
*/

Route::post('/webhooks/culqi', CulqiWebhookController::class)
    ->middleware('throttle:60,1')
    ->name('webhooks.culqi');
