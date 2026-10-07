<?php

use App\Domain\Access\Enums\Permission;
use App\Models\Station;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

/*
| station.{id}         public: what listeners see change (topic, track, gifts on air).
| studio.{id}          private: the station team (incoming gifts, voice messages, audience).
| control.monitor      private: platform staff watching every frequency.
*/

Broadcast::channel('App.Models.User.{id}', fn (User $user, int $id) => $user->id === $id);

Broadcast::channel('studio.{stationId}', function (User $user, int $stationId) {
    $station = Station::query()->find($stationId);

    return $station !== null && ($user->roleIn($station) !== null || $user->can(Permission::EnterAnyStudio->value));
});

Broadcast::channel('control.monitor', fn (User $user) => $user->can(Permission::MonitorStreams->value));
