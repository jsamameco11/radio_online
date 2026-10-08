<?php

namespace App\Domain\Stations\Enums;

/**
 * What a member of a station team may do inside that station's studio.
 */
enum StationPermission: string
{
    case OperateConsole = 'console.operate';
    case ManageSchedule = 'schedule.manage';
    case ManageLibrary = 'library.manage';
    case ManageEpisodes = 'episodes.manage';
    case EditProfile = 'station.profile';
    case ManageSettings = 'station.settings';
    case ManageMembers = 'station.members';
    case ViewGifts = 'gifts.view';
    case ViewFinance = 'finance.view';
    case WithdrawEarnings = 'finance.withdraw';
    case ViewAnalytics = 'analytics.view';
    case SellStation = 'station.sell';
}
