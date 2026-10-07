<?php

namespace App\Domain\Access\Enums;

/**
 * Platform permissions checked with `$user->can(Permission::X->value)`.
 */
enum Permission: string
{
    case ViewDashboard = 'dashboard.view';
    case ViewStations = 'stations.view';
    case UpdateStations = 'stations.update';
    case SuspendStations = 'stations.suspend';
    case EnterAnyStudio = 'studios.enter';
    case ViewFrequencies = 'frequencies.view';
    case AssignFrequencies = 'frequencies.assign';
    case ReleaseFrequencies = 'frequencies.release';
    case ReviewFrequencyRequests = 'frequency_requests.review';
    case MonitorStreams = 'streams.monitor';
    case ViewUsers = 'users.view';
    case ManageUsers = 'users.manage';
    case ManageRoles = 'roles.manage';
    case ManageCategories = 'categories.manage';
    case ManageGifts = 'gifts.manage';
    case ViewPayments = 'payments.view';
    case RefundPayments = 'payments.refund';
    case AdjustWallets = 'wallets.adjust';
    case ManageModeration = 'moderation.manage';
    case ViewAudit = 'audit.view';
    case ViewAnalytics = 'analytics.view';
    case ManageSettings = 'settings.manage';
}
