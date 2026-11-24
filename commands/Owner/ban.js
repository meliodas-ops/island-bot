const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const bans = require('../../utils/bans');

const { OWNER, list, pageOption } = require('../../utils/appeals');
const { card } = require('../../utils/moderationCard');
const durations = new Map([
    ['1 hour', 1], ['6 hours', 6], ['1 day', 24], ['7 days', 168],
    ['30 days', 720], ['Permanent', 0]
]);

function target(sub) {
    return sub.addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true));
}
function details(sub) {
    return target(sub)
        .addStringOption(o => o.setName('reason').setDescription('Reason shown to the user').setRequired(true).setMaxLength(400))
        .addStringOption(o => o.setName('time').setDescription('Duration starting now').setRequired(true)
            .addChoices(...Array.from(durations.keys(), name => ({ name, value: name }))));
}

module.exports = {
    supportServer: true,
    data: new SlashCommandBuilder().setName('ban').setDescription('Manage access to Island Bot')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => pageOption(s.setName('list').setDescription('List active bot bans')))
        .addSubcommandGroup(g => g.setName('appeal-view').setDescription('Review ban appeals')
            .addSubcommand(s => pageOption(s.setName('list').setDescription('Browse submitted appeals'))))
        .addSubcommand(s => s.setName('appeal-channel').setDescription('Choose a private channel for staff review')
            .addChannelOption(o => o.setName('channel').setDescription('Private staff text channel').addChannelTypes(ChannelType.GuildText).setRequired(true)))
        .addSubcommand(s => details(s.setName('add').setDescription('Ban a user from using the bot')))
        .addSubcommand(s => target(s.setName('remove').setDescription('Remove a bot ban')))
        .addSubcommand(s => details(s.setName('edit').setDescription('Replace an active ban’s reason and duration'))),
    async execute(interaction) {
        const reply = content => interaction.reply(card(content));
        if (interaction.user.id !== OWNER) return reply('Only the bot owner can manage bans.');
        const action = interaction.options.getSubcommand();
        if (action === 'list') return list(interaction, interaction.options.getSubcommandGroup(false) === 'appeal-view');
        if (action === 'appeal-channel') {
            const ch = interaction.options.getChannel('channel', true);
            const visibility = ch.permissionsFor(interaction.guild.roles.everyone);
            if (ch.guildId !== process.env.GUILD_ID || !visibility || visibility.has(PermissionFlagsBits.ViewChannel))
                return reply('Select a private staff channel in the support server.');
            if (!ch.permissionsFor(interaction.guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
                return reply('I need permission to view and send messages in that channel.');
            bans.db.prepare('INSERT INTO appeal_config(id,channelId) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET channelId=excluded.channelId').run(ch.id);
            return reply(`Appeals will be sent to ${ch}.`);
        }
        const id = interaction.options.getUser('user', true).id;
        if (id === OWNER) return reply('The bot owner cannot be banned.');
        if (action === 'remove') return reply(bans.removeBan(id) ? `Removed the ban record for <@${id}>.` : 'No ban record for that user.');
        const reason = interaction.options.getString('reason', true).trim();
        const hours = durations.get(interaction.options.getString('time', true));
        if (!reason || hours === undefined) return reply('Choose a duration and enter a reason.');
        const expires = hours ? Date.now() + hours * 3600000 : null;
        const changed = action === 'add' ? bans.addBan(id, reason, expires) : bans.editBan(id, reason, expires);
        if (!changed) return reply(action === 'add' ? 'Already banned. Use /ban edit.' : 'No active ban. Use /ban add.');
        return reply(`Ban ${action === 'add' ? 'added' : 'updated'} for <@${id}>.\nReason: ${reason}\nExpires: ${bans.expiryLabel(expires)}`);
    }
};
