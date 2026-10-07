<?php

namespace App\Domain\Studio\Editor;

/**
 * What an edit does to an audio, as the editor sends it: the parts cut out, the fades, how the
 * cuts are joined and the sound settings. Every value is clamped to what the editor offers,
 * so a normalized recipe always renders. The editor (lib/media/editor/recipe.ts) mirrors these rules.
 *
 * @phpstan-type Recipe array{cuts: list<array{0: float, 1: float}>, fadeIn: float, fadeOut: float, join: float, gain: float, normalize: bool, voice: int, eq: list<float>, compress: int, width: int, lowcut: bool, denoise: int, deess: int, preset: ?string}
 */
final class EditRecipe
{
    /** Center of each equalizer band, in Hz: bass shelf, body, mids, presence and air shelf. */
    public const EQ_BANDS = [100, 250, 1000, 3500, 10000];

    public const MAX_CUTS = 60;

    /** Shortest audio an edit may leave, in seconds. */
    public const MIN_LENGTH = 1.0;

    public const MAX_FADE = 15.0;

    public const MAX_JOIN = 3.0;

    public const MAX_GAIN = 12.0;

    /** A cut shorter than this is a slip of the mouse. */
    private const MIN_CUT = 0.05;

    /** Audio left between two cuts shorter than this is cut too. */
    private const MIN_KEEP = 0.1;

    /** @return Recipe */
    public static function defaults(): array
    {
        return [
            'cuts' => [],
            'fadeIn' => 0.0,
            'fadeOut' => 0.0,
            'join' => 0.0,
            'gain' => 0.0,
            'normalize' => false,
            'voice' => 0,
            'eq' => [0.0, 0.0, 0.0, 0.0, 0.0],
            'compress' => 0,
            'width' => 0,
            'lowcut' => false,
            'denoise' => 0,
            'deess' => 0,
            'preset' => null,
        ];
    }

    /**
     * The recipe the editor sent, normalized for an audio of this length; null when it is not
     * a recipe or it would leave less than MIN_LENGTH of audio.
     *
     * @return Recipe|null
     */
    public static function from(mixed $input, float $duration): ?array
    {
        if (is_string($input)) {
            $input = json_decode($input, true);
        }
        if (! is_array($input) || $duration <= 0) {
            return null;
        }

        $cuts = [];
        foreach (array_slice(is_array($input['cuts'] ?? null) ? $input['cuts'] : [], 0, self::MAX_CUTS * 2) as $cut) {
            if (is_array($cut) && is_numeric($cut[0] ?? null) && is_numeric($cut[1] ?? null)) {
                $cuts[] = [self::clamp((float) $cut[0], 0, $duration), self::clamp((float) $cut[1], 0, $duration)];
            }
        }
        $cuts = self::merge($cuts, $duration);
        if (count($cuts) > self::MAX_CUTS) {
            return null;
        }
        $eq = is_array($input['eq'] ?? null) ? array_values($input['eq']) : [];

        $recipe = [
            'cuts' => $cuts,
            'fadeIn' => self::number($input['fadeIn'] ?? null, 0, self::MAX_FADE, 2),
            'fadeOut' => self::number($input['fadeOut'] ?? null, 0, self::MAX_FADE, 2),
            'join' => self::number($input['join'] ?? null, 0, self::MAX_JOIN, 2),
            'gain' => self::number($input['gain'] ?? null, -self::MAX_GAIN, self::MAX_GAIN, 1),
            'normalize' => filter_var($input['normalize'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'voice' => (int) self::number($input['voice'] ?? null, 0, 100, 0),
            'eq' => array_map(fn (int $band) => self::number($eq[$band] ?? null, -self::MAX_GAIN, self::MAX_GAIN, 1), array_keys(self::EQ_BANDS)),
            'compress' => (int) self::number($input['compress'] ?? null, 0, 100, 0),
            'width' => (int) self::number($input['width'] ?? null, -100, 100, 0),
            'lowcut' => filter_var($input['lowcut'] ?? false, FILTER_VALIDATE_BOOLEAN),
            'denoise' => (int) self::number($input['denoise'] ?? null, 0, 100, 0),
            'deess' => (int) self::number($input['deess'] ?? null, 0, 100, 0),
            'preset' => is_string($input['preset'] ?? null) && preg_match('/^[a-z-]{1,30}$/', $input['preset']) === 1 ? $input['preset'] : null,
        ];

        $length = self::length($recipe, $duration);
        if ($length < self::MIN_LENGTH) {
            return null;
        }
        $recipe['fadeIn'] = min($recipe['fadeIn'], round($length / 2, 2));
        $recipe['fadeOut'] = min($recipe['fadeOut'], round($length / 2, 2));

        return $recipe;
    }

    /**
     * Parts of the audio that stay, in order.
     *
     * @param  Recipe  $recipe
     * @return list<array{0: float, 1: float}>
     */
    public static function keeps(array $recipe, float $duration): array
    {
        $keeps = [];
        $from = 0.0;
        foreach ($recipe['cuts'] as [$start, $end]) {
            if ($start > $from) {
                $keeps[] = [$from, $start];
            }
            $from = max($from, $end);
        }
        if ($duration > $from) {
            $keeps[] = [$from, $duration];
        }

        return $keeps;
    }

    /**
     * Length of the crossfade at each join between two parts that stay (0 for a clean join).
     *
     * @param  Recipe  $recipe
     * @return list<float>
     */
    public static function joins(array $recipe, float $duration): array
    {
        $keeps = self::keeps($recipe, $duration);
        $joins = [];
        for ($index = 1; $index < count($keeps); $index++) {
            $before = $keeps[$index - 1][1] - $keeps[$index - 1][0];
            $after = $keeps[$index][1] - $keeps[$index][0];
            $joins[] = $recipe['join'] > 0 ? round(max(0.01, min($recipe['join'], $before * 0.45, $after * 0.45)), 3) : 0.0;
        }

        return $joins;
    }

    /**
     * How long the edited audio lasts.
     *
     * @param  Recipe  $recipe
     */
    public static function length(array $recipe, float $duration): float
    {
        $kept = array_sum(array_map(fn (array $keep) => $keep[1] - $keep[0], self::keeps($recipe, $duration)));

        return round(max(0, $kept - array_sum(self::joins($recipe, $duration))), 3);
    }

    /**
     * Whether the recipe changes nothing: the edited audio would be the original.
     *
     * @param  Recipe  $recipe
     */
    public static function isPlain(array $recipe): bool
    {
        return array_diff_key($recipe, ['preset' => true]) == array_diff_key(self::defaults(), ['preset' => true]);
    }

    /**
     * Cuts in order, with overlaps merged, edges snapped to the start and the end, and slivers of audio
     * left between two cuts cut too.
     *
     * @param  list<array{0: float, 1: float}>  $cuts
     * @return list<array{0: float, 1: float}>
     */
    private static function merge(array $cuts, float $duration): array
    {
        $cuts = array_map(fn (array $cut) => [min($cut), max($cut)], $cuts);
        usort($cuts, fn (array $a, array $b) => $a[0] <=> $b[0]);

        $merged = [];
        foreach ($cuts as [$start, $end]) {
            $start = $start < self::MIN_KEEP ? 0.0 : $start;
            $end = $end > $duration - self::MIN_KEEP ? $duration : $end;
            if ($end - $start < self::MIN_CUT) {
                continue;
            }
            $last = count($merged) - 1;
            if ($last >= 0 && $start - $merged[$last][1] < self::MIN_KEEP) {
                $merged[$last][1] = max($merged[$last][1], $end);
            } else {
                $merged[] = [$start, $end];
            }
        }

        return array_map(fn (array $cut) => [round($cut[0], 3), round($cut[1], 3)], $merged);
    }

    private static function number(mixed $value, float $min, float $max, int $precision): float
    {
        return is_numeric($value) ? round(self::clamp((float) $value, $min, $max), $precision) : round(self::clamp(0, $min, $max), $precision);
    }

    private static function clamp(float $value, float $min, float $max): float
    {
        return max($min, min($max, is_finite($value) ? $value : $min));
    }
}
