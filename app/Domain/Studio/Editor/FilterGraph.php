<?php

namespace App\Domain\Studio\Editor;

/**
 * Turns an edit recipe into an ffmpeg filter graph, in the order a mastering chain works:
 * cuts and joins, rumble cut, noise reduction, voice and stereo (mid/side), equalizer,
 * de-esser, compressor, level, fades and a safety limiter. The editor previews the same
 * chain with the Web Audio API (lib/media/editor/engine.ts), with the same formulas.
 *
 * @phpstan-import-type Recipe from EditRecipe
 */
final class FilterGraph
{
    public const SAMPLE_RATE = 44100;

    /** Loudness the "normalize" option brings an audio to, the level streaming services use. */
    public const TARGET_LUFS = -14.0;

    /** Short fade at both sides of a clean join, so a cut never clicks. */
    private const ANTI_CLICK = 0.012;

    /**
     * @param  Recipe  $recipe
     * @param  float  $loudnessGain  extra dB that brings the processed audio to TARGET_LUFS
     * @param  bool  $measure  end measuring the loudness (loudnorm) instead of leveling and limiting
     */
    public static function build(array $recipe, float $duration, float $loudnessGain = 0.0, bool $measure = false): string
    {
        $graph = ['[0:a]aformat=sample_fmts=fltp:sample_rates='.self::SAMPLE_RATE.':channel_layouts=stereo[src]'];
        $label = self::cuts($recipe, $duration, $graph);

        $chain = [];
        if ($recipe['lowcut']) {
            $chain[] = 'highpass=f=80:p=2';
        }
        if ($recipe['denoise'] > 0) {
            $chain[] = 'afftdn=nr='.self::n(6 + $recipe['denoise'] * 0.24).':nf=-45:tn=1';
        }
        $label = self::stage($graph, $label, 'pre', $chain);
        $label = self::midSide($recipe, $graph, $label);

        $chain = [];
        foreach (EditRecipe::EQ_BANDS as $band => $frequency) {
            $gain = (float) $recipe['eq'][$band];
            if ($gain == 0.0) {
                continue;
            }
            $chain[] = match ($band) {
                0 => 'bass=g='.self::n($gain).':f='.$frequency.':t=q:w=0.707',
                count(EditRecipe::EQ_BANDS) - 1 => 'treble=g='.self::n($gain).':f='.$frequency.':t=q:w=0.707',
                default => 'equalizer=f='.$frequency.':t=q:w=1:g='.self::n($gain),
            };
        }
        if ($recipe['deess'] > 0) {
            $chain[] = 'deesser=i='.self::n(0.1 + $recipe['deess'] * 0.006).':m=0.5:f=0.5:s=o';
        }
        if ($recipe['compress'] > 0) {
            [$threshold, $ratio, $makeup] = self::compressor($recipe['compress']);
            $chain[] = 'acompressor=threshold='.self::n(10 ** ($threshold / 20), 6).':ratio='.self::n($ratio).':attack=15:release=180:knee=2.828:makeup='.self::n(min(64, 10 ** ($makeup / 20)));
        }
        $level = $recipe['gain'] + $loudnessGain;
        if ($level != 0.0) {
            $chain[] = 'volume='.self::n($level).'dB';
        }
        if ($measure) {
            $chain[] = 'loudnorm=I='.self::n(self::TARGET_LUFS).':TP=-1.5:LRA=11:print_format=json';
        } else {
            $length = EditRecipe::length($recipe, $duration);
            if ($recipe['fadeIn'] > 0) {
                $chain[] = 'afade=t=in:st=0:d='.self::n($recipe['fadeIn']);
            }
            if ($recipe['fadeOut'] > 0) {
                $chain[] = 'afade=t=out:st='.self::n(max(0, $length - $recipe['fadeOut'])).':d='.self::n($recipe['fadeOut']);
            }
            $chain[] = 'alimiter=limit='.($recipe['normalize'] ? '0.841' : '0.977').':attack=5:release=50:level=0';
        }
        $chain[] = 'aresample='.self::SAMPLE_RATE;
        $graph[] = "[{$label}]".implode(',', $chain).'[out]';

        return implode(';', $graph);
    }

    /**
     * Threshold (dB), ratio and makeup gain (dB) of the compressor for an amount from 1 to 100.
     *
     * @return array{0: float, 1: float, 2: float}
     */
    public static function compressor(int $amount): array
    {
        $threshold = -10 - $amount * 0.2;
        $ratio = 1.5 + $amount * 0.045;

        return [$threshold, $ratio, -$threshold * (1 - 1 / $ratio) * 0.5];
    }

    /**
     * Gains (dB) of the mid/side stage: the center (where the voice is), its presence boost at 3 kHz,
     * and the sides (the wide instruments).
     *
     * @param  Recipe  $recipe
     * @return array{mid: float, presence: float, side: float}
     */
    public static function midSideGains(array $recipe): array
    {
        return [
            'mid' => $recipe['voice'] * 0.06,
            'presence' => $recipe['voice'] * 0.05,
            'side' => -$recipe['voice'] * 0.08 + $recipe['width'] * 0.06,
        ];
    }

    /**
     * Keeps the parts that stay, joined cleanly or crossfaded, and returns the label of the result.
     *
     * @param  Recipe  $recipe
     * @param  list<string>  $graph
     */
    private static function cuts(array $recipe, float $duration, array &$graph): string
    {
        if ($recipe['cuts'] === []) {
            return 'src';
        }
        $keeps = EditRecipe::keeps($recipe, $duration);
        if (count($keeps) === 1) {
            $graph[] = '[src]atrim=start='.self::n($keeps[0][0], 3).':end='.self::n($keeps[0][1], 3).',asetpts=PTS-STARTPTS[cut]';

            return 'cut';
        }

        $joins = EditRecipe::joins($recipe, $duration);
        $count = count($keeps);
        $graph[] = '[src]asplit='.$count.implode('', array_map(fn (int $index) => "[s{$index}]", range(0, $count - 1)));
        foreach ($keeps as $index => [$start, $end]) {
            $part = '[s'.$index.']atrim=start='.self::n($start, 3).':end='.self::n($end, 3).',asetpts=PTS-STARTPTS';
            if ($recipe['join'] == 0.0) {
                if ($index > 0) {
                    $part .= ',afade=t=in:st=0:d='.self::ANTI_CLICK;
                }
                if ($index < $count - 1) {
                    $part .= ',afade=t=out:st='.self::n(max(0, $end - $start - self::ANTI_CLICK), 3).':d='.self::ANTI_CLICK;
                }
            }
            $graph[] = $part."[k{$index}]";
        }

        if ($recipe['join'] == 0.0) {
            $graph[] = implode('', array_map(fn (int $index) => "[k{$index}]", range(0, $count - 1))).'concat=n='.$count.':v=0:a=1[cut]';

            return 'cut';
        }
        $previous = 'k0';
        foreach ($joins as $index => $length) {
            $next = $index === count($joins) - 1 ? 'cut' : 'x'.($index + 1);
            $graph[] = "[{$previous}][k".($index + 1).']acrossfade=d='.self::n($length, 3).":c1=tri:c2=tri[{$next}]";
            $previous = $next;
        }

        return 'cut';
    }

    /**
     * Raises the voice (the center of a stereo mix) over the instruments and widens or narrows the stereo.
     *
     * @param  Recipe  $recipe
     * @param  list<string>  $graph
     */
    private static function midSide(array $recipe, array &$graph, string $label): string
    {
        if ($recipe['voice'] === 0 && $recipe['width'] === 0) {
            return $label;
        }
        $gains = self::midSideGains($recipe);
        $mid = 'pan=mono|c0=0.5*c0+0.5*c1';
        if ($gains['presence'] > 0) {
            $mid .= ',equalizer=f=3000:t=q:w=1:g='.self::n($gains['presence']);
        }
        if ($gains['mid'] != 0.0) {
            $mid .= ',volume='.self::n($gains['mid']).'dB';
        }
        $side = 'pan=mono|c0=0.5*c0-0.5*c1'.($gains['side'] != 0.0 ? ',volume='.self::n($gains['side']).'dB' : '');
        $graph[] = "[{$label}]asplit=2[ma][sa]";
        $graph[] = "[ma]{$mid}[mid]";
        $graph[] = "[sa]{$side}[side]";
        $graph[] = '[mid][side]amerge=inputs=2,pan=stereo|c0=c0+c1|c1=c0-c1[ms]';

        return 'ms';
    }

    /**
     * Adds a chain of filters as its own step, when there is any.
     *
     * @param  list<string>  $graph
     * @param  list<string>  $chain
     */
    private static function stage(array &$graph, string $label, string $name, array $chain): string
    {
        if ($chain === []) {
            return $label;
        }
        $graph[] = "[{$label}]".implode(',', $chain)."[{$name}]";

        return $name;
    }

    /** A number as ffmpeg reads it: dot decimals whatever the locale, no trailing zeros. */
    private static function n(float $value, int $decimals = 2): string
    {
        $text = sprintf('%.'.$decimals.'F', $value);
        $text = str_contains($text, '.') ? rtrim(rtrim($text, '0'), '.') : $text;

        return $text === '-0' ? '0' : $text;
    }
}
