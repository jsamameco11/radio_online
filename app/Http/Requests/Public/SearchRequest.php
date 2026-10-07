<?php

namespace App\Http\Requests\Public;

use App\Domain\Discovery\SearchTerm;
use Illuminate\Foundation\Http\FormRequest;

/** The search box: /buscar?q=89.3, /buscar?q=%23Futbol, /buscar?q=salsa. */
class SearchRequest extends FormRequest
{
    public const MAX_LENGTH = 80;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [];
    }

    public function term(): SearchTerm
    {
        return SearchTerm::parse(mb_substr($this->string('q')->toString(), 0, self::MAX_LENGTH));
    }
}
