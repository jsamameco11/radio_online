<?php

namespace App\Domain\Integrity\Enums;

/** The patterns of fake audience the scanner looks for. */
enum AlertKind: string
{
    case FollowCluster = 'follow_cluster';
    case FreshAccountWave = 'fresh_account_wave';
    case FollowSpike = 'follow_spike';
    case AudienceSwarm = 'audience_swarm';
    case BlockedPlayers = 'blocked_players';

    public function label(): string
    {
        return match ($this) {
            self::FollowCluster => 'Suscripciones desde una misma red',
            self::FreshAccountWave => 'Ola de cuentas recién creadas',
            self::FollowSpike => 'Pico anormal de suscripciones',
            self::AudienceSwarm => 'Enjambre de reproductores',
            self::BlockedPlayers => 'Reproductores bloqueados',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::FollowCluster => 'Muchas cuentas se suscribieron desde la misma conexión a internet: es la huella típica de una granja de cuentas.',
            self::FreshAccountWave => 'La mayoría de las suscripciones recientes viene de cuentas creadas hace pocos días.',
            self::FollowSpike => 'La radio recibió muchas más suscripciones que de costumbre y varias cuentas nunca la escucharon.',
            self::AudienceSwarm => 'Una misma red abrió decenas de reproductores. Solo cuenta un puñado por red; al depurar, sus reproducciones salen también de las estadísticas.',
            self::BlockedPlayers => 'Reproductores de programas automáticos, de cuentas marcadas o de redes que abrían sesiones sin parar. Ya no suman audiencia; la alerta es informativa.',
        };
    }

    /** Whether the alert is about accounts (subscriptions) rather than anonymous players. */
    public function concernsAccounts(): bool
    {
        return in_array($this, [self::FollowCluster, self::FreshAccountWave, self::FollowSpike], true);
    }

    /** Whether purging does something: blocked players are already out of every figure. */
    public function purgeable(): bool
    {
        return $this !== self::BlockedPlayers;
    }
}
