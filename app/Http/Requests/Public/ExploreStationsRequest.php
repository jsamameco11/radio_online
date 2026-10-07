<?php

namespace App\Http\Requests\Public;

use App\Domain\Discovery\Enums\StationSort;
use App\Domain\Discovery\Hashtags;
use App\Domain\Discovery\Queries\StationFilters;
use Illuminate\Foundation\Http\FormRequest;

/**
 * Filters of the station listings: ?categoria=salsa&hashtag=futbol&en-vivo=1&orden=followers.
 * Unknown values are ignored instead of rejected, so shared links never break.
 */
class ExploreStationsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [];
    }

    public function filters(bool $onAirOnly = false): StationFilters
    {
        $hashtag = Hashtags::normalize(mb_substr($this->string('hashtag')->toString(), 0, Hashtags::MAX_LENGTH + 1));
        $category = mb_substr($this->string('categoria')->trim()->toString(), 0, 80);

        return new StationFilters(
            category: $category === '' ? null : $category,
            hashtag: $hashtag['slug'] ?? null,
            onAirOnly: $onAirOnly || $this->boolean('en-vivo'),
            sort: StationSort::tryFrom($this->string('orden')->toString()) ?? StationSort::Listeners,
        );
    }

    /**
     * The filters as the page shows them back.
     *
     * @return array{categoria: string|null, hashtag: string|null, en_vivo: bool, orden: string}
     */
    public function applied(StationFilters $filters): array
    {
        return [
            'categoria' => $filters->category,
            'hashtag' => $filters->hashtag,
            'en_vivo' => $filters->onAirOnly,
            'orden' => $filters->sort->value,
        ];
    }
}
