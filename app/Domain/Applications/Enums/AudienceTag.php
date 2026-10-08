<?php

namespace App\Domain\Applications\Enums;

/** Who a future station speaks to, beyond age: an application picks several. */
enum AudienceTag: string
{
    case SchoolStudents = 'school_students';
    case UniversityStudents = 'university_students';
    case Professionals = 'professionals';
    case Entrepreneurs = 'entrepreneurs';
    case Freelancers = 'freelancers';
    case OfficeWorkers = 'office_workers';
    case Drivers = 'drivers';
    case Farmers = 'farmers';
    case Fishers = 'fishers';
    case Miners = 'miners';
    case Merchants = 'merchants';
    case Teachers = 'teachers';
    case HealthWorkers = 'health_workers';
    case PublicServants = 'public_servants';
    case Homemakers = 'homemakers';
    case Athletes = 'athletes';
    case Artists = 'artists';
    case JobSeekers = 'job_seekers';

    case Families = 'families';
    case Parents = 'parents';
    case NewParents = 'new_parents';
    case Couples = 'couples';
    case Singles = 'singles';
    case Retirees = 'retirees';
    case Grandparents = 'grandparents';
    case Caregivers = 'caregivers';

    case Christians = 'christians';
    case Catholics = 'catholics';
    case Evangelicals = 'evangelicals';
    case Adventists = 'adventists';
    case FaithYouth = 'faith_youth';
    case OtherFaiths = 'other_faiths';
    case Spirituality = 'spirituality';

    case Women = 'women';
    case Men = 'men';
    case IndigenousPeoples = 'indigenous_peoples';
    case QuechuaSpeakers = 'quechua_speakers';
    case AymaraSpeakers = 'aymara_speakers';
    case AmazonianCommunities = 'amazonian_communities';
    case AfroDescendants = 'afro_descendants';
    case Migrants = 'migrants';
    case Diaspora = 'diaspora';
    case Foreigners = 'foreigners';
    case Lgbtq = 'lgbtq';
    case PeopleWithDisabilities = 'people_with_disabilities';

    case Neighborhood = 'neighborhood';
    case City = 'city';
    case Region = 'region';
    case Nationwide = 'nationwide';
    case International = 'international';
    case Urban = 'urban';
    case Rural = 'rural';
    case Coast = 'coast';
    case Andes = 'andes';
    case Amazon = 'amazon';

    case Rock = 'rock';
    case Pop = 'pop';
    case Salsa = 'salsa';
    case Cumbia = 'cumbia';
    case Tropical = 'tropical';
    case Criolla = 'criolla';
    case AndeanFolk = 'andean_folk';
    case Huayno = 'huayno';
    case Urbano = 'urbano';
    case HipHop = 'hip_hop';
    case Electronic = 'electronic';
    case Jazz = 'jazz';
    case Classical = 'classical';
    case Ballads = 'ballads';
    case ChristianMusic = 'christian_music';
    case Oldies = 'oldies';
    case Indie = 'indie';
    case Metal = 'metal';
    case RegionalMexican = 'regional_mexican';
    case Bachata = 'bachata';
    case Kpop = 'kpop';

    case News = 'news';
    case LocalNews = 'local_news';
    case Politics = 'politics';
    case Economy = 'economy';
    case PersonalFinance = 'personal_finance';
    case Entrepreneurship = 'entrepreneurship';
    case Sports = 'sports';
    case Football = 'football';
    case Technology = 'technology';
    case Science = 'science';
    case Health = 'health';
    case MentalHealth = 'mental_health';
    case Fitness = 'fitness';
    case Food = 'food';
    case Travel = 'travel';
    case Movies = 'movies';
    case Gaming = 'gaming';
    case Humor = 'humor';
    case Books = 'books';
    case ArtsCulture = 'arts_culture';
    case History = 'history';
    case Traditions = 'traditions';
    case SelfImprovement = 'self_improvement';
    case Education = 'education';
    case Languages = 'languages';
    case Environment = 'environment';
    case Agro = 'agro';
    case Motoring = 'motoring';
    case FashionBeauty = 'fashion_beauty';
    case Pets = 'pets';
    case Parenting = 'parenting';
    case Relationships = 'relationships';
    case CommunityService = 'community_service';

    public function group(): AudienceGroup
    {
        return match ($this) {
            self::SchoolStudents, self::UniversityStudents, self::Professionals, self::Entrepreneurs, self::Freelancers, self::OfficeWorkers,
            self::Drivers, self::Farmers, self::Fishers, self::Miners, self::Merchants, self::Teachers, self::HealthWorkers,
            self::PublicServants, self::Homemakers, self::Athletes, self::Artists, self::JobSeekers => AudienceGroup::Profile,

            self::Families, self::Parents, self::NewParents, self::Couples, self::Singles, self::Retirees,
            self::Grandparents, self::Caregivers => AudienceGroup::LifeStage,

            self::Christians, self::Catholics, self::Evangelicals, self::Adventists, self::FaithYouth,
            self::OtherFaiths, self::Spirituality => AudienceGroup::Faith,

            self::Women, self::Men, self::IndigenousPeoples, self::QuechuaSpeakers, self::AymaraSpeakers, self::AmazonianCommunities,
            self::AfroDescendants, self::Migrants, self::Diaspora, self::Foreigners, self::Lgbtq, self::PeopleWithDisabilities => AudienceGroup::Identity,

            self::Neighborhood, self::City, self::Region, self::Nationwide, self::International, self::Urban, self::Rural,
            self::Coast, self::Andes, self::Amazon => AudienceGroup::Place,

            self::Rock, self::Pop, self::Salsa, self::Cumbia, self::Tropical, self::Criolla, self::AndeanFolk, self::Huayno,
            self::Urbano, self::HipHop, self::Electronic, self::Jazz, self::Classical, self::Ballads, self::ChristianMusic,
            self::Oldies, self::Indie, self::Metal, self::RegionalMexican, self::Bachata, self::Kpop => AudienceGroup::Music,

            default => AudienceGroup::Interests,
        };
    }

    public function label(): string
    {
        return match ($this) {
            self::SchoolStudents => 'Escolares',
            self::UniversityStudents => 'Universitarios',
            self::Professionals => 'Profesionales',
            self::Entrepreneurs => 'Emprendedores',
            self::Freelancers => 'Independientes',
            self::OfficeWorkers => 'Oficinistas',
            self::Drivers => 'Conductores y transportistas',
            self::Farmers => 'Agricultores y ganaderos',
            self::Fishers => 'Pescadores',
            self::Miners => 'Trabajadores mineros',
            self::Merchants => 'Comerciantes',
            self::Teachers => 'Docentes',
            self::HealthWorkers => 'Personal de salud',
            self::PublicServants => 'Servidores públicos',
            self::Homemakers => 'Amas y amos de casa',
            self::Athletes => 'Deportistas',
            self::Artists => 'Artistas y creadores',
            self::JobSeekers => 'Personas en busca de empleo',

            self::Families => 'Familias',
            self::Parents => 'Padres y madres',
            self::NewParents => 'Padres primerizos',
            self::Couples => 'Parejas',
            self::Singles => 'Solteros',
            self::Retirees => 'Jubilados',
            self::Grandparents => 'Abuelos',
            self::Caregivers => 'Cuidadores',

            self::Christians => 'Cristianos',
            self::Catholics => 'Católicos',
            self::Evangelicals => 'Evangélicos',
            self::Adventists => 'Adventistas',
            self::FaithYouth => 'Jóvenes de fe',
            self::OtherFaiths => 'Otras creencias',
            self::Spirituality => 'Espiritualidad sin religión',

            self::Women => 'Mujeres',
            self::Men => 'Hombres',
            self::IndigenousPeoples => 'Pueblos indígenas y originarios',
            self::QuechuaSpeakers => 'Quechuahablantes',
            self::AymaraSpeakers => 'Aimarahablantes',
            self::AmazonianCommunities => 'Comunidades amazónicas',
            self::AfroDescendants => 'Afrodescendientes',
            self::Migrants => 'Migrantes',
            self::Diaspora => 'Peruanos en el extranjero',
            self::Foreigners => 'Extranjeros residentes',
            self::Lgbtq => 'Comunidad LGTBIQ+',
            self::PeopleWithDisabilities => 'Personas con discapacidad',

            self::Neighborhood => 'Barrio o distrito',
            self::City => 'Ciudad',
            self::Region => 'Región',
            self::Nationwide => 'Todo el país',
            self::International => 'Internacional',
            self::Urban => 'Zonas urbanas',
            self::Rural => 'Zonas rurales',
            self::Coast => 'Costa',
            self::Andes => 'Sierra',
            self::Amazon => 'Selva',

            self::Rock => 'Rock',
            self::Pop => 'Pop',
            self::Salsa => 'Salsa',
            self::Cumbia => 'Cumbia',
            self::Tropical => 'Tropical',
            self::Criolla => 'Música criolla',
            self::AndeanFolk => 'Folclore andino',
            self::Huayno => 'Huayno',
            self::Urbano => 'Urbano y reguetón',
            self::HipHop => 'Hip hop y rap',
            self::Electronic => 'Electrónica',
            self::Jazz => 'Jazz y blues',
            self::Classical => 'Clásica',
            self::Ballads => 'Baladas y románticas',
            self::ChristianMusic => 'Música cristiana',
            self::Oldies => 'Clásicos de los 70, 80 y 90',
            self::Indie => 'Indie y alternativa',
            self::Metal => 'Metal',
            self::RegionalMexican => 'Regional mexicana',
            self::Bachata => 'Bachata y merengue',
            self::Kpop => 'K-pop',

            self::News => 'Noticias y actualidad',
            self::LocalNews => 'Noticias locales',
            self::Politics => 'Política',
            self::Economy => 'Economía y negocios',
            self::PersonalFinance => 'Finanzas personales',
            self::Entrepreneurship => 'Emprendimiento',
            self::Sports => 'Deportes',
            self::Football => 'Fútbol',
            self::Technology => 'Tecnología',
            self::Science => 'Ciencia',
            self::Health => 'Salud y bienestar',
            self::MentalHealth => 'Salud mental',
            self::Fitness => 'Vida activa',
            self::Food => 'Gastronomía',
            self::Travel => 'Viajes y turismo',
            self::Movies => 'Cine y series',
            self::Gaming => 'Videojuegos',
            self::Humor => 'Humor',
            self::Books => 'Libros y literatura',
            self::ArtsCulture => 'Arte y cultura',
            self::History => 'Historia',
            self::Traditions => 'Tradiciones y costumbres',
            self::SelfImprovement => 'Desarrollo personal',
            self::Education => 'Educación',
            self::Languages => 'Idiomas',
            self::Environment => 'Medio ambiente',
            self::Agro => 'Agro',
            self::Motoring => 'Autos y motores',
            self::FashionBeauty => 'Moda y belleza',
            self::Pets => 'Mascotas',
            self::Parenting => 'Crianza',
            self::Relationships => 'Relaciones y pareja',
            self::CommunityService => 'Servicio comunitario',
        };
    }

    /**
     * Every tag by family, for the form.
     *
     * @return list<array{value: string, label: string, options: list<array{value: string, label: string}>}>
     */
    public static function grouped(): array
    {
        return array_map(fn (AudienceGroup $group) => [
            'value' => $group->value,
            'label' => $group->label(),
            'options' => array_values(array_map(
                fn (self $tag) => ['value' => $tag->value, 'label' => $tag->label()],
                array_filter(self::cases(), fn (self $tag) => $tag->group() === $group),
            )),
        ], AudienceGroup::cases());
    }
}
