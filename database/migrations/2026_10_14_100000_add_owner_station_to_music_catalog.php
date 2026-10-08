<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The music catalog stays shared by every station, but each genre or artist
 * a station adds (by hand or learned from its uploads) remembers that station:
 * only it may change or delete the entry. The starting catalog has no owner.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach (['genres', 'artists'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->foreignId('station_id')->nullable()->after('id')->constrained()->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (['genres', 'artists'] as $table) {
            Schema::table($table, function (Blueprint $table) {
                $table->dropConstrainedForeignId('station_id');
            });
        }
    }
};
