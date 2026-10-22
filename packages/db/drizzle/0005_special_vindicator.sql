CREATE INDEX "card_instance_user_variant_idx" ON "card_instance" USING btree ("user_id","variant_id");--> statement-breakpoint
ALTER TABLE "card_instance" DROP COLUMN "grading";--> statement-breakpoint
ALTER TABLE "card_instance" DROP COLUMN "own_price";