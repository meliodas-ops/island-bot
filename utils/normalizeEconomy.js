// Keep the original query shape for the dashboard and leaderboard.
module.exports = async function normalizeEconomy(db, transaction) {
    const run = sql => db.query(sql, { transaction });
    await run('CREATE TABLE economy_accounts (id INTEGER PRIMARY KEY, playerId TEXT NOT NULL UNIQUE REFERENCES players(playerId), createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL)');
    await run('INSERT INTO economy_accounts SELECT id,playerId,createdAt,updatedAt FROM economy');
    const columns = ['a.*'];
    const joins = [];
    for (const [alias, currency, names] of [['c','coin',['balance','totalEarned','totalSpent']], ['f','island_fragment',['islandFragments','totalFragmentsEarned','totalFragmentsSpent']]]) {
        joins.push(`LEFT JOIN wallets ${alias} ON ${alias}.playerId=a.playerId AND ${alias}.currencyCode='${currency}'`);
        ['balance','totalEarned','totalSpent'].forEach((field,i) => columns.push(`coalesce(${alias}.${field},0) AS ${names[i]}`));
    }
    for (const action of ['work','beg','rob','gamble','daily']) {
        joins.push(`LEFT JOIN player_action_states ${action} ON ${action}.playerId=a.playerId AND ${action}.actionCode='${action}'`);
        const epoch = field => `round((julianday(${action}.${field})-2440587.5)*86400000)`;
        columns.push(`${epoch('lastUsedAt')} AS last${action[0].toUpperCase()+action.slice(1)}`);
        columns.push(action === 'daily' ? 'coalesce(daily.streak,0) AS dailyStreak' : `${epoch('cooldownUntil')} AS ${action}Cooldown`);
    }
    await run('DROP TABLE economy');
    await run(`CREATE VIEW economy AS SELECT ${columns.join(',')} FROM economy_accounts a ${joins.join(' ')}`);
    await run('CREATE TRIGGER economy_delete INSTEAD OF DELETE ON economy BEGIN DELETE FROM wallets WHERE playerId=OLD.playerId; DELETE FROM player_action_states WHERE playerId=OLD.playerId; DELETE FROM economy_accounts WHERE id=OLD.id; END');
};
