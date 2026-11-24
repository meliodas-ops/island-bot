const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const db = new DatabaseSync(path.join(__dirname, '..', 'bots.sqlite'), { readOnly: true });

function badges() {
    const rows = db.prepare('SELECT id AS badgeKey, coalesce(displayId,id) AS id,name,icon,description,color,image FROM badges').all();
    return Object.fromEntries(rows.map(({badgeKey,...badge}) => [badgeKey,badge]));
}

function contributors(role) {
    return db.prepare('SELECT userId FROM contributor_roles WHERE role=?').all(role).map(row => row.userId);
}

function settings(kind) {
    const rows = db.prepare('SELECT name,ownerOnly,adminOnly,testerOnly,disabled FROM handler_settings WHERE kind=?').all(kind);
    return Object.fromEntries(rows.map(({name, ownerOnly, adminOnly, testerOnly, disabled}) => [
        name, { ownerOnly: Boolean(ownerOnly), adminOnly: Boolean(adminOnly), testerOnly: Boolean(testerOnly), disabled: Boolean(disabled) }
    ]));
}

const emojis = Object.fromEntries(db.prepare('SELECT name,value FROM bot_emojis').all().map(row => [row.name,row.value]));
module.exports = { badges, contributors, settings, emojis };
