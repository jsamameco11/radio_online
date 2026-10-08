<?php

namespace App\Http\Controllers\Account;

use App\Domain\Access\Actions\UpdateProfile;
use App\Domain\Frequencies\Enums\FrequencyRequestStatus;
use App\Domain\Storage\MediaStorage;
use App\Http\Controllers\Controller;
use App\Http\Requests\Account\UpdateProfileRequest;
use App\Http\Resources\Site\FrequencyRequestResource;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    public function edit(Request $request, MediaStorage $storage): Response
    {
        $user = $request->user();

        return Inertia::render('Account/Profile', [
            'profile' => [
                'name' => $user->name,
                'email' => $user->email,
                'country' => $user->country,
                'avatar_url' => $storage->url($user->avatar_path),
                'email_verified' => $user->hasVerifiedEmail(),
                'member_since' => $user->created_at->toIso8601String(),
            ],
            'resendVerificationUrl' => route('verification.send', absolute: false),
            'frequencyPayments' => FrequencyRequestResource::collection(
                $user->frequencyRequests()
                    ->whereIn('status', [FrequencyRequestStatus::Pending->value, FrequencyRequestStatus::AwaitingPayment->value])
                    ->whereHas('payment')
                    ->with(['frequency', 'payment'])
                    ->latest()
                    ->get(),
            )->resolve($request),
        ]);
    }

    public function update(UpdateProfileRequest $request, UpdateProfile $update): RedirectResponse
    {
        $user = $request->user();
        $previousEmail = $user->email;

        $update->handle(
            $user,
            $request->string('name')->trim()->toString(),
            $request->string('email')->toString(),
            $request->input('country'),
        );

        return back()->with('success', $previousEmail === $user->email
            ? 'Guardamos tu perfil.'
            : 'Guardamos tu perfil. Te enviamos un enlace para verificar tu nuevo correo.');
    }
}
