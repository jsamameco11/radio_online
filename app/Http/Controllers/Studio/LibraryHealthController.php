<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Jobs\CheckLibraryFiles;
use Illuminate\Http\RedirectResponse;

/** Starts a check of every file of the library. */
class LibraryHealthController extends Controller
{
    public function __invoke(CurrentStation $current): RedirectResponse
    {
        CheckLibraryFiles::dispatch((int) $current->id());

        return back()->with('success', 'Estamos revisando los archivos de la biblioteca. Los audios con problemas aparecerán en «Por revisar».');
    }
}
