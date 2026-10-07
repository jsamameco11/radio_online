<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The live chat of every station: listeners write while a host is on air,
 * the team answers as the station, and a highlighted message keeps the
 * money it moved (what the listener paid, the processor and platform fees
 * and what the station was credited) next to its two ledger rows.
 * The team can silence a listener in its chat for a while or for good.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stream_session_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('sent_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('author', 16);
            $table->foreignUuid('reply_to_id')->nullable()->constrained('chat_messages')->nullOnDelete();
            $table->string('body', 500);
            $table->string('status', 16)->default('visible');
            $table->unsignedInteger('highlight_cents')->default(0);
            $table->unsignedInteger('processor_fee_cents')->default(0);
            $table->unsignedInteger('platform_fee_cents')->default(0);
            $table->unsignedInteger('station_amount_cents')->default(0);
            $table->timestamp('pinned_until')->nullable();
            $table->foreignId('debit_transaction_id')->nullable()->constrained('wallet_transactions')->restrictOnDelete();
            $table->foreignId('credit_transaction_id')->nullable()->constrained('wallet_transactions')->restrictOnDelete();
            $table->string('idempotency_key', 120)->nullable()->unique();
            $table->foreignId('hidden_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('hidden_at')->nullable();
            $table->timestamps();
            $table->index(['station_id', 'created_at']);
            $table->index(['station_id', 'pinned_until']);
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('chat_mutes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('muted_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('until')->nullable();
            $table->timestamps();
            $table->unique(['station_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_mutes');
        Schema::dropIfExists('chat_messages');
    }
};
