<?php

namespace Database\Seeders;

use App\Domain\Studio\Catalog\MusicCatalog;
use Illuminate\Database\Seeder;

/** The music catalog every station library starts with: genres of every style and well-known artists. */
class CatalogSeeder extends Seeder
{
    public function run(MusicCatalog $catalog): void
    {
        $added = $catalog->sync();

        $this->command?->info("Catálogo musical: {$added['genres']} géneros y {$added['artists']} artistas nuevos.");
    }
}
