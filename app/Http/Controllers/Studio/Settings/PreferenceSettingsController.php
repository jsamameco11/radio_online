<?php

namespace App\Http\Controllers\Studio\Settings;

use App\Domain\Audit\AuditTrail;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Stations\Support\StationPreferences;
use App\Http\Controllers\Controller;
use App\Http\Requests\Stations\UpdateModerationSettingsRequest;
use App\Http\Requests\Stations\UpdateNotificationSettingsRequest;
use App\Http\Requests\Stations\UpdatePrivacySettingsRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Estudio > Configuración > Moderación, > Notificaciones and > Privacidad. */
class PreferenceSettingsController extends Controller
{
    public function __construct(
        private readonly CurrentStation $current,
        private readonly StationPreferences $preferences,
        private readonly AuditTrail $audit,
    ) {}

    public function moderation(): Response
    {
        return Inertia::render('Studio/Settings/Moderation', [
            'settings' => $this->preferences->get($this->current->get(), 'moderation'),
            'slowModeOptions' => StationPreferences::SLOW_MODE_OPTIONS,
        ]);
    }

    public function updateModeration(UpdateModerationSettingsRequest $request): RedirectResponse
    {
        $this->save($request, 'moderation', $request->settings());

        return back()->with('success', 'Guardamos las reglas de moderación.');
    }

    public function notifications(): Response
    {
        return Inertia::render('Studio/Settings/Notifications', [
            'settings' => $this->preferences->get($this->current->get(), 'notifications'),
            'recipients' => collect(StationPreferences::RECIPIENTS)
                ->map(fn (string $label, string $value) => ['value' => $value, 'label' => $label])
                ->values()
                ->all(),
        ]);
    }

    public function updateNotifications(UpdateNotificationSettingsRequest $request): RedirectResponse
    {
        $this->save($request, 'notifications', $request->settings());

        return back()->with('success', 'Guardamos tus preferencias de notificación.');
    }

    public function privacy(): Response
    {
        return Inertia::render('Studio/Settings/Privacy', [
            'settings' => $this->preferences->get($this->current->get(), 'privacy'),
        ]);
    }

    public function updatePrivacy(UpdatePrivacySettingsRequest $request): RedirectResponse
    {
        $this->save($request, 'privacy', $request->settings());

        return back()->with('success', 'Guardamos la configuración de privacidad.');
    }

    /**
     * @param  array<string, mixed>  $values
     */
    private function save(Request $request, string $group, array $values): void
    {
        $station = $this->current->get();
        $changed = $this->preferences->put($station, $group, $values);

        if ($changed !== []) {
            $this->audit->record('station.settings_updated', $station, ['group' => $group, 'fields' => $changed], $request->user());
        }
    }
}
