// bot.js
require('dotenv').config();
const { Client, Collection, GatewayIntentBits, Partials } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { testConnection, models } = require('./utils/database');
const { serverModels } = require('./utils/serverDatabase');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction
    ]
});

// Command collection
client.commands = new Collection();

// Make models accessible globally
client.models = models;
client.serverModels = serverModels;

// Function to load commands
const loadCommands = (dir) => {
    const files = fs.readdirSync(dir, { withFileTypes: true });

    for (const file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            loadCommands(fullPath);
        } else if (file.name.endsWith('.js')) {
            try {
                const command = require(fullPath);
                if ('data' in command && 'execute' in command) {
                    client.commands.set(command.data.name, command);
                    console.log(`✅ Loaded command: ${command.data.name}`);
                }
            } catch (error) {
                console.error(`❌ Error loading command ${file.name}:`, error.message);
            }
        }
    }
};

// Load commands
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    loadCommands(commandsPath);
}

// Load events
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        try {
            const event = require(filePath);
            const eventName = event.name || file.replace('.js', '');
            if (event.once) {
                client.once(eventName, (...args) => event.execute(...args, client));
            } else {
                client.on(eventName, (...args) => event.execute(...args, client));
            }
            console.log(`✅ Loaded event: ${file}`);
        } catch (error) {
            console.error(`❌ Error loading event ${file}:`, error.message);
        }
    }
}

testConnection()
    .then(() => client.login(process.env.TOKEN))
    .catch(error => {
        console.error('Startup failed:', error.message);
        process.exitCode = 1;
    });
