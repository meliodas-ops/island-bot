const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const { button } = require('./moderationCard');
const { EmbedBuilder, ActionRowBuilder, MessageFlags, ButtonStyle } = require('discord.js');
const { existsSync } = require('node:fs');

const databasePath = path.join(__dirname, '..', 'bots.sqlite');
if (!existsSync(databasePath)) throw new Error('Missing bots.sqlite');
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA busy_timeout = 3000');
const active = '(expires_at IS NULL OR expires_at > ?)';
const lookup = db.prepare('SELECT reason, expires_at FROM bot_bans WHERE user_id = ? AND ' + active);
const insert = db.prepare(`INSERT INTO bot_bans(user_id, reason, expires_at) VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET reason=excluded.reason, expires_at=excluded.expires_at
    WHERE bot_bans.expires_at <= ?`);
const update = db.prepare('UPDATE bot_bans SET reason=?, expires_at=? WHERE user_id=? AND ' + active);
const remove = db.prepare('DELETE FROM bot_bans WHERE user_id=?');
const interactionBans = new WeakMap();

function activeBan(userId) {
    return lookup.get(userId, Date.now());
}

// Dispatch and collectors share the decision for this interaction. Only dispatch replies.
function interactionBan(interaction) {
    if (!interactionBans.has(interaction)) interactionBans.set(interaction, activeBan(interaction.user.id));
    return interactionBans.get(interaction);
}

function expiryLabel(timestamp) {
    return timestamp == null ? 'Permanent' : `<t:${Math.floor(timestamp / 1000)}:F> (<t:${Math.floor(timestamp / 1000)}:R>)`;
}

async function replyIfBanned(interaction) {
    const ban = interactionBan(interaction);
    if (!ban) return false;
    if (interaction.isAutocomplete()) await interaction.respond([]);
    else if (interaction.isRepliable()) await interaction.reply({
        embeds: [new EmbedBuilder().setColor(0xC1121F).setTitle('⛔ ACCESS REVOKED')
            .setDescription('Your account is barred from using Island Bot across all servers.')
            .addFields({name:'Ban reason', value:ban.reason}, {name:'Restriction ends', value:expiryLabel(ban.expires_at)})
            .setFooter({text:'You may appeal this restriction for staff review.'})],
        components: [new ActionRowBuilder().addComponents(button('appeal:start','Appeal this ban',ButtonStyle.Secondary))],
        flags: MessageFlags.Ephemeral,
        allowedMentions: {parse:[]}
    });
    return true;
}

module.exports = {
    db, activeBan, interactionBan, replyIfBanned, expiryLabel,
    addBan: (id, reason, expiry) => insert.run(id, reason, expiry, Date.now()).changes,
    editBan: (id, reason, expiry) => update.run(reason, expiry, id, Date.now()).changes,
    removeBan: id => remove.run(id).changes
};
