import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const oauthConnections = pgTable("oauth_connections", {
  id: uuid().primaryKey().defaultRandom(),
  clientId: text("client_id").notNull(),
  resource: text().notNull(),
  scope: text().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

export const oauthCodes = pgTable(
  "oauth_authorization_codes",
  {
    hash: text().primaryKey(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => oauthConnections.id),
    redirectUri: text("redirect_uri").notNull(),
    challenge: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("oauth_codes_connection_idx").on(table.connectionId)],
);

export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    accessHash: text("access_hash").primaryKey(),
    refreshHash: text("refresh_hash").notNull().unique(),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => oauthConnections.id),
    accessExpiresAt: timestamp("access_expires_at", {
      withTimezone: true,
    }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", {
      withTimezone: true,
    }).notNull(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("oauth_tokens_connection_idx").on(table.connectionId)],
);
