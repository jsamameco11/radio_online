<?php

namespace App\Http\Controllers\Admin;

use App\Domain\Platform\Actions\UpdatePlatformSettings;
use App\Domain\Platform\PlatformSettings;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\UpdatePlatformSettingsRequest;
use App\Models\PlatformSetting;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Admin > Configuración: platform-wide switches and the fixed values from config. */
class SettingsController extends Controller
{
    public function edit(PlatformSettings $settings): Response
    {
        $last = PlatformSetting::query()->with('editor')->latest('updated_at')->first();

        return Inertia::render('Admin/Settings', [
            'settings' => $settings->all(),
            'lastChange' => $last === null ? null : [
                'at' => $last->updated_at?->toIso8601String(),
                'by' => $last->editor?->name,
            ],
            'fixed' => [
                'currency' => (string) config('platform.wallet.currency'),
                'min_deposit_cents' => (int) config('platform.wallet.min_deposit_cents'),
                'max_deposit_cents' => (int) config('platform.wallet.max_deposit_cents'),
                'platform_fee_percent' => (int) config('platform.wallet.platform_fee_percent'),
                'dial_size' => (int) config('platform.dial.size'),
                'max_categories' => (int) config('platform.stations.max_categories'),
                'max_permanent_hashtags' => (int) config('platform.stations.max_permanent_hashtags'),
                'max_topic_hashtags' => (int) config('platform.stations.max_topic_hashtags'),
            ],
        ]);
    }

    public function update(UpdatePlatformSettingsRequest $request, UpdatePlatformSettings $update): RedirectResponse
    {
        $changes = $update->handle($request->settings(), $request->user());

        return back()->with('success', $changes === [] ? 'No había cambios que guardar.' : 'Guardamos la configuración de la plataforma.');
    }
}
