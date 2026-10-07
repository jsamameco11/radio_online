<?php

namespace Tests\Feature\Gifts;

use App\Domain\Gifts\Actions\SendGift;
use App\Domain\Gifts\Enums\GiftMessageStatus;
use App\Domain\Gifts\Events\GiftMessagePlayed;
use App\Domain\Gifts\Support\GiftPreferences;
use App\Domain\Stations\Enums\StationRole;
use App\Domain\Wallet\Support\LedgerEntry;
use App\Domain\Wallet\WalletLedger;
use App\Models\Gift;
use App\Models\GiftTransaction;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class StudioGiftsTest extends TestCase
{
    use RefreshDatabase;

    private Station $station;

    private Gift $gift;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        Storage::fake('local');
        $this->station = Station::factory()->create();
        $this->gift = Gift::query()->create(['name' => 'Corazón', 'slug' => 'corazon', 'emoji' => '❤️', 'price_cents' => 300]);
    }

    #[Test]
    public function members_without_gifts_view_cannot_see_gifts_or_messages(): void
    {
        $editor = $this->teamMember($this->station, StationRole::Editor);

        $this->actingAs($editor)->get($this->studioUrl($this->station, '/regalos'))->assertForbidden();
        $this->actingAs($editor)->get($this->studioUrl($this->station, '/mensajes'))->assertForbidden();
        $this->actingAs($editor)->getJson($this->studioUrl($this->station, '/regalos/recientes'))->assertForbidden();
    }

    #[Test]
    public function members_of_another_station_are_kept_out(): void
    {
        $other = Station::factory()->create();
        $outsider = $this->teamMember($other, StationRole::Owner);

        $this->actingAs($outsider)->get($this->studioUrl($this->station, '/regalos'))->assertForbidden();
        $this->actingAs($outsider)->get($this->studioUrl($this->station, '/finanzas'))->assertForbidden();
    }

    #[Test]
    public function hosts_see_the_gifts_their_station_received(): void
    {
        $this->sendGift(message: 'Hola cabina');
        $this->sendGift(anonymous: true);
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->get($this->studioUrl($this->station, '/regalos'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Gifts/Index')
                ->where('totals.gifts', 2)
                ->where('totals.gross_cents', 600)
                ->where('totals.earned_cents', 420)
                ->has('supporters', 1)
                ->has('gifts.data', 2));

        $this->actingAs($host)
            ->getJson($this->studioUrl($this->station, '/regalos/recientes'))
            ->assertOk()
            ->assertJsonCount(2, 'gifts')
            ->assertJsonPath('gifts.0.sender', null)
            ->assertJsonPath('gifts.1.message.body', 'Hola cabina');
    }

    #[Test]
    public function a_voice_message_is_played_through_a_temporary_url_and_marked_once(): void
    {
        Event::fake([GiftMessagePlayed::class]);
        $message = $this->sendGift(voice: true)->message()->sole();
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->get($this->studioUrl($this->station, '/mensajes/'.$message->id.'/audio'))
            ->assertRedirect();

        $this->actingAs($host)
            ->postJson($this->studioUrl($this->station, '/mensajes/'.$message->id.'/reproducido'))
            ->assertOk()
            ->assertJsonPath('played_by', $host->name);
        $this->actingAs($host)->postJson($this->studioUrl($this->station, '/mensajes/'.$message->id.'/reproducido'))->assertOk();

        $message->refresh();
        $this->assertNotNull($message->played_at);
        $this->assertSame($host->id, $message->played_by);
        Event::assertDispatchedTimes(GiftMessagePlayed::class, 1);
    }

    #[Test]
    public function messages_of_another_station_are_not_found(): void
    {
        $message = $this->sendGift(voice: true)->message()->sole();
        $other = Station::factory()->create();
        $owner = $this->teamMember($other, StationRole::Owner);

        $this->actingAs($owner)->get($this->studioUrl($other, '/mensajes/'.$message->id.'/audio'))->assertNotFound();
        $this->actingAs($owner)->postJson($this->studioUrl($other, '/mensajes/'.$message->id.'/reproducido'))->assertNotFound();
        $this->actingAs($owner)->get($this->studioUrl($other, '/mensajes/not-a-uuid/audio'))->assertNotFound();
    }

    #[Test]
    public function messages_can_be_hidden_and_reported(): void
    {
        $message = $this->sendGift(message: 'Spam spam spam')->message()->sole();
        $host = $this->teamMember($this->station, StationRole::Host);

        $this->actingAs($host)
            ->patch($this->studioUrl($this->station, '/mensajes/'.$message->id.'/visibilidad'), ['visible' => false])
            ->assertSessionHas('success');
        $this->assertSame(GiftMessageStatus::Hidden, $message->fresh()->status);

        $this->actingAs($host)
            ->post($this->studioUrl($this->station, '/mensajes/'.$message->id.'/reportar'), ['reason' => 'spam'])
            ->assertSessionHas('success');
        $this->assertSame(GiftMessageStatus::Reported, $message->fresh()->status);
        $this->assertSame(1, Report::query()->where('reportable_type', 'gift_message')->where('reportable_id', $message->id)->count());

        $this->actingAs($host)
            ->get($this->studioUrl($this->station, '/mensajes?estado=ocultos'))
            ->assertInertia(fn (Assert $page) => $page->component('Studio/Gifts/Messages')->has('gifts.data', 1)->where('counts.pendientes', 0));
    }

    #[Test]
    public function finances_require_finance_view(): void
    {
        $this->sendGift();

        $this->actingAs($this->teamMember($this->station, StationRole::Manager))
            ->get($this->studioUrl($this->station, '/finanzas'))
            ->assertForbidden();

        $this->actingAs($this->station->owner()->sole())
            ->get($this->studioUrl($this->station, '/finanzas'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Studio/Gifts/Finances')
                ->where('wallet.balance_cents', 210)
                ->where('summary.lifetime_earned_cents', 210)
                ->where('summary.lifetime_fees_cents', 90)
                ->has('series', 30)
                ->has('transactions.data', 1));
    }

    #[Test]
    public function gift_and_message_settings_need_station_settings(): void
    {
        $this->actingAs($this->teamMember($this->station, StationRole::Host))
            ->put($this->studioUrl($this->station, '/configuracion/regalos'), ['enabled' => false, 'min_gift_cents' => 500])
            ->assertForbidden();

        $owner = $this->station->owner()->sole();

        $this->actingAs($owner)
            ->put($this->studioUrl($this->station, '/configuracion/regalos'), ['enabled' => true, 'min_gift_cents' => 500, 'thank_you_message' => '¡Mil gracias!'])
            ->assertSessionHasNoErrors();
        $this->actingAs($owner)
            ->put($this->studioUrl($this->station, '/configuracion/mensajes'), [
                'accept_text' => true, 'accept_voice' => false, 'auto_hide_filtered' => false, 'blocked_words' => [' Tonto ', 'tonto', ''],
            ])
            ->assertSessionHasNoErrors();

        $preferences = app(GiftPreferences::class);
        $this->assertSame(['enabled' => true, 'min_gift_cents' => 500, 'thank_you_message' => '¡Mil gracias!'], $preferences->gifts($this->station));
        $this->assertSame(['tonto'], $preferences->messages($this->station)['blocked_words']);
        $this->assertFalse($preferences->messages($this->station)['accept_voice']);

        $this->actingAs($owner)
            ->get($this->studioUrl($this->station, '/configuracion/mensajes'))
            ->assertInertia(fn (Assert $page) => $page->component('Studio/Gifts/MessageSettings')->where('settings.accept_voice', false));
    }

    private function sendGift(?string $message = null, bool $voice = false, bool $anonymous = false): GiftTransaction
    {
        $listener = User::factory()->create();
        $ledger = app(WalletLedger::class);
        $ledger->deposit($ledger->open($listener), 1000, new LedgerEntry('seed:'.$listener->id));

        return app(SendGift::class)->handle(
            $listener,
            $this->station,
            $this->gift,
            1,
            (string) Str::uuid(),
            message: $message,
            voice: $voice ? UploadedFile::fake()->create('voz.webm', 64, 'audio/webm') : null,
            voiceSeconds: $voice ? 8.5 : null,
            anonymous: $anonymous,
        );
    }
}
