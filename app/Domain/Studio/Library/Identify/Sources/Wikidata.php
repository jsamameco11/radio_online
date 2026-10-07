<?php

namespace App\Domain\Studio\Library\Identify\Sources;

use App\Domain\Studio\Catalog\ArtistKind;
use App\Domain\Studio\Catalog\Names;
use Illuminate\Support\Facades\Cache;

/** Wikidata: the genres an artist is known for (P136) and whether it is a person or a group (P31). */
final class Wikidata extends Source
{
    public const NAME = 'wikidata';

    private const API = 'https://www.wikidata.org/w/api.php';

    /** Descriptions of an item that is a musician, a band or a choir. */
    private const MUSICAL = '/(music|musician|singer|band|group|rapper|songwriter|composer|duo|choir|dj|cantante|banda|grupo|musica|musico|cantautor|rapero|compositor|coro|artista|interprete|orquesta|orchestra)/';

    private const HUMAN = 'Q5';

    /** Musical group, band, duo, ensemble, choir, orchestra. */
    private const GROUPS = ['Q215380', 'Q2088357', 'Q5741069', 'Q9212979', 'Q131186', 'Q42998', 'Q216337'];

    /** @return array{id: string, kind: ?string, tags: list<array{0: string, 1: float}>}|null */
    public function artist(string $name): ?array
    {
        $key = 'identify:wikidata-artist:'.sha1(Names::key($name));
        $cached = Cache::get($key);
        if (is_array($cached)) {
            return $cached['id'] ? $cached : null;
        }
        $artist = $this->lookup($name);
        if ($artist !== false) {
            Cache::put($key, $artist ?? ['id' => null], now()->addDays(30));
        }

        return $artist ?: null;
    }

    /** @return array{id: string, kind: ?string, tags: list<array{0: string, 1: float}>}|null|false False when Wikidata did not answer. */
    private function lookup(string $name): array|false|null
    {
        $found = $this->json(self::API, ['action' => 'wbsearchentities', 'search' => $name, 'language' => 'es', 'uselang' => 'es', 'type' => 'item', 'limit' => 8, 'format' => 'json']);
        if ($found === null) {
            return false;
        }
        $item = collect($found['search'] ?? [])->first(fn ($item) => Names::similarity($item['label'] ?? '', $name) >= 0.92
            && preg_match(self::MUSICAL, Names::key($item['description'] ?? '')) === 1);
        if (! $item || empty($item['id'])) {
            return null;
        }
        $entity = $this->json(self::API, ['action' => 'wbgetentities', 'ids' => $item['id'], 'props' => 'claims', 'format' => 'json']);
        $claims = $entity['entities'][$item['id']]['claims'] ?? [];
        $values = fn (string $property) => collect($claims[$property] ?? [])->map(fn ($claim) => $claim['mainsnak']['datavalue']['value']['id'] ?? null)->filter()->values()->all();
        $instance = $values('P31');
        $genreIds = array_slice($values('P136'), 0, 12);

        $tags = [];
        if ($genreIds) {
            $labels = $this->json(self::API, ['action' => 'wbgetentities', 'ids' => implode('|', $genreIds), 'props' => 'labels', 'languages' => 'en|es', 'format' => 'json']);
            foreach ($labels['entities'] ?? [] as $genre) {
                foreach (['en', 'es'] as $language) {
                    if (! empty($genre['labels'][$language]['value'])) {
                        $tags[] = [(string) $genre['labels'][$language]['value'], 2.5];
                    }
                }
            }
        }

        return [
            'id' => (string) $item['id'],
            'kind' => match (true) {
                in_array(self::HUMAN, $instance, true) => ArtistKind::Solo->value,
                (bool) array_intersect(self::GROUPS, $instance) => ArtistKind::Group->value,
                default => null,
            },
            'tags' => $tags,
        ];
    }
}
