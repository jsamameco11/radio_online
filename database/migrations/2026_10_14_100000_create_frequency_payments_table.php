<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('frequencies', function (Blueprint $table) {
            $table->unsignedBigInteger('price_cents')->nullable()->after('status');
        });

        Schema::create('frequency_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('frequency_request_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('frequency_id')->constrained()->restrictOnDelete();
            $table->unsignedBigInteger('amount_cents');
            $table->char('currency', 3);
            $table->string('provider', 20);
            $table->string('status', 16)->default('card_required')->index();
            $table->string('customer_id', 64)->nullable();
            $table->string('card_id', 64)->nullable();
            $table->string('card_brand', 30)->nullable();
            $table->string('card_last_four', 4)->nullable();
            $table->timestamp('card_saved_at')->nullable();
            $table->string('charge_reference', 120)->nullable();
            $table->timestamp('charged_at')->nullable();
            $table->string('failure_reason', 300)->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->json('meta')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('frequency_payments');

        Schema::table('frequencies', function (Blueprint $table) {
            $table->dropColumn('price_cents');
        });
    }
};
