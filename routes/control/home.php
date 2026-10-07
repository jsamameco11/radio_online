<?php

use App\Http\Controllers\Control\ControlHomeController;
use Illuminate\Support\Facades\Route;

Route::get('/', ControlHomeController::class)->name('control.home');
