<?php

namespace App\Providers;

use App\Domain\Access\Enums\PlatformRole;
use App\Domain\Access\Listeners\RecordSignIn;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\Monitor\PublishMonitorChanges;
use App\Models\Category;
use App\Models\ChatMessage;
use App\Models\CurrentTopic;
use App\Models\Episode;
use App\Models\Frequency;
use App\Models\FrequencyRequest;
use App\Models\Gift;
use App\Models\GiftMessage;
use App\Models\GiftTransaction;
use App\Models\MonetizationRequest;
use App\Models\Payment;
use App\Models\Report;
use App\Models\Station;
use App\Models\User;
use App\Models\Wallet;
use App\Models\WalletTransaction;
use App\Models\WithdrawalRequest;
use Illuminate\Auth\Events\Login;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CurrentStation::class);
    }

    public function boot(): void
    {
        Model::preventLazyLoading(! $this->app->isProduction());
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        // Short, stable names in polymorphic columns (wallet owners, reports, audit subjects).
        Relation::enforceMorphMap([
            'user' => User::class,
            'station' => Station::class,
            'episode' => Episode::class,
            'gift_transaction' => GiftTransaction::class,
            'gift_message' => GiftMessage::class,
            'payment' => Payment::class,
            'frequency_request' => FrequencyRequest::class,
            'frequency' => Frequency::class,
            'category' => Category::class,
            'report' => Report::class,
            'current_topic' => CurrentTopic::class,
            'gift' => Gift::class,
            'wallet' => Wallet::class,
            'wallet_transaction' => WalletTransaction::class,
            'chat_message' => ChatMessage::class,
            'monetization_request' => MonetizationRequest::class,
            'withdrawal_request' => WithdrawalRequest::class,
        ]);

        Frequency::observe(PublishMonitorChanges::class);
        Station::observe(PublishMonitorChanges::class);

        Gate::before(fn (User $user) => $user->hasRole(PlatformRole::SuperAdmin->value) ? true : null);

        Password::defaults(fn () => $this->app->isProduction()
            ? Password::min(10)->letters()->mixedCase()->numbers()->uncompromised()
            : Password::min(8));

        Event::listen(Login::class, RecordSignIn::class);
    }
}
