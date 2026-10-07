<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Platform\PlatformSettings;
use App\Domain\Streaming\Enums\MonitorStatus;
use App\Domain\Streaming\Monitor\StreamMonitor;
use App\Http\Controllers\Controller;
use App\Models\Frequency;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Real-time monitor of every frequency of the dial. The page subscribes to
 * "control.monitor" (MonitorUpdated) and polls the JSON snapshot as a fallback.
 */
class MonitorController extends Controller
{
    public function index(StreamMonitor $monitor, PlatformSettings $settings): Response
    {
        return Inertia::render('Admin/Monitor', [
            'cells' => $monitor->cells(),
            'statuses' => collect(MonitorStatus::cases())
                ->map(fn (MonitorStatus $status) => ['value' => $status->value, 'label' => $status->label()])
                ->all(),
            'band' => ['min' => (float) config('platform.dial.min'), 'max' => (float) config('platform.dial.max')],
            'staleSeconds' => (int) $settings->get('stale_heartbeat_seconds'),
            'generatedAt' => now()->toIso8601String(),
        ]);
    }

    public function cells(StreamMonitor $monitor): JsonResponse
    {
        return response()->json(['cells' => $monitor->cells(), 'generated_at' => now()->toIso8601String()]);
    }

    public function show(Frequency $frequency, StreamMonitor $monitor): JsonResponse
    {
        return response()->json($monitor->detail($frequency));
    }
}
