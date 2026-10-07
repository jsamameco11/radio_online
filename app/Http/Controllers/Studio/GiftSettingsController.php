<?php

namespace App\Http\Controllers\Studio;

use App\Domain\Audit\AuditTrail;
use App\Domain\Gifts\Support\GiftPreferences;
use App\Domain\Stations\Support\CurrentStation;
use App\Http\Controllers\Controller;
use App\Http\Requests\Gifts\GiftSettingsRequest;
use App\Http\Requests\Gifts\MessageSettingsRequest;
use Illuminate\Http\RedirectResponse;
use Inertia\Inertia;
use Inertia\Response;

/** Studio › Configuración › Regalos and › Mensajes. */
class GiftSettingsController extends Controller
{
    public function __construct(
        private readonly CurrentStation $current,
        private readonly GiftPreferences $preferences,
        private readonly AuditTrail $audit,
    ) {}

    public function gifts(): Response
    {
        return Inertia::render('Studio/Gifts/GiftSettings', [
            'settings' => $this->preferences->gifts($this->current->get()),
            'feePercent' => (int) config('platform.wallet.platform_fee_percent'),
        ]);
    }

    public function updateGifts(GiftSettingsRequest $request): RedirectResponse
    {
        $settings = $request->settings();
        $this->preferences->updateGifts($this->current->get(), $settings);
        $this->audit->record('station.settings_updated', $this->current->get(), ['group' => GiftPreferences::GIFTS, 'values' => $settings]);

        return back()->with('success', 'Guardamos la configuración de regalos.');
    }

    public function messages(): Response
    {
        return Inertia::render('Studio/Gifts/MessageSettings', [
            'settings' => $this->preferences->messages($this->current->get()),
            'limits' => [
                'max_message_length' => (int) config('platform.gifts.max_message_length'),
                'max_voice_seconds' => (int) config('platform.gifts.max_voice_seconds'),
                'max_blocked_words' => MessageSettingsRequest::MAX_BLOCKED_WORDS,
            ],
        ]);
    }

    public function updateMessages(MessageSettingsRequest $request): RedirectResponse
    {
        $settings = $request->settings();
        $this->preferences->updateMessages($this->current->get(), $settings);
        $this->audit->record('station.settings_updated', $this->current->get(), ['group' => GiftPreferences::MESSAGES, 'values' => $settings]);

        return back()->with('success', 'Guardamos la configuración de mensajes.');
    }
}
