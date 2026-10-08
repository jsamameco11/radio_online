<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('frequency_listings', function (Blueprint $table) {
            $table->id();
            $table->boolean('by_platform')->default(false);
            $table->foreignId('station_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('frequency_id')->constrained()->restrictOnDelete();
            $table->foreignId('seller_id')->constrained('users')->restrictOnDelete();
            $table->unsignedBigInteger('price_cents');
            $table->char('currency', 3);
            $table->string('pitch', 600)->nullable();
            $table->string('status', 16)->default('active')->index();
            $table->string('payout_method', 20)->nullable();
            $table->text('payout_details')->nullable();
            $table->foreignId('buyer_id')->nullable()->constrained('users')->restrictOnDelete();
            $table->timestamp('sold_at')->nullable();
            $table->unsignedBigInteger('processor_fee_cents')->nullable();
            $table->unsignedBigInteger('fee_cents')->nullable();
            $table->unsignedBigInteger('tax_cents')->nullable();
            $table->unsignedBigInteger('settled_balance_cents')->nullable();
            $table->unsignedBigInteger('payout_cents')->nullable();
            $table->foreignId('purchase_transaction_id')->nullable()->constrained('wallet_transactions')->restrictOnDelete();
            $table->string('payout_status', 16)->nullable()->index();
            $table->string('payout_reference', 120)->nullable();
            $table->string('payout_note', 500)->nullable();
            $table->foreignId('paid_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('cancelled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('cancelled_at')->nullable();
            $table->timestamps();
            $table->index(['station_id', 'status']);
            $table->index(['frequency_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('frequency_listings');
    }
};
