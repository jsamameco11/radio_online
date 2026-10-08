<?php

namespace App\Console\Commands;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Catalog\MusicCatalog;
use App\Domain\Studio\Enums\TrackKind;
use App\Domain\Studio\Library\Identify\CoverDownload;
use App\Domain\Studio\Library\Identify\Identifier;
use App\Domain\Studio\Library\Identify\SongQuery;
use App\Domain\Studio\Library\Identify\Text;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Station;
use App\Models\Track;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

/** Identifies the songs already in station libraries, one by one, and completes what they are missing. */
class RadioIdentify extends Command
{
    protected $signature = 'radio:identify
        {--station= : Frecuencia (89-30) o id de la radio; sin ella, todas las radios}
        {--track= : Identifica solo esta canción (su id)}
        {--missing : Solo las canciones que nunca se identificaron}
        {--force : Reemplaza coautores, álbum, año, géneros y carátula aunque ya los tengan}
        {--dry : Muestra lo que encontraría sin guardar nada}
        {--limit=0 : Cuántas canciones como máximo por radio}';

    protected $description = 'Identifica en internet las canciones de las bibliotecas: autor, coautores, álbum, año, géneros y carátula';

    public function handle(
        CurrentStation $current,
        Identifier $identifier,
        MusicCatalog $catalog,
        CoverDownload $covers,
        MediaStorage $storage,
        PlayoutCaches $caches,
    ): int {
        $stations = $this->stations();
        if ($stations === null) {
            $this->error('No encontramos esa radio. Usa su frecuencia (89-30) o su id.');

            return self::FAILURE;
        }

        $force = (bool) $this->option('force');
        $dry = (bool) $this->option('dry');
        foreach ($stations as $station) {
            $current->within($station, function (Station $station) use ($identifier, $catalog, $covers, $storage, $caches, $force, $dry) {
                $tracks = Track::query()->with('genres')->where('kind', TrackKind::Song->value)
                    ->when($this->option('track'), fn ($query, $id) => $query->whereKey($id))
                    ->when($this->option('missing'), fn ($query) => $query->whereNull('identified_at'))
                    ->orderBy('title')
                    ->when((int) $this->option('limit') > 0, fn ($query) => $query->limit((int) $this->option('limit')))
                    ->get();
                $this->info($station->displayName());
                if ($tracks->isEmpty()) {
                    $this->line('  No hay canciones para identificar.');

                    return;
                }

                $rows = [];
                $changed = 0;
                $this->withProgressBar($tracks, function (Track $track) use ($identifier, $catalog, $covers, $storage, $force, $dry, &$rows, &$changed) {
                    $names = Text::splitNames(Text::cleanArtist((string) $track->artist), $catalog->joinedNames());
                    $result = $identifier->identify(new SongQuery(
                        $track->title,
                        $names[0] ?? '',
                        Text::unique([...array_slice($names, 1), ...($track->featured ?? [])]),
                        $track->duration ?: null,
                    ));
                    $rows[] = [
                        Str::limit($track->title, 34),
                        Str::limit((string) ($result['artist'] ?? $track->artist ?? '—'), 24),
                        Str::limit((string) ($result['album'] ?? '—'), 30),
                        $result['year'] ?? '—',
                        collect($result['genres'])->pluck('name')->implode(', ') ?: '—',
                        $result['found'] ? self::confidence((string) $result['confidence']) : 'No encontrada',
                    ];
                    if (! $dry) {
                        $changed += (int) $this->apply($track, $result, $force, $catalog, $covers, $storage);
                    }
                });
                $this->newLine(2);
                $this->table(['Canción', 'Autor', 'Álbum', 'Año', 'Géneros', 'Confianza'], $rows);
                if (! $dry) {
                    $caches->flush();
                    $this->info("  {$changed} de {$tracks->count()} canciones completadas.");
                }
            });
        }

        return self::SUCCESS;
    }

    /** @return iterable<Station>|null The stations asked for, or null when the one asked does not exist. */
    private function stations(): ?iterable
    {
        $asked = trim((string) $this->option('station'));
        $query = Station::query()->with('frequency');
        if ($asked === '') {
            return $query->lazyById();
        }
        $station = ctype_digit($asked)
            ? $query->whereKey((int) $asked)->first()
            : $query->whereHas('frequency', fn ($frequency) => $frequency->where('slug', str_replace('.', '-', $asked)))->first();

        return $station ? [$station] : null;
    }

    /**
     * Completes a song with what was found; without --force only what it is missing. A genre the
     * identification only guessed is given to a song that was found, never to one that was not.
     *
     * @param  array<string, mixed>  $result
     */
    private function apply(Track $track, array $result, bool $force, MusicCatalog $catalog, CoverDownload $covers, MediaStorage $storage): bool
    {
        $values = [];
        if ($result['found']) {
            $values['identity'] = $result['identity'];
            $values['identified_at'] = now();
            if ($result['artist'] && (! $track->artist || Text::key($result['artist']) === Text::key(Text::cleanArtist((string) $track->artist))) && $result['artist'] !== $track->artist) {
                $values['artist'] = Str::limit($result['artist'], 120, '');
            }
        }
        if ($result['featured'] && ($force || ! $track->featured)) {
            $values['featured'] = array_slice($result['featured'], 0, Track::MAX_FEATURED);
        }
        if ($result['album'] && ($force || ! $track->album)) {
            $values['album'] = Str::limit($result['album'], 160, '');
        }
        if ($result['year'] && ($force || ! $track->year)) {
            $values['year'] = $result['year'];
        }
        if ($result['cover_url'] && ($force || ! $track->cover_path)) {
            $cover = $covers->fetch($result['cover_url']);
            if ($cover !== null) {
                $storage->delete($track->cover_path);
                $values['cover_path'] = $cover;
            }
        }
        $changed = array_diff_key($values, ['identity' => true, 'identified_at' => true]) !== [];
        $track->update($values);

        $guessedGenres = in_array('genres', $result['guessed'], true);
        if ($result['genres'] && ($result['found'] || ! $guessedGenres) && ($force || $track->genres->isEmpty())) {
            $track->genres()->sync(collect($result['genres'])->take(Track::MAX_GENRES)->values()
                ->mapWithKeys(fn (array $genre, int $position) => [$genre['id'] => ['position' => $position]])->all());
            $changed = true;
        }
        if ($result['found']) {
            $catalog->learn($track->fresh(), $result['identity']['artist'] ?? []);
        }

        return $changed;
    }

    private static function confidence(string $level): string
    {
        return match ($level) {
            'high' => 'Alta',
            'medium' => 'Media',
            default => 'Baja',
        };
    }
}
