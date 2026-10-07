<?php

use App\Http\Controllers\Studio\StudioHomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', StudioHomeController::class)->name('studio.home');
