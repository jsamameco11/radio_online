<?php

namespace App\Domain\Studio\Broadcast;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Studio\Enums\TrackKind;
use App\Models\Playlist;
use App\Models\Track;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * The automatic music: what plays when nobody is on air and nothing is scheduled.
 *
 * A source is one playlist or random songs: every playlist together (plus the songs marked for
 * the continuous music), or every song of the library when there is none (see resolve()). Each
 * cycle plays every song of the source once, without repeating; shuffled sources draw a new
 * order for every cycle (never starting with the song that closed the previous one), ordered
 * sources follow the playlist. The order depends only on where the music started, so every
 * listener hears the same song.
 */
final class Autopilot
{
    /** Name of the source without a playlist. */
    public const RANDOM = 'Canciones aleatorias';

    /** What sounds: the chosen playlist; for random songs every list or every song of the library; or nothing. */
    public const PLAYLIST = 'playlist';

    public const LISTS = 'lists';

    public const LIBRARY = 'library';

    public const NONE = 'none';

    /** Songs this short are jingles, not music. */
    private const MIN_SECONDS = 5;

    /** Songs every listener keeps at hand to cover a file that fails or a server that stops answering. */
    private const RESERVE = 8;

    public function __construct(private readonly CurrentStation $current) {}

    /**
     * Songs of a source with their length and the step to the next one (the length minus the
     * crossfade, never more than a third of the song).
     *
     * @return list<array{id: string, kind: string, title: string, artist: ?string, src: string, cover: ?string, ms: int, step: int}>
     */
    public function songs(?string $playlist, int $crossfadeMs): array
    {
        return $this->resolve($playlist, true, $crossfadeMs)['songs'];
    }

    /**
     * What the automatic music really plays. A chosen playlist plays only its own songs: when it
     * is missing, empty or unplayable, the radio is silent. Random songs are every list together
     * (and the songs marked for the continuous music); when there is none, every song of the
     * library. Only songs that pass every check sound: active, long enough and with a healthy file.
     *
     * @return array{level: string, shuffle: bool, songs: list<array<string, mixed>>}
     */
    public function resolve(?string $playlist, bool $shuffle, int $crossfadeMs): array
    {
        $chain = $playlist !== null ? [[self::PLAYLIST, $playlist]] : [[self::LISTS, self::LISTS], [self::LIBRARY, self::LIBRARY]];
        foreach ($chain as [$level, $source]) {
            $songs = $this->cached($source, $crossfadeMs);
            if ($songs) {
                return ['level' => $level, 'shuffle' => $level === self::PLAYLIST ? $shuffle : true, 'songs' => $songs];
            }
        }

        return ['level' => self::NONE, 'shuffle' => true, 'songs' => []];
    }

    /**
     * Songs of the source on air for the listeners' players to fall back on, a new pick every hour.
     *
     * @return list<array{id: string, title: string, artist: ?string, src: string, ms: int}>
     */
    public function reserve(int $now, ?string $playlist): array
    {
        $songs = self::shuffled($this->resolve($playlist, true, 0)['songs'], 'reserve:'.intdiv($now, 3600000));

        return array_map(fn (array $song) => [
            'id' => $song['id'], 'title' => $song['title'], 'artist' => $song['artist'], 'src' => $song['src'], 'ms' => $song['ms'],
        ], array_slice($songs, 0, self::RESERVE));
    }

    /** Called whenever the library, a playlist or the crossfade changes. */
    public function flush(): void
    {
        Cache::forever($this->current->key('autopilot.generation'), Str::random(8));
    }

    /** Name of a source for the console and the program. */
    public function label(?string $playlist): string
    {
        $name = $playlist !== null ? Playlist::query()->whereKey($playlist)->value('name') : null;

        return $name ?? self::RANDOM;
    }

    /**
     * Songs of the source between $from and $to for music that started at $anchor. Each item
     * keeps its origin, so a listener who joins mid-song seeks to the same moment as the rest.
     *
     * @param  array<string, mixed>  $extra  fields that override every item (kind, bed, block)
     * @param  bool  $ragged  the last song plays to its end past $to (it fades into the music that follows)
     * @param  ?string  $first  track the music starts with (see order())
     * @return list<array<string, mixed>>
     */
    public static function fill(array $songs, bool $shuffle, int $anchor, int $from, int $to, int $limit, array $extra = [], bool $ragged = false, ?string $first = null): array
    {
        $count = count($songs);
        $total = array_sum(array_column($songs, 'step'));
        if ($count === 0 || $total <= 0 || $to <= $from || $limit <= 0) {
            return [];
        }

        // One cycle back, so the last song of the previous cycle is kept while it fades into this one.
        $cycle = max(0, intdiv(max(0, $from - $anchor), $total) - 1);
        $t = $anchor + $cycle * $total;
        $order = self::order($songs, $shuffle, $anchor, $cycle, $first);
        $index = 0;
        $advance = function () use (&$t, &$index, &$cycle, &$order, $songs, $shuffle, $anchor, $count, $first) {
            $t += $order[$index]['step'];
            if (++$index === $count) {
                $index = 0;
                $order = self::order($songs, $shuffle, $anchor, ++$cycle, $first);
            }
        };
        while ($t + $order[$index]['ms'] <= $from) {
            $advance();
        }

        $items = [];
        while ($t < $to && count($items) < $limit) {
            $song = $order[$index];
            $begin = max($t, $from);
            $items[] = [
                'id' => 'r'.$t.'-'.substr($song['id'], 0, 8),
                'kind' => TrackKind::Song->value,
                'title' => $song['title'],
                'artist' => $song['artist'],
                'src' => $song['src'],
                'cover' => $song['cover'] ?? null,
                'start' => $begin,
                'end' => $ragged ? $t + $song['ms'] : min($t + $song['ms'], $to),
                'origin' => $t,
                'seek' => round(($begin - $t) / 1000, 3),
                'bed' => false,
                'block' => null,
                'slot' => null,
                'track' => $song['id'],
                ...$extra,
            ];
            $advance();
        }

        return $items;
    }

    /**
     * Order of one cycle. Two songs or fewer simply alternate; otherwise a shuffled cycle never
     * opens with the song that closed the previous one. With $first, a list in order plays from
     * that song on, and a shuffled source opens its first cycle with it.
     */
    private static function order(array $songs, bool $shuffle, int $anchor, int $cycle, ?string $first = null): array
    {
        $at = $first !== null ? array_search($first, array_column($songs, 'id'), true) : false;
        if (! $shuffle || count($songs) < 3) {
            return $at === false ? $songs : [...array_slice($songs, $at), ...array_slice($songs, 0, $at)];
        }
        $order = self::shuffled($songs, $anchor.':'.$cycle);
        if ($cycle === 0 && $at !== false) {
            $position = array_search($first, array_column($order, 'id'), true);
            [$order[0], $order[$position]] = [$order[$position], $order[0]];

            return $order;
        }
        if ($cycle === 0) {
            return $order;
        }
        $closing = $cycle === 1 && $at !== false
            ? self::order($songs, $shuffle, $anchor, 0, $first)
            : self::shuffled($songs, $anchor.':'.($cycle - 1));
        if ($order[0]['id'] === $closing[count($songs) - 1]['id']) {
            [$order[0], $order[1]] = [$order[1], $order[0]];
        }

        return $order;
    }

    private static function shuffled(array $songs, string $seed): array
    {
        usort($songs, fn ($a, $b) => [crc32($a['id'].$seed), $a['id']] <=> [crc32($b['id'].$seed), $b['id']]);

        return $songs;
    }

    /** @return list<array<string, mixed>> playable songs of a playlist id, of every list (LISTS) or of the whole library (LIBRARY) */
    private function cached(string $source, int $crossfadeMs): array
    {
        $generation = Cache::rememberForever($this->current->key('autopilot.generation'), fn () => Str::random(8));

        return Cache::remember(
            $this->current->key("autopilot.{$generation}.{$source}.{$crossfadeMs}"),
            600,
            fn () => $this->load($source)->map(fn (Track $track) => self::song($track, $crossfadeMs))->all(),
        );
    }

    /** @return Collection<int, Track> */
    private function load(string $source): Collection
    {
        $playable = fn (Builder|BelongsToMany $query) => $query->where('tracks.kind', TrackKind::Song->value)->where('tracks.active', true)
            ->where('tracks.duration', '>=', self::MIN_SECONDS)
            ->whereNull('tracks.file_problem')
            ->whereNotNull('tracks.file_path')->where('tracks.file_path', '!=', '');

        if ($source === self::LIBRARY) {
            return $playable(Track::query())->orderBy('tracks.id')->get();
        }

        if ($source !== self::LISTS) {
            $list = Playlist::query()->find($source);

            return $list ? $playable($list->tracks())->get() : collect();
        }

        $listed = $playable(Track::query()->select('tracks.*')
            ->join('playlist_track', 'playlist_track.track_id', '=', 'tracks.id')
            ->join('playlists', 'playlists.id', '=', 'playlist_track.playlist_id'))
            ->orderBy('playlists.sort_order')->orderBy('playlists.created_at')->orderBy('playlist_track.position')
            ->get();
        $rotation = $playable(Track::query())->where('tracks.rotation', true)->orderBy('tracks.id')->get();

        return $listed->concat($rotation)->unique('id')->values();
    }

    private static function song(Track $track, int $crossfadeMs): array
    {
        $ms = (int) round($track->duration * 1000);

        return [
            'id' => $track->id,
            'kind' => $track->kind->value,
            'title' => $track->title,
            'artist' => $track->credit(),
            'src' => $track->file_path,
            'cover' => $track->cover_path,
            'ms' => $ms,
            'step' => max(1000, $ms - min($crossfadeMs, intdiv($ms, 3))),
        ];
    }
}
