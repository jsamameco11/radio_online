<?php

namespace App\Domain\Chat\Enums;

/**
 * The stickers listeners and the station team can send in a live chat. The
 * art lives in the frontend (resources/js/Components/chat/stickers), keyed
 * by these values: a new case needs its art there too.
 */
enum ChatSticker: string
{
    case HelloBooth = 'hello-booth';
    case GoodMorning = 'good-morning';
    case GoodAfternoon = 'good-afternoon';
    case GoodNight = 'good-night';
    case HelloFromMyCity = 'hello-from-my-city';
    case Thanks = 'thanks';

    case OnAir = 'on-air';
    case Banger = 'banger';
    case RequestSong = 'request-song';
    case VolumeUp = 'volume-up';
    case Dedication = 'dedication';
    case Encore = 'encore';
    case MicDrop = 'mic-drop';
    case Listening = 'listening';

    case Fire = 'fire';
    case LoveIt = 'love-it';
    case Lol = 'lol';
    case Wow = 'wow';
    case Applause = 'applause';
    case Blessings = 'blessings';
    case Strength = 'strength';
    case Hundred = 'hundred';

    case LetsDance = 'lets-dance';
    case HappyBirthday = 'happy-birthday';
    case Cheers = 'cheers';
    case Party = 'party';
    case Friday = 'friday';
    case Weekend = 'weekend';

    public function label(): string
    {
        return match ($this) {
            self::HelloBooth => 'Hola cabina',
            self::GoodMorning => 'Buenos días',
            self::GoodAfternoon => 'Buenas tardes',
            self::GoodNight => 'Buenas noches',
            self::HelloFromMyCity => 'Saludos desde mi ciudad',
            self::Thanks => 'Gracias',
            self::OnAir => 'Al aire',
            self::Banger => 'Temazo',
            self::RequestSong => 'Pide tu canción',
            self::VolumeUp => 'Sube el volumen',
            self::Dedication => 'Dedicatoria',
            self::Encore => '¡Otra!',
            self::MicDrop => 'Mic drop',
            self::Listening => 'Te escucho',
            self::Fire => 'Fuego',
            self::LoveIt => 'Me encanta',
            self::Lol => 'Jajaja',
            self::Wow => 'Wow',
            self::Applause => 'Aplausos',
            self::Blessings => 'Bendiciones',
            self::Strength => 'Fuerza',
            self::Hundred => 'Cien',
            self::LetsDance => 'A bailar',
            self::HappyBirthday => 'Feliz cumpleaños',
            self::Cheers => 'Salud',
            self::Party => 'Fiesta',
            self::Friday => 'Viernes',
            self::Weekend => 'Finde',
        };
    }

    public function pack(): ChatStickerPack
    {
        return match ($this) {
            self::HelloBooth, self::GoodMorning, self::GoodAfternoon, self::GoodNight, self::HelloFromMyCity, self::Thanks => ChatStickerPack::Greetings,
            self::OnAir, self::Banger, self::RequestSong, self::VolumeUp, self::Dedication, self::Encore, self::MicDrop, self::Listening => ChatStickerPack::Radio,
            self::Fire, self::LoveIt, self::Lol, self::Wow, self::Applause, self::Blessings, self::Strength, self::Hundred => ChatStickerPack::Reactions,
            self::LetsDance, self::HappyBirthday, self::Cheers, self::Party, self::Friday, self::Weekend => ChatStickerPack::Party,
        };
    }

    /** "Sticker «Temazo»": how a message that is only a sticker reads as text. */
    public function preview(): string
    {
        return 'Sticker «'.$this->label().'»';
    }

    /**
     * What the sticker picker lists, in order: exactly what the chat accepts.
     *
     * @return list<array{key: string, label: string, pack: string, pack_label: string}>
     */
    public static function catalog(): array
    {
        return array_map(fn (self $sticker) => [
            'key' => $sticker->value,
            'label' => $sticker->label(),
            'pack' => $sticker->pack()->value,
            'pack_label' => $sticker->pack()->label(),
        ], self::cases());
    }
}
