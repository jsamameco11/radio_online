<?php

namespace App\Domain\Studio\Editor;

use App\Domain\Stations\Support\CurrentStation;
use App\Domain\Storage\MediaStorage;
use App\Domain\Studio\Library\AudioFile;
use App\Domain\Studio\Library\PlayoutCaches;
use App\Models\Track;
use Illuminate\Contracts\Process\ProcessResult;
use Illuminate\Filesystem\AwsS3V3Adapter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Edits audio of the station library with ffmpeg, without ever losing the original: the first
 * edit keeps the original file aside, and every edit is rendered again from it with the whole
 * recipe, so an edit can be reopened, adjusted or undone.
 *
 * @phpstan-import-type Recipe from EditRecipe
 */
final class AudioEditor
{
    /** Seconds of the edited audio the editor plays when asking for the final result. */
    public const PREVIEW_SECONDS = 15;

    public const UNAVAILABLE = 'El editor de audio no está disponible en este servidor. Pide al equipo técnico que instale ffmpeg.';

    /** An edit still "processing" after this many seconds per second of audio (and at least 15 minutes) was interrupted. */
    private const STALE_FACTOR = 0.6;

    public function __construct(
        private readonly MediaStorage $storage,
        private readonly CurrentStation $current,
        private readonly PlayoutCaches $caches,
    ) {}

    /** Whether ffmpeg answers on this server. */
    public function available(): bool
    {
        return Cache::remember('editor:ffmpeg-available', 600, function () {
            try {
                return Process::timeout(10)->run([$this->binary(), '-hide_banner', '-version'])->successful();
            } catch (Throwable) {
                return false;
            }
        });
    }

    /**
     * Waveform and loudness of the audio the editor works from, measured once per file. The peaks are
     * base64 of signed bytes: a minimum and a maximum for each slice of 1/perSecond seconds.
     *
     * @return array{perSecond: int, peaks: string, duration: float, loudness: ?float, peak: ?float}|null
     */
    public function analysis(Track $track): ?array
    {
        $path = $track->sourcePath();
        $key = $this->current->key('editor.analysis.'.md5($path));
        $known = Cache::get($key);
        if (is_array($known)) {
            return $known;
        }
        $input = $this->input($path);
        if ($input === null || ! $this->available()) {
            return null;
        }

        $duration = max(1.0, $track->sourceDuration());
        $perSecond = $duration <= 600 ? 100 : ($duration <= 1800 ? 40 : max(8, intdiv(120000, (int) ceil($duration))));
        $rate = $duration <= 1200 ? 8000 : max(2000, (int) floor(9_600_000 / $duration));
        $rate = max($perSecond, intdiv($rate, $perSecond) * $perSecond);
        $pcm = $this->temporary('pcm');

        try {
            $result = $this->ffmpeg([
                '-nostats', '-i', $input,
                '-filter_complex', "[0:a]aformat=channel_layouts=stereo,asplit=2[w][l];[w]pan=mono|c0=0.5*c0+0.5*c1,aresample={$rate}[p];[l]ebur128=peak=true:framelog=quiet[e]",
                '-map', '[p]', '-f', 's16le', '-c:a', 'pcm_s16le', $pcm,
                '-map', '[e]', '-f', 'null', '-',
            ], 240, 'info');
            if (! $result->successful() || ! is_file($pcm)) {
                return null;
            }
            [$peaks, $samples] = $this->peaks($pcm, intdiv($rate, $perSecond));
        } finally {
            @unlink($pcm);
        }
        if ($samples === 0) {
            return null;
        }

        $log = $result->errorOutput();
        $analysis = [
            'perSecond' => $perSecond,
            'peaks' => base64_encode($peaks),
            'duration' => round($samples / $rate, 3),
            'loudness' => preg_match_all('/I:\s+(-?[\d.]+) LUFS/', $log, $loud) ? (float) end($loud[1]) : null,
            'peak' => preg_match_all('/Peak:\s+(-?[\d.]+) dBFS/', $log, $peak) ? (float) end($peak[1]) : null,
        ];
        Cache::put($key, $analysis, now()->addDays(30));

        return $analysis;
    }

    /**
     * Renders the recipe from the original and puts the result in the library in place of the audio.
     *
     * @param  Recipe  $recipe
     *
     * @throws RuntimeException when ffmpeg or the storage fail
     */
    public function render(Track $track, array $recipe): void
    {
        $duration = $track->sourceDuration();
        $input = $this->input($track->sourcePath()) ?? throw new RuntimeException('No encontramos el archivo original de este audio.');
        $target = $this->temporary('mp3');

        try {
            $result = $this->ffmpeg([
                '-i', $input,
                '-filter_complex', FilterGraph::build($recipe, $duration, $this->loudnessGain($recipe, $duration, $input)),
                '-map', '[out]', '-c:a', 'libmp3lame', '-q:a', '2', '-map_metadata', '-1', $target,
            ], max(600, (int) ceil($duration * 3)));
            if (! $result->successful() || ! is_file($target) || filesize($target) === 0) {
                throw $this->failure('No se pudo procesar el audio. Revisa que el archivo original no esté dañado e inténtalo de nuevo.', $result);
            }
            $size = (int) filesize($target);
            $stored = $this->store($target, $track);
        } finally {
            @unlink($target);
        }

        $track->refresh();
        $previous = $track->file_path;
        $track->forceFill([
            'original_path' => $track->original_path ?: $track->file_path,
            'original_duration' => $track->original_path ? $track->original_duration : $track->duration,
            'file_path' => $stored,
            'mime' => 'audio/mpeg',
            'size_bytes' => $size,
            'duration' => EditRecipe::length($recipe, $duration),
            'edit' => $recipe,
            'edit_status' => null,
            'edit_error' => null,
            'edited_at' => now(),
        ])->save();
        if ($previous !== $track->original_path) {
            $this->storage->delete($previous);
        }
        $this->retime($track);
    }

    /**
     * A few seconds of the edited audio from a point of the edited timeline, rendered exactly as saving would.
     * Returns the path of a temporary MP3 the caller deletes.
     *
     * @param  Recipe  $recipe
     *
     * @throws RuntimeException
     */
    public function preview(Track $track, array $recipe, float $at): string
    {
        $duration = $track->sourceDuration();
        $input = $this->input($track->sourcePath()) ?? throw new RuntimeException('No encontramos el archivo de este audio.');
        $at = max(0, min($at, EditRecipe::length($recipe, $duration) - 1));
        $loudness = $recipe['normalize'] ? ($this->analysis($track)['loudness'] ?? null) : null;
        $target = $this->temporary('mp3');

        $result = $this->ffmpeg([
            '-i', $input,
            '-filter_complex', FilterGraph::build($recipe, $duration, $loudness === null ? 0.0 : self::clamp(FilterGraph::TARGET_LUFS - $loudness)),
            '-map', '[out]', '-ss', sprintf('%.3F', $at), '-t', (string) self::PREVIEW_SECONDS,
            '-c:a', 'libmp3lame', '-b:a', '192k', $target,
        ], 180);
        if (! $result->successful() || ! is_file($target) || filesize($target) === 0) {
            @unlink($target);

            throw $this->failure('No se pudo preparar la muestra. Inténtalo de nuevo en un momento.', $result);
        }

        return $target;
    }

    /** Puts the original audio back and forgets the edit. */
    public function restore(Track $track): void
    {
        if (! $track->original_path) {
            return;
        }
        $edited = $track->file_path;
        $original = $track->original_path;
        $track->forceFill([
            'file_path' => $original,
            'mime' => AudioFile::contentType(pathinfo($original, PATHINFO_EXTENSION)),
            'duration' => $track->original_duration ?: $track->duration,
            'original_path' => null,
            'original_duration' => null,
            'edit' => null,
            'edit_status' => null,
            'edit_error' => null,
            'edited_at' => null,
        ])->save();
        if ($edited !== $original) {
            $this->storage->delete($edited);
        }
        $this->retime($track);
    }

    /** Whether an edit marked as processing was cut off (the server restarted, the worker was killed). */
    public function isStale(Track $track): bool
    {
        return $track->edit_status === EditStatus::Processing->value
            && $track->updated_at !== null
            && $track->updated_at->lt(now()->subSeconds(max(900, (int) ($track->sourceDuration() * self::STALE_FACTOR))));
    }

    /**
     * dB that bring the processed audio to the target loudness, measured with a first pass.
     *
     * @param  Recipe  $recipe
     */
    private function loudnessGain(array $recipe, float $duration, string $input): float
    {
        if (! $recipe['normalize']) {
            return 0.0;
        }
        $result = $this->ffmpeg([
            '-nostats', '-i', $input,
            '-filter_complex', FilterGraph::build($recipe, $duration, 0.0, true),
            '-map', '[out]', '-f', 'null', '-',
        ], max(600, (int) ceil($duration * 3)), 'info');
        if (! $result->successful() || preg_match('/"input_i"\s*:\s*"(-?[\d.]+)"/', $result->errorOutput(), $match) !== 1 || ! is_finite((float) $match[1])) {
            throw new RuntimeException('No se pudo medir el volumen del audio para normalizarlo.');
        }

        return self::clamp(FilterGraph::TARGET_LUFS - (float) $match[1]);
    }

    /** A new length reaches what is already scheduled with this audio, and listeners hear the new file. */
    private function retime(Track $track): void
    {
        $track->slots()->where('starts_at', '>=', now())->update(['duration' => $track->duration]);
        $this->caches->flush();
    }

    /**
     * Minimum and maximum of every slice of a 16-bit mono PCM file, scaled to signed bytes, read in chunks.
     *
     * @return array{0: string, 1: int} bytes and number of samples read
     */
    private function peaks(string $pcm, int $slice): array
    {
        $handle = fopen($pcm, 'rb');
        if ($handle === false) {
            return ['', 0];
        }
        $bytes = '';
        $count = 0;
        $low = 0;
        $high = 0;
        $filled = 0;
        $carry = '';
        while (! feof($handle)) {
            $chunk = $carry.(string) fread($handle, 65536);
            $even = strlen($chunk) - (strlen($chunk) % 2);
            $carry = substr($chunk, $even);
            if ($even === 0) {
                continue;
            }
            foreach (unpack('s*', substr($chunk, 0, $even)) ?: [] as $sample) {
                $low = min($low, $sample);
                $high = max($high, $sample);
                if (++$filled === $slice) {
                    $bytes .= pack('cc', intdiv($low, 256), intdiv($high, 256));
                    $low = $high = $filled = 0;
                }
                $count++;
            }
        }
        fclose($handle);
        if ($filled > 0) {
            $bytes .= pack('cc', intdiv($low, 256), intdiv($high, 256));
        }

        return [$bytes, $count];
    }

    /** What ffmpeg reads for a stored key: a signed link on Wasabi, the file itself on a local disk. */
    private function input(?string $key): ?string
    {
        if ($key === null || $key === '') {
            return null;
        }
        $disk = $this->storage->disk($this->storage->folderOf($key));
        if ($disk instanceof AwsS3V3Adapter) {
            return $disk->temporaryUrl($key, now()->addHours(3));
        }

        return $disk->exists($key) ? $disk->path($key) : null;
    }

    /** Stores a rendered file in the folder of the audio's kind and returns its key. */
    private function store(string $file, Track $track): string
    {
        $stream = fopen($file, 'rb');
        if ($stream === false) {
            throw new RuntimeException('No se pudo leer el audio procesado.');
        }
        try {
            return $this->storage->put($stream, AudioFile::folder($track->kind), 'mp3', $track->station_id);
        } catch (Throwable $exception) {
            report($exception);

            throw new RuntimeException('No se pudo guardar el audio procesado.');
        } finally {
            if (is_resource($stream)) {
                fclose($stream);
            }
        }
    }

    /** A message the team can act on; ffmpeg's own output only goes to the log. */
    private function failure(string $message, ProcessResult $result): RuntimeException
    {
        Log::warning('Editor de audio: '.$message, ['ffmpeg' => Str::limit(trim($result->errorOutput() ?: $result->output()), 1000)]);

        return new RuntimeException($message);
    }

    /**
     * Runs ffmpeg with low priority on Linux, so the web stays fast while it works.
     *
     * @param  list<string>  $arguments
     */
    private function ffmpeg(array $arguments, int $timeout, string $logLevel = 'error'): ProcessResult
    {
        $command = [$this->binary(), '-hide_banner', '-loglevel', $logLevel, '-y', ...$arguments];
        if (PHP_OS_FAMILY === 'Linux') {
            $command = ['nice', '-n', '10', ...$command];
        }

        return Process::timeout($timeout)->run($command);
    }

    private function binary(): string
    {
        return (string) config('platform.media.ffmpeg');
    }

    private function temporary(string $extension): string
    {
        $directory = storage_path('app/editor-tmp');
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        return $directory.'/'.Str::lower(Str::random(16)).'.'.$extension;
    }

    private static function clamp(float $gain): float
    {
        return max(-20.0, min(20.0, round($gain, 2)));
    }
}
