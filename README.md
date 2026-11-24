# Island Bot v2

Island Bot is a Discord economy game with player profiles, coin and Island Fragment wallets, XP, prestige, badges, and promo codes. It also tracks message XP separately for each Discord server. The bot runs on Node.js with discord.js and stores its game state and configuration in SQLite.

The source is public for anyone interested in how the game works. To play Island Bot or get help, join the [official support server](https://discord.gg/wNCGKnCWwh).

**Owner:** `meliodas.` · **Discord ID:** `663231875707568139`

## Start playing

1. Run `/player register` and confirm. Registration grants 1,000 coins. Use `/player profile` to see your character.
2. Use `/economy work`, `beg`, `rob`, or `daily` to earn rewards. Check `/cooldowns` to see when you can act again.
3. Use `/economy exchange` to trade 100 gold coins for one Island Fragment. The exchange spends only whole multiples of 100.
4. Open `/prestige info` to see your requirements. The first prestige requires 200,000 coins, 1,500 fragments, and player level 100. Prestiging resets coins and current level progress, preserves fragments and total XP, and increases the multiplier for eligible gold rewards.

**Player XP and server XP are separate.** Use `/player level` for economy progression and `/leveling rank` for message XP in your current server. A new server starts with message leveling disabled. When enabled, its defaults are 5–15 XP per eligible message and a 60-second interval per member. Bot messages and direct messages do not earn server XP.

## Slash command reference

Global commands are available wherever the bot is installed. Support-server commands are available in the official support server. The slash menu shows the arguments and choices for each subcommand.

| Global command | Subcommands or purpose |
| --- | --- |
| `/player` | `register`, `profile`, `level`, `leaderboard` for player progression |
| `/leveling` | `rank`, `leaderboard`, `stats` for server message XP |
| `/redeem` | `redeem` to claim a code, `list` to view your redemption history |
| `/bot info` | Bot information and statistics |
| `/changelogs` | Browse the project's release notes |
| `/ping`, `/hello` | Check responsiveness or get a greeting |
| `/guide` | In-bot help |
| `/economy` | `balance`, `work`, `beg`, `rob`, `daily`, `exchange` |
| `/cooldowns` | Check action timers for yourself or a selected player |
| `/gamble mines` | Bet coins, reveal tiles, and cash out before hitting a mine |
| `/prestige info` | Review requirements and start the prestige confirmation flow |
| `/settings leveling` | Administrator settings for `toggle`, `xp`, `interval`, `channel`, and `formula` |
| `/settings leveling-view` | Administrators can view the current XP range, cooldown, curve, announcement channel, and enabled status for their server. |

| Support-server command | Subcommands or purpose |
| --- | --- |
| `/badge` | Owner tools to `add`, `remove`, `list`, or inspect `userbadges` |
| `/ban` | Owner-only bot access controls: `add` and `edit` take a user, reason, and duration; `remove` takes a user. Temporary bans expire automatically. |
| `/owner` | `stats` and `restart-bot`; `promocode` operations for create, list, delete, toggle, and info; `coin` operations for add, set, remove, reset, and delete |
| `/example` | Example command that saves a named entry in SQLite |

## Storage and access

| Area | Where to look |
| --- | --- |
| Player identity and progression | `players`, `levels`, `prestige` |
| Economy | `economy_accounts`, `wallets`, `wallet_transactions`, `player_action_states`. The `economy` view combines these for existing queries. Migrated balances enter the ledger as opening balances. |
| Rewards | `PromoCodes`, `promo_rewards`, `promo_redemptions`, `redemption_rewards`, `badges`, `user_badges` |
| Server configuration and ranks | `server_settings`, `server_leveling` |
| Bot configuration | `bot_emojis`, `contributor_roles`, `handler_settings` |
| Changelog | `data/changelogs.json`, the standalone content file used by `/changelogs` |

A promo redemption records the actual reward and applies the grant in one database transaction. Codes can have fixed or random amounts, usage limits, an expiry, and an optional recipient restriction.

Command access also depends on the command flags in `handler_settings` and memberships in `contributor_roles`. Some owner and profile-management checks additionally compare a Discord user ID in code.

## Project layout

- `bot.js` creates the Discord client and loads commands and event handlers.
- `commands/` contains slash-command definitions and their implementations, grouped by feature.
- `events/` handles readiness, interactions, and message-based leveling.
- `models/` defines player, economy, reward, and badge models. `serverModels/` defines server settings and server leveling.
- `utils/` contains the shared database connection, configuration readers, command deployment logic, and game helpers.

## Bot ban appeals

Use `/appeal` or the **Appeal this ban** button on a ban notice. The bot asks six questions privately and saves each answer. Run the command again to resume a draft, answer a staff question, or check the decision. Discord supplies your account ID automatically.

The owner sets the staff destination with `/ban appeal-channel channel:` in the support server. Submitted appeals also appear under `/ban appeal-view list`, including when channel delivery fails. The owner and support-server administrators with access to the configured review channel can approve, deny, or request more information. Approval lifts the bot ban. Decisions are available in the bot if Discord cannot deliver a DM.

Use `/ban list` for active bans. Both lists accept an optional page number.

After a denial, the player can open another appeal after 24 hours if the ban is still active. Drafts and requests for more information can be continued immediately. If staff channel delivery failed, the owner can open a pending appeal in `/ban appeal-view list` and use **Send to review channel** after configuring `/ban appeal-channel`.
