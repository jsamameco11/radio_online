<?php

namespace App\Domain\Stories\Support;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use Throwable;

/** Reads the real length of a video with ffprobe, installed next to the configured ffmpeg. */
class VideoProbe
{
    /** Whether ffprobe answers on this server. */
    public function available(): bool
    {
        return Cache::remember('stories:ffprobe-available', 600, function () {
            try {
                return Process::timeout(10)->run([$this->binary(), '-hide_banner', '-version'])->successful();
            } catch (Throwable) {
                return false;
            }
        });
    }

    /** Seconds of the video, or null when it cannot be read. */
    public function seconds(string $path): ?float
    {
        try {
            $result = Process::timeout(30)->run([
                $this->binary(), '-v', 'error',
                '-show_entries', 'format=duration',
                '-of', 'default=noprint_wrappers=1:nokey=1',
                $path,
            ]);
        } catch (Throwable) {
            return null;
        }
        $seconds = (float) trim($result->output());

        return $result->successful() && is_finite($seconds) && $seconds > 0 ? $seconds : null;
    }

    private function binary(): string
    {
        $ffmpeg = (string) config('platform.media.ffmpeg');
        $name = basename($ffmpeg);

        return substr($ffmpeg, 0, strlen($ffmpeg) - strlen($name)).str_ireplace('ffmpeg', 'ffprobe', $name);
    }
}
