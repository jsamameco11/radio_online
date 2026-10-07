<?php

namespace App\Domain\Discovery;

use App\Models\Hashtag;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Turns what people type ("#Fútbol", "fútbol peruano", "Perú") into stored
 * hashtags and attaches them, in order, to a station, topic or episode.
 */
final class Hashtags
{
    public const MAX_LENGTH = 40;

    /**
     * "#Fútbol Peruano" → ["name" => "FutbolPeruano", "slug" => "futbolperuano"]; null when nothing is left.
     *
     * @return array{name: string, slug: string}|null
     */
    public static function normalize(string $raw): ?array
    {
        $words = preg_split('/\s+/u', trim(Str::ascii(ltrim(trim($raw), '#')))) ?: [];
        $name = implode('', array_map(
            fn (string $word) => Str::ucfirst(preg_replace('/[^A-Za-z0-9_]/', '', $word) ?? ''),
            $words,
        ));
        $name = mb_substr($name, 0, self::MAX_LENGTH);

        return $name === '' ? null : ['name' => $name, 'slug' => Str::lower($name)];
    }

    /**
     * Unique hashtags for the given texts, created when new, in the given order.
     *
     * @param  iterable<string>  $texts
     * @return Collection<int, Hashtag>
     */
    public static function resolve(iterable $texts, int $limit): Collection
    {
        $wanted = collect($texts)
            ->map(fn (string $text) => self::normalize($text))
            ->filter()
            ->unique('slug')
            ->take($limit)
            ->values();

        return $wanted->map(fn (array $tag) => Hashtag::query()->firstOrCreate(['slug' => $tag['slug']], ['name' => $tag['name']]));
    }

    /**
     * Replaces the hashtags of a relation and keeps every hashtag's usage count right.
     *
     * @param  iterable<string>  $texts
     * @return Collection<int, Hashtag>
     */
    public static function sync(BelongsToMany $relation, iterable $texts, int $limit): Collection
    {
        return DB::transaction(function () use ($relation, $texts, $limit) {
            $tags = self::resolve($texts, $limit);
            $before = $relation->pluck('hashtags.id')->all();

            $relation->sync($tags->values()->mapWithKeys(fn (Hashtag $tag, int $index) => [$tag->id => ['position' => $index]])->all());

            $after = $tags->pluck('id')->all();
            $added = array_diff($after, $before);
            $removed = array_diff($before, $after);
            if ($added !== []) {
                Hashtag::query()->whereKey($added)->increment('uses_count');
            }
            if ($removed !== []) {
                Hashtag::query()->whereKey($removed)->where('uses_count', '>', 0)->decrement('uses_count');
            }

            return $tags;
        });
    }
}
