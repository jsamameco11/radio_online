<?php

namespace App\Domain\Discovery\Actions;

use App\Domain\Audit\AuditTrail;
use App\Models\Category;
use App\Models\User;
use Illuminate\Validation\ValidationException;

/** Deletes a category nobody uses; categories in use can only be deactivated. */
final class DeleteCategory
{
    public function __construct(private readonly AuditTrail $audit) {}

    public function handle(Category $category, User $actor): void
    {
        if ($category->stations()->exists()) {
            throw ValidationException::withMessages(['category' => "Hay emisoras usando «{$category->name}»: desactívala en lugar de eliminarla."]);
        }

        $category->delete();
        $this->audit->record('category.deleted', null, ['id' => $category->id, 'name' => $category->name], $actor);
    }
}
