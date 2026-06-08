ALTER TABLE "incidents" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "maintenance_logs" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "sub_rentals" ADD COLUMN "receipt_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "auth_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_id_unique" UNIQUE("auth_id");