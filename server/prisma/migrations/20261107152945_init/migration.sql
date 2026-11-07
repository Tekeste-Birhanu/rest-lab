-- CreateTable
CREATE TABLE "workspaces" (
    "id" UUID NOT NULL,
    "cookie_token_hash" TEXT NOT NULL,
    "api_js" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "snippets" (
    "id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "language" VARCHAR(50) NOT NULL,
    "description" VARCHAR(1000),
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "snippets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_cookie_token_hash_key" ON "workspaces"("cookie_token_hash");

-- CreateIndex
CREATE INDEX "workspaces_last_activity_at_idx" ON "workspaces"("last_activity_at");

-- CreateIndex
CREATE INDEX "snippets_workspace_id_title_idx" ON "snippets"("workspace_id", "title");

-- CreateIndex
CREATE INDEX "snippets_workspace_id_language_idx" ON "snippets"("workspace_id", "language");

-- AddForeignKey
ALTER TABLE "snippets" ADD CONSTRAINT "snippets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
