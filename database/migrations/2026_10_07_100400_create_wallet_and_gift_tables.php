<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Money moves only through the ledger: a wallet's balance is always the
 * result of its posted transactions, every movement keeps the balance before
 * and after, and an idempotency key makes a retried request harmless.
 *
 * Amounts are integer cents of the platform currency.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallets', function (Blueprint $table) {
            $table->id();
            $table->string('owner_type', 60);
            $table->unsignedBigInteger('owner_id');
            $table->char('currency', 3)->default('USD');
            $table->bigInteger('balance_cents')->default(0);
            $table->string('status', 16)->default('active');
            $table->timestamps();
            $table->unique(['owner_type', 'owner_id', 'currency']);
        });

        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->restrictOnDelete();
            $table->string('type', 24)->index();
            $table->bigInteger('amount_cents');
            $table->bigInteger('balance_before_cents');
            $table->bigInteger('balance_after_cents');
            $table->char('currency', 3);
            $table->string('status', 16)->default('posted');
            $table->string('idempotency_key', 120)->unique();
            $table->string('description', 255)->nullable();
            $table->string('source_type', 60)->nullable();
            $table->string('source_id', 36)->nullable();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('meta')->nullable();
            $table->timestamp('created_at');
            $table->index(['wallet_id', 'created_at']);
            $table->index(['source_type', 'source_id']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('provider', 20);
            $table->string('provider_reference', 255)->nullable()->unique();
            $table->bigInteger('amount_cents');
            $table->char('currency', 3);
            $table->string('status', 16)->default('pending')->index();
            $table->foreignId('wallet_transaction_id')->nullable()->constrained()->nullOnDelete();
            $table->text('checkout_url')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('failure_reason', 300)->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });

        Schema::create('gifts', function (Blueprint $table) {
            $table->id();
            $table->string('name', 40);
            $table->string('slug', 50)->unique();
            $table->string('emoji', 16)->nullable();
            $table->string('image_path')->nullable();
            $table->unsignedInteger('price_cents');
            $table->string('animation', 30)->nullable();
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('gift_transactions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('gift_id')->constrained()->restrictOnDelete();
            $table->foreignId('sender_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('station_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('quantity')->default(1);
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('total_cents');
            $table->unsignedInteger('platform_fee_cents');
            $table->unsignedInteger('station_amount_cents');
            $table->foreignId('debit_transaction_id')->constrained('wallet_transactions')->restrictOnDelete();
            $table->foreignId('credit_transaction_id')->constrained('wallet_transactions')->restrictOnDelete();
            $table->boolean('anonymous')->default(false);
            $table->string('idempotency_key', 120)->unique();
            $table->timestamps();
            $table->index(['station_id', 'created_at']);
            $table->index(['sender_id', 'created_at']);
        });

        Schema::create('gift_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('gift_transaction_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('body', 280)->nullable();
            $table->string('voice_path')->nullable();
            $table->string('voice_mime', 80)->nullable();
            $table->decimal('voice_duration', 6, 2)->nullable();
            $table->string('status', 16)->default('visible')->index();
            $table->timestamp('played_at')->nullable();
            $table->foreignId('played_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gift_messages');
        Schema::dropIfExists('gift_transactions');
        Schema::dropIfExists('gifts');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('wallet_transactions');
        Schema::dropIfExists('wallets');
    }
};
