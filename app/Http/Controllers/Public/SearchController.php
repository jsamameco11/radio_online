<?php

namespace App\Http\Controllers\Public;

use App\Domain\Discovery\Hashtags;
use App\Domain\Discovery\Queries\CategoryCatalog;
use App\Domain\Discovery\Queries\StationDirectory;
use App\Domain\Discovery\Queries\StationFilters;
use App\Domain\Discovery\SearchTerm;
use App\Domain\Frequencies\FrequencyDial;
use App\Domain\Stations\Enums\StationVisibility;
use App\Http\Controllers\Controller;
use App\Http\Requests\Public\SearchRequest;
use App\Http\Resources\StationResource;
use App\Models\Category;
use App\Models\Frequency;
use App\Models\Hashtag;
use App\Models\Station;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/**
 * One search box for a frequency ("89.3"), a #hashtag or any text (station
 * name, category, topic).
 */
class SearchController extends Controller
{
    public function __invoke(SearchRequest $request, StationDirectory $stations, CategoryCatalog $categories): Response
    {
        $term = $request->term();

        return Inertia::render('Public/Search', [
            'query' => $term->raw,
            'kind' => match (true) {
                $term->isEmpty() => 'empty',
                $term->hashtag !== null => 'hashtag',
                $term->frequency !== null => 'frequency',
                default => 'text',
            },
            'tuned' => $term->frequency === null ? null : $this->tuned($request, $term->frequency, $stations),
            'hashtag' => $term->hashtag === null ? null : $this->hashtag($term->hashtag),
            'stations' => $term->isEmpty() ? null : $this->stations($term, $stations)->through(fn (Station $station) => StationResource::make($station)->resolve($request)),
            'categories' => $term->text === '' ? [] : Category::query()
                ->active()
                ->where('name', 'like', '%'.$term->text.'%')
                ->withCount(['stations' => fn ($station) => $station->discoverable()])
                ->limit(8)
                ->get()
                ->map(fn (Category $category) => $categories->present($category))
                ->all(),
            'hashtags' => $this->similarHashtags($term),
        ]);
    }

    /** @return LengthAwarePaginator<int, Station> */
    private function stations(SearchTerm $term, StationDirectory $stations): LengthAwarePaginator
    {
        if ($term->hashtag !== null) {
            return $stations->withHashtag($stations->query(), $term->hashtag['slug'])
                ->orderByDesc('listener_count')
                ->paginate(24)
                ->withQueryString();
        }

        return $stations->search(new StationFilters(text: $term->text));
    }

    /**
     * The frequency the listener typed: who broadcasts on it, or whether it is
     * free to request, plus the stations around it on the dial.
     *
     * @return array<string, mixed>
     */
    private function tuned(Request $request, string $label, StationDirectory $stations): array
    {
        $frequency = Frequency::query()->where('label', $label)->first();
        $station = $frequency === null ? null : $stations->onFrequency($frequency);
        if ($station !== null && $station->visibility !== StationVisibility::Public) {
            $station = null;
        }

        $nearby = $stations->query()
            ->whereHas('frequency', fn ($dial) => $dial
                ->whereBetween('frequency', [(float) $label - 1.5, (float) $label + 1.5])
                ->where('label', '!=', $label))
            ->get()
            ->sortBy(fn (Station $other) => abs((float) $other->frequency->frequency - (float) $label))
            ->take(6)
            ->values();

        return [
            'label' => $label,
            'slug' => FrequencyDial::slug($label),
            'display' => $label,
            'exists' => $frequency !== null,
            'available' => (bool) $frequency?->isAvailable(),
            'station' => $station === null ? null : StationResource::make($station)->resolve($request),
            'nearby' => StationResource::collection($nearby)->resolve($request),
        ];
    }

    /**
     * Hashtags that look like the free text, so "futbol" also offers #FutbolPeruano.
     *
     * @return list<array{name: string, slug: string, uses_count: int}>
     */
    private function similarHashtags(SearchTerm $term): array
    {
        $slug = $term->text === '' ? null : (Hashtags::normalize($term->text)['slug'] ?? null);
        if ($slug === null) {
            return [];
        }

        return Hashtag::query()
            ->where('slug', 'like', '%'.$slug.'%')
            ->orderByDesc('uses_count')
            ->limit(10)
            ->get(['name', 'slug', 'uses_count'])
            ->map(fn (Hashtag $tag) => ['name' => $tag->name, 'slug' => $tag->slug, 'uses_count' => $tag->uses_count])
            ->values()
            ->all();
    }

    /**
     * @param  array{name: string, slug: string}  $tag
     * @return array{name: string, slug: string, exists: bool}
     */
    private function hashtag(array $tag): array
    {
        $stored = Hashtag::query()->where('slug', $tag['slug'])->first(['name', 'slug']);

        return ['name' => $stored->name ?? $tag['name'], 'slug' => $tag['slug'], 'exists' => $stored !== null];
    }
}
