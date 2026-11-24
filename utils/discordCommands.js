const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

function loadCommands(directory, scopes) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) loadCommands(file, scopes);
        else if (entry.name.endsWith('.js')) {
            const command = require(file);
            const definition = command.data.toJSON();
            const scope = command.supportServer ? scopes.guild : scopes.global;
            if (typeof command.execute !== 'function' || scope.some(c => c.name === definition.name)) {
                throw new Error('Invalid or duplicate command: ' + file);
            }
            scope.push(definition);
        }
    }
}

module.exports = async function publish(clear) {
    const root = path.join(__dirname, '..');
    require('dotenv').config({ path: path.join(root, '.env') });
    const { TOKEN, CLIENT_ID, GUILD_ID } = process.env;
    if (!TOKEN || !CLIENT_ID || !GUILD_ID) throw new Error('Set TOKEN, CLIENT_ID, and GUILD_ID.');
    const scopes = { global: [], guild: [] };
    if (!clear) {
        loadCommands(path.join(root, 'commands'), scopes);
        if (!scopes.global.length && !scopes.guild.length) throw new Error('No commands found.');
    }
    const rest = new REST().setToken(TOKEN);
    for (const [scope, route] of [
        ['global', Routes.applicationCommands(CLIENT_ID)],
        ['guild', Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)]
    ]) {
        await rest.put(route, { body: scopes[scope] });
        console.log(scope + ' commands registered: ' + scopes[scope].length);
    }
};
