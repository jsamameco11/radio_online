<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Frequencies\Actions\ExpandDial;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\ExpandDialRequest;
use App\Http\Resources\Admin\AuditLogResource;
use App\Models\AuditLog;
use App\Models\Frequency;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Frecuencias > Ampliar el dial (500 → 1000 → …) without moving any station. */
class DialController extends Controller
{
    public function create(Request $request): Response
    {
        return Inertia::render('Admin/Frequencies/Expand', [
            'current' => Frequency::query()->count(),
            'configured' => (int) config('platform.dial.size'),
            'capacity' => ExpandDial::capacity(),
            'band' => ['min' => (float) config('platform.dial.min'), 'max' => (float) config('platform.dial.max')],
            'history' => AuditLog::query()
                ->where('action', 'dial.expanded')
                ->with(['actor', 'station.frequency'])
                ->latest('created_at')
                ->limit(10)
                ->get()
                ->map(fn (AuditLog $log) => AuditLogResource::make($log)->resolve($request))
                ->all(),
        ]);
    }

    public function store(ExpandDialRequest $request, ExpandDial $expand): RedirectResponse
    {
        $size = (int) $request->validated('size');
        $created = $expand->handle($size, $request->user());

        return redirect()->route('admin.frequencies.index')
            ->with('success', "El dial ahora tiene {$size} frecuencias: sumamos {$created} nuevas.");
    }
}
