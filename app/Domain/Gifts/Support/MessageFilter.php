<?php

namespace App\Domain\Gifts\Support;

/**
 * Masks the words a station blocked in listener messages ("tonto" → "*****"),
 * matching whole words regardless of case.
 */
final class MessageFilter
{
    /**
     * @param  list<string>  $blockedWords
     * @return array{text: string, flagged: bool}
     */
    public static function apply(string $text, array $blockedWords): array
    {
        $flagged = false;

        foreach ($blockedWords as $word) {
            $word = trim($word);
            if ($word === '') {
                continue;
            }

            $pattern = '/(?<![\pL\pN])'.preg_quote($word, '/').'(?![\pL\pN])/iu';
            $text = (string) preg_replace_callback($pattern, function (array $match) use (&$flagged) {
                $flagged = true;

                return str_repeat('*', mb_strlen($match[0]));
            }, $text);
        }

        return ['text' => $text, 'flagged' => $flagged];
    }
}
