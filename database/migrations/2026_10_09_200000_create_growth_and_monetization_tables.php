<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Growth program and monetization: the milestones a station unlocked, its
 * requests to be monetized and, once monetized, the withdrawals of its
 * earnings. A withdrawal debits the station wallet when it is requested and
 * is either paid by the platform or rejected (and credited back).
 *
 * Payout details (holder, account, phone or e-mail) are stored encrypted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stations', function (Blueprint $table) {
            $table->timestamp('monetized_at')->nullable()->after('suspension_reason');
        });

        Schema::create('station_achievements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->string('key', 40);
            $table->timestamp('achieved_at');
            $table->timestamps();
            $table->unique(['station_id', 'key']);
        });

        Schema::create('monetization_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->restrictOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 16)->default('pending')->index();
            $table->unsignedInteger('subscribers');
            $table->json('snapshot');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->timestamps();
            $table->index(['station_id', 'created_at']);
        });

        Schema::create('withdrawal_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->restrictOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->char('currency', 3);
            $table->string('status', 16)->default('pending')->index();
            $table->string('payout_method', 20);
            $table->text('payout_details');
            $table->foreignId('debit_transaction_id')->nullable()->constrained('wallet_transactions')->restrictOnDelete();
            $table->foreignId('reversal_transaction_id')->nullable()->constrained('wallet_transactions')->restrictOnDelete();
            $table->string('paid_reference', 120)->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->string('review_note', 500)->nullable();
            $table->timestamps();
            $table->index(['station_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('withdrawal_requests');
        Schema::dropIfExists('monetization_requests');
        Schema::dropIfExists('station_achievements');

        Schema::table('stations', function (Blueprint $table) {
            $table->dropColumn('monetized_at');
        });
    }
};
