CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"handle" text NOT NULL,
	"preferred_currency" text DEFAULT 'usd' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "binder" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"format_rows" integer NOT NULL,
	"format_cols" integer NOT NULL,
	"opening" text DEFAULT 'side' NOT NULL,
	"loading" text DEFAULT 'side' NOT NULL,
	"sheets" integer NOT NULL,
	"theme" jsonb,
	"goal_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "binder_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"binder_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"layout" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "share_link" (
	"id" uuid PRIMARY KEY NOT NULL,
	"binder_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"visibility" text DEFAULT 'unlisted' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card" (
	"id" uuid PRIMARY KEY NOT NULL,
	"set_id" uuid NOT NULL,
	"number" text NOT NULL,
	"name" text NOT NULL,
	"species" text[],
	"supertype" text NOT NULL,
	"types" text[],
	"rarity" text,
	"illustrator" text,
	"language" text DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_variant" (
	"id" uuid PRIMARY KEY NOT NULL,
	"card_id" uuid NOT NULL,
	"variant" text NOT NULL,
	"render_effect" text,
	"images" jsonb
);
--> statement-breakpoint
CREATE TABLE "external_id" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "game_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "price_point" (
	"id" uuid PRIMARY KEY NOT NULL,
	"variant_id" uuid NOT NULL,
	"source" text NOT NULL,
	"condition" text,
	"grading" text,
	"currency" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "set" (
	"id" uuid PRIMARY KEY NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"era" text,
	"released_at" date,
	"printed_total" integer,
	"ptcgo_code" text,
	"language" text DEFAULT 'en' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "art_asset" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_url" text NOT NULL,
	"width" integer,
	"height" integer,
	"source" text,
	"license" text
);
--> statement-breakpoint
CREATE TABLE "card_instance" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"variant_id" uuid NOT NULL,
	"condition" text,
	"language" text,
	"grading" text,
	"own_price" numeric(10, 2),
	"notes" text,
	"acquired_at" date
);
--> statement-breakpoint
CREATE TABLE "goal" (
	"id" uuid PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"rules" jsonb NOT NULL,
	"variant_ids" uuid[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binder" ADD CONSTRAINT "binder_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binder" ADD CONSTRAINT "binder_goal_id_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "binder_version" ADD CONSTRAINT "binder_version_binder_id_binder_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_binder_id_binder_id_fk" FOREIGN KEY ("binder_id") REFERENCES "public"."binder"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_set_id_set_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."set"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_variant" ADD CONSTRAINT "card_variant_card_id_card_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."card"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_point" ADD CONSTRAINT "price_point_variant_id_card_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "set" ADD CONSTRAINT "set_game_id_game_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."game"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "art_asset" ADD CONSTRAINT "art_asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_instance" ADD CONSTRAINT "card_instance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_instance" ADD CONSTRAINT "card_instance_variant_id_card_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."card_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_slug_idx" ON "share_link" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "card_set_id_number_idx" ON "card" USING btree ("set_id","number");--> statement-breakpoint
CREATE INDEX "card_variant_card_id_variant_idx" ON "card_variant" USING btree ("card_id","variant");--> statement-breakpoint
CREATE UNIQUE INDEX "external_id_provider_external_id_idx" ON "external_id" USING btree ("provider","external_id");--> statement-breakpoint
CREATE INDEX "price_point_variant_source_captured_idx" ON "price_point" USING btree ("variant_id","source","captured_at" desc);