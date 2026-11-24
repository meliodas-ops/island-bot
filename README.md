# Island Bot v2

Island Bot is a Discord economy game with player profiles, coin and Island Fragment wallets, XP, prestige, badges, and promo codes. It also tracks message XP separately for each Discord server. The bot runs on Node.js with discord.js and stores its game state and configuration in SQLite.

## Start playing

1. Run `/player register` and confirm. Registration grants 1,000 coins. Use `/player profile` to see your character.
2. In the support server, use `/economy work`, `beg`, `rob`, or `daily` to earn rewards. Check `/cooldowns` to see when you can act again.
3. Use `/economy exchange` to trade 100 gold coins for one Island Fragment. The exchange spends only whole multiples of 100.
4. Open `/prestige info` to see your requirements. The first prestige requires 200,000 coins, 1,500 fragments, and player level 100. Prestiging resets coins and current level progress, preserves fragments and total XP, and increases the multiplier for eligible gold rewards.

**Player XP and server XP are separate.** Use `/player level` for economy progression and `/leveling rank` for message XP in your current server. A new server starts with message leveling disabled. When enabled, its defaults are 5–15 XP per eligible message and a 60-second interval per member. Bot messages and direct messages do not earn server XP.

## Run your own instance

Use Node.js 24 with npm, a Discord application with a bot user, and a provisioned copy of **bots.sqlite** in the project root. The code uses Node’s built-in `node:sqlite` for configuration reads and Sequelize with `sqlite3` for game data. Startup opens the existing database. A fresh installation needs a copy with the schema and configuration already populated.

1. In the Discord Developer Portal, enable **Server Members Intent** and **Message Content Intent** for the bot. Install the application in your server with the bot and application command scopes, and give it permission to view and send messages in the channels it uses.
2. Create a local `.env` in the project root with the following values. `GUILD_ID` is the support server where the guild-only commands belong.

   ```dotenv
   TOKEN=your_bot_token
   CLIENT_ID=your_application_id
   GUILD_ID=your_support_server_id
   ```

3. From the project root, install dependencies, register the commands, and start the bot.

   ```sh
   npm ci
   node deploy-cmds.js
   npm start
   ```

### Make changes and restart

| Operation | What happens |
| --- | --- |
| `npm start` | Loads the current command and event handlers, connects to the database, and logs in. Startup does not deploy Discord commands or migrate tables. |
| `node deploy-cmds.js` | Replaces the application's global command list and the support server's command list with the definitions in the current source tree. Run after adding, removing, renaming, or changing the options of a slash command. |
| `node clear-cmds.js` | Clears both command lists on Discord. Run the deployment script to restore them. |

Restart the process to load edited handlers. For a behavior-only change with the same slash-command definition, restarting is enough. The owner restart command exits the process, so automatic relaunch requires a process manager.

## Slash command reference

Global commands are registered for the application. Support-server commands are registered only in the guild selected by `GUILD_ID`. The slash menu shows the arguments and choices for each subcommand.

| Global command | Subcommands or purpose |
| --- | --- |
| `/player` | `register`, `profile`, `level`, `leaderboard` for player progression |
| `/leveling` | `rank`, `leaderboard`, `stats` for server message XP |
| `/redeem` | `redeem` to claim a code, `list` to view your redemption history |
| `/bot info` | Bot information and statistics |
| `/changelogs` | Browse the project's release notes |
| `/ping`, `/hello` | Check responsiveness or get a greeting |

| Support-server command | Subcommands or purpose |
| --- | --- |
| `/guide` | In-bot help |
| `/economy` | `balance`, `work`, `beg`, `rob`, `daily`, `exchange` |
| `/cooldowns` | Check action timers for yourself or a selected player |
| `/gamble mines` | Bet coins, reveal tiles, and cash out before hitting a mine |
| `/prestige info` | Review requirements and start the prestige confirmation flow |
| `/settings leveling` | Administrator settings for `toggle`, `xp`, `interval`, `channel`, and `formula` |
| `/badge` | Owner tools to `add`, `remove`, `list`, or inspect `userbadges` |
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

Command access also depends on the command flags in `handler_settings` and memberships in `contributor_roles`. Some owner and profile-management checks additionally compare a Discord user ID in code. If you operate a separate instance, review those checks in `commands/Owner/`, `commands/Economy/player.js`, and `events/interactionCreate.js`. Restart after editing permission settings so cached values are refreshed.

Keep the token and populated database private. For a consistent backup while the bot is running, use SQLite’s backup operation from the project root:

```sh
sqlite3 bots.sqlite ".backup 'island-backup.sqlite'"
```

## Project layout

- `bot.js` creates the Discord client and loads commands and event handlers.
- `commands/` contains slash-command definitions and their implementations, grouped by feature.
- `events/` handles readiness, interactions, and message-based leveling.
- `models/` defines player, economy, reward, and badge models. `serverModels/` defines server settings and server leveling.
- `utils/` contains the shared database connection, configuration readers, command deployment logic, and game helpers.

If a command is missing, check its scope in the tables above and confirm that you deployed to the intended application and guild. If startup reports a missing database or table, check that the populated file is named `bots.sqlite` and sits beside `bot.js`. If messages earn no XP, check the server's leveling toggle and interval.
