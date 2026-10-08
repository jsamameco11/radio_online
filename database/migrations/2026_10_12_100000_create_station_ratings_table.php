<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * One star rating per listener and station, plus the public average kept on
 * the station so listings do not count votes on every page.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('station_ratings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('station_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('stars');
            $table->timestamps();

            $table->unique(['station_id', 'user_id']);
        });

        Schema::table('stations', function (Blueprint $table) {
            $table->unsignedInteger('rating_count')->default(0);
            $table->decimal('rating_average', 3, 2)->default(0);
        });
    }

    public function down(): void
    {
        Schema::table('stations', function (Blueprint $table) {
            $table->dropColumn(['rating_count', 'rating_average']);
        });

        Schema::dropIfExists('station_ratings');
    }
};
