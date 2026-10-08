<?php

namespace App\Console\Commands;

use App\Domain\Studio\Catalog\MusicCatalog;
use App\Models\Artist;
use App\Models\Genre;
use Illuminate\Console\Command;

/** Brings the genres and artists of the starting catalog that are missing into the shared music catalog. */
class RadioCatalog extends Command
{
    protected $signature = 'radio:catalog';

    protected $description = 'Agrega al catálogo musical compartido los géneros y artistas iniciales que falten (no toca lo que agregaron las radios)';

    public function handle(MusicCatalog $catalog): int
    {
        $added = $catalog->sync();
        $this->info("{$added['genres']} géneros y {$added['artists']} artistas agregados. El catálogo tiene ".Genre::query()->count().' géneros y '.Artist::query()->count().' artistas.');

        return self::SUCCESS;
    }
}
