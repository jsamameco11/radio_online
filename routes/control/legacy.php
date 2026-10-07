<?php

use App\Http\Controllers\Control\MovedStudioController;
use Illuminate\Support\Facades\Route;

/*
| Studios used to live in /estudio/{frequency} of the control host. Saved
| links and old e-mails keep working: they move permanently to the console.
*/

Route::get('/estudio/{path?}', MovedStudioController::class)->where('path', '.*')->name('control.moved-studio');
