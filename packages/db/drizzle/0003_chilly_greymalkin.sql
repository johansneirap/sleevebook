CREATE TABLE "binder_template" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"format_rows" integer NOT NULL,
	"format_cols" integer NOT NULL,
	"opening" text DEFAULT 'side' NOT NULL,
	"sheets" integer NOT NULL,
	"theme" jsonb NOT NULL,
	"panels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sections" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"uses_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"href" text,
	"data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"bio" text,
	"contact" jsonb,
	"is_public" boolean DEFAULT true NOT NULL,
	"wishlist_public" boolean DEFAULT true NOT NULL,
	"trades_opt_in" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "species_follow" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"species" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"variant_id" uuid NOT NULL,
	"target_price_usd" numeric(10, 2),
	"note" text,
	"alerted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "binder" ADD COLUMN "featured_at" timestamp;--> statement-breakpoint
ALTER TABLE "binder" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "binder_template" ADD CONSTRAINT "binder_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "species_follow" ADD CONSTRAINT "species_follow_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_variant_id_card_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_created_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "species_follow_user_species_idx" ON "species_follow" USING btree ("user_id","species");--> statement-breakpoint
CREATE UNIQUE INDEX "wishlist_item_user_variant_idx" ON "wishlist_item" USING btree ("user_id","variant_id");