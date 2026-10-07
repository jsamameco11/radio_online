<?php

use App\Domain\Applications\Actions\PurgeApplicationDocuments;
use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Streaming\Enums\StreamStatus;
use App\Domain\Streaming\PlaybackHealth;
use App\Domain\Streaming\StreamingSweep;
use App\Domain\Studio\Capture\LiveCapture;
use App\Jobs\CheckLibraryFiles;
use App\Jobs\PublishScheduledEpisodes;
use App\Models\Station;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('streaming:sweep', function (StreamingSweep $sweep) {
    $result = $sweep->handle();
    $this->info("Sesiones cerradas: {$result['sessions']} · conexiones olvidadas: {$result['peers']} · emisoras revisadas: {$result['stations']}");
})->purpose('End stale listener sessions and bring every station on the air in line with its engine');

Artisan::command('streaming:check-files', function (CurrentStation $current) {
    if (! PlaybackHealth::enabled()) {
        return;
    }
    Station::query()->where('stream_status', '!=', StreamStatus::Offline->value)->get()
        ->each(fn (Station $station) => $current->within($station, fn () => app(PlaybackHealth::class)->sweep()));
})->purpose('Check the audio files of the stations on the air');

Artisan::command('streaming:purge-recordings', function (LiveCapture $capture) {
    $this->info('Grabaciones descartadas: '.$capture->purge());
})->purpose('Discard console recordings left unsaved for days');

Artisan::command('applications:purge-documents', function (PurgeApplicationDocuments $purge) {
    $this->info('Expedientes depurados: '.$purge->expired());
})->purpose('Delete the identity documents of rejected or withdrawn station applications after the retention period');

Schedule::command('streaming:sweep')->everyMinute()->withoutOverlapping();
Schedule::command('streaming:check-files')->everyFiveMinutes()->withoutOverlapping();
Schedule::command('streaming:purge-recordings')->daily();
Schedule::command('applications:purge-documents')->dailyAt('03:30');

Schedule::job(new PublishScheduledEpisodes)->everyMinute();
Schedule::call(fn () => Station::query()->pluck('id')->each(fn (int $id) => CheckLibraryFiles::dispatch($id)))
    ->name('library:check-files')
    ->dailyAt('04:00');
