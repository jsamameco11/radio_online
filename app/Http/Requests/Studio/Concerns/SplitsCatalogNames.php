<?php

namespace App\Http\Requests\Studio\Concerns;

/** Other names of a catalog genre or artist, sent as a list or as text separated by commas, semicolons or lines. */
trait SplitsCatalogNames
{
    private const MAX_NAMES = 30;

    /** @return list<mixed> */
    private function names(mixed $value): array
    {
        $parts = is_array($value) ? $value : preg_split('/[,;\n]+/u', (string) $value);

        return array_values(array_filter(
            array_map(fn ($name) => is_string($name) ? trim((string) preg_replace('/\s+/u', ' ', $name)) : $name, $parts ?: []),
            fn ($name) => $name !== '',
        ));
    }
}
