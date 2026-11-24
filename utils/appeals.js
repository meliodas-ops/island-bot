const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { db, activeBan, expiryLabel } = require('./bans');
const { card, button } = require('./moderationCard');
const OWNER = '663231875707568139';
const questions = [
    ['Ban reason', 'What were you banned for?', 'If you’re unsure, describe what you think happened.'],
    ['Account of events', 'In your own words, describe what happened leading up to your ban.', 'What were you doing? Who was involved? What was said or done?'],
    ['Reason for appeal', 'Why do you believe your ban should be lifted?', 'Explain any mistake, unfairness, or why you deserve another chance.'],
    ['Rule acknowledgment', 'Do you understand which rules you may have broken, and do you accept responsibility?', 'You may disagree. Be honest about how you understand the rule.'],
    ['Previous appeals', 'Have you appealed this ban before? If so, when and what was the outcome?', 'If this is your first appeal, say so.'],
    ['Future conduct', 'If your ban is lifted, how will you behave differently going forward?', 'What will you do to avoid breaking the rules again?']
];
const open = "status IN ('draft','pending','more_info')";
const get = id => db.prepare('SELECT * FROM appeals WHERE id=?').get(id);
const reply = (i,text,buttons=[]) => i.reply(card(text,buttons));
const action = (a,verb,label,style) => button(`appeal:${verb}:${a.id}:${a.revision}`,label,style);
const channelId = () => db.prepare('SELECT channelId FROM appeal_config WHERE id=1').get()?.channelId || process.env.APPEAL_REVIEW_CHANNEL_ID;
function closeExpiredAppeals() {
    db.prepare(`UPDATE appeals SET status='closed',revision=revision+1 WHERE ${open}
        AND NOT EXISTS (SELECT 1 FROM bot_bans WHERE user_id=appeals.playerId
          AND (expires_at IS NULL OR expires_at>?))`).run(Date.now());
}
function pageOption(s) {
    return s.addIntegerOption(o=>o.setName('page').setDescription('Page number').setMinValue(1));
}
function list(i,appeals) {
    if (appeals) closeExpiredAppeals();
    const page=i.options.getInteger('page') || 1;
    const entries=appeals
        ? db.prepare("SELECT id,playerId,status FROM appeals WHERE status!='draft' ORDER BY id DESC LIMIT 5 OFFSET ?").all((page-1)*5)
        : db.prepare('SELECT * FROM bot_bans WHERE expires_at IS NULL OR expires_at>? ORDER BY user_id LIMIT 5 OFFSET ?').all(Date.now(),(page-1)*5);
    const lines=entries.map(a=>appeals ? `#${a.id} · <@${a.playerId}> · ${a.status}` : `<@${a.user_id}> · ${expiryLabel(a.expires_at)}\n${a.reason}`);
    return reply(i,`## ${appeals?'Ban appeals':'Active bot bans'} · Page ${page}\n${lines.join('\n\n') || 'No entries on this page.'}`,appeals ? entries.map(a=>action({...a,revision:0},'view',`View #${a.id}`)) : []);
}
function reviewCard(a,privateReply) {
    const lines=JSON.parse(a.answers).map((answer,k)=>`**${questions[k][0]}**\n${answer}`);
    const text=[`## Appeal #${a.id} · ${a.status}`,`From ${a.username} (<@${a.playerId}>)\nBan reason: ${a.banReason}`,...lines,
        a.reviewNotes && 'Staff note: '+a.reviewNotes,a.additionalInfo && 'Additional information: '+a.additionalInfo].filter(Boolean).join('\n\n');
    const buttons=a.status==='pending' ? [action(a,'approve','Approve',ButtonStyle.Success),action(a,'deny','Deny',ButtonStyle.Danger),action(a,'request','Request more info')] : [];
    if (privateReply && a.status==='pending') buttons.push(action(a,'repost','Send to review channel'));
    return card(text,buttons,privateReply);
}
async function postReview(i,a) {
    const id = channelId()?.trim();
    if (!/^\d{17,20}$/.test(id || '')) return 'Set a private channel with /ban appeal-channel.';
    try {
        const ch=await i.client.channels.fetch(id, {force:true});
        const everyone=ch?.guild && ch.permissionsFor?.(ch.guild.roles.everyone);
        if (!ch || ch.guildId!==process.env.GUILD_ID || !ch.isSendable() || !everyone || everyone.has(PermissionFlagsBits.ViewChannel))
            return 'Choose a private staff text channel in the support server.';
        if (!ch.permissionsFor(ch.guild.members.me)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]))
            return 'Grant the bot View Channel and Send Messages in the review channel.';
        await ch.send(reviewCard(a,false));
        return null;
    } catch(error) {
        console.warn('Appeal review delivery failed for appeal',a.id,'Discord error',error.code || error.name);
        return 'Could not post the review. Check the channel and bot permissions, then retry.';
    }
}
function progress(i,a) {
    const n=JSON.parse(a.answers).length;
    if(a.status==='draft') return reply(i,`## Question ${n+1} of 6 · ${questions[n][0]}\n${questions[n][1]}\n${questions[n][2]}`,[action(a,'answer','Answer question')]);
    if(a.status==='more_info') return reply(i,'## More information requested\n'+a.reviewNotes,[action(a,'extra','Send information')]);
    return reply(i,`Appeal #${a.id}: **${a.status}**.${a.reviewNotes?'\nStaff note: '+a.reviewNotes:''}`);
}
function start(i) {
    closeExpiredAppeals();
    const uid=i.user.id;
    const ban=activeBan(uid);
    const last=db.prepare('SELECT * FROM appeals WHERE playerId=? ORDER BY id DESC LIMIT 1').get(uid);
    if(!ban) return last ? reply(i,`You have no active ban. Your latest appeal (#${last.id}) is **${last.status}**.${last.reviewNotes?'\n'+last.reviewNotes:''}`) : reply(i,'You have no active bot ban.');
    if(!last || !['draft','more_info','pending'].includes(last.status)) {
        const cooldown=db.prepare('SELECT retryAt FROM appeal_cooldowns WHERE playerId=? AND retryAt>?').get(uid,Date.now());
        if (cooldown) return reply(i,`Your previous appeal was denied.${last?.reviewNotes?'\nStaff note: '+last.reviewNotes:''}\nYou can appeal again <t:${Math.ceil(cooldown.retryAt/1000)}:R>.`);
        db.prepare('INSERT OR IGNORE INTO appeals(playerId,username,banReason) VALUES(?,?,?)').run(uid,i.user.username,ban.reason);
    }
    return progress(i,db.prepare('SELECT * FROM appeals WHERE playerId=? AND '+open).get(uid));
}
function modal(i,a,verb,title,label,hint) {
    const input=new TextInputBuilder().setCustomId('text').setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(350).setLabel(label).setPlaceholder(hint);
    return i.showModal(new ModalBuilder().setCustomId(`appeal:submit-${verb}:${a.id}:${a.revision}`).setTitle(title)
        .addComponents(new ActionRowBuilder().addComponents(input)));
}
function staff(i) {
    return Boolean(process.env.GUILD_ID) && i.guildId===process.env.GUILD_ID && (i.user.id===OWNER || (i.channelId===channelId() && i.memberPermissions?.has(PermissionFlagsBits.Administrator)));
}
async function handle(i) {
    const [,verb,id,revision]=i.customId.split(':');
    if(verb==='start') return start(i);
    closeExpiredAppeals();
    const a=get(Number(id));
    if(!a) return reply(i,'Appeal not found.');
    const applicant=['answer','extra','submit-answer','submit-extra'].includes(verb);
    if(applicant ? (a.playerId!==i.user.id || !activeBan(i.user.id)) : (!staff(i) || activeBan(i.user.id))) return reply(i,'You cannot use this appeal control.');
    if(verb==='view') return i.reply(reviewCard(a,true));
    if(a.revision!==Number(revision)) return reply(i,'This control is out of date. Reopen the appeal to see its current status.');
    if (verb==='repost') {
        if (i.user.id!==OWNER || a.status!=='pending') return reply(i,'Only the owner can resend a pending appeal.');
        await i.deferReply({flags:MessageFlags.Ephemeral});
        const problem=await postReview(i,a);
        const payload=card(problem || 'Appeal sent to the review channel.',[],false);
        return i.editReply(payload);
    }
    const text=i.isModalSubmit()?i.fields.getTextInputValue('text').trim():null;
    if(text==='') return reply(i,'Please enter a response.');
    if(applicant) {
        const extra=verb.endsWith('extra');
        if(a.status!==(extra?'more_info':'draft')) return reply(i,'This step has already been completed.');
        const answers=JSON.parse(a.answers);
        if(text===null) return modal(i,a,verb,extra?'Additional information':`Question ${answers.length+1} of 6`,extra?'Your response':questions[answers.length][0],extra?'Respond to the staff note.':questions[answers.length][2]);
        if(!extra) answers.push(text);
        const status=extra || answers.length===6?'pending':'draft';
        const saved=db.prepare('UPDATE appeals SET answers=?,additionalInfo=?,status=?,revision=revision+1 WHERE id=? AND revision=? AND status=?').run(JSON.stringify(answers),extra?text:a.additionalInfo,status,a.id,a.revision,a.status);
        if (!saved.changes) return reply(i,'This step already changed. Use /appeal to continue.');
        if(status==='draft') return progress(i,get(a.id));
        try {
            await reply(i,`Appeal #${a.id} is in the staff review queue. Use /appeal to check its status.`);
        } finally {
            await postReview(i,get(a.id));
        }
        return;
    }
    if(a.status!=='pending' || !activeBan(a.playerId)) return reply(i,'This appeal no longer has an active ban awaiting review.');
    if(['deny','request'].includes(verb)) return modal(i,a,verb,verb==='deny'?'Deny appeal':'Request more information','Message for the applicant','Explain the decision or what else you need.');
    const status={approve:'approved','submit-deny':'denied','submit-request':'more_info'}[verb];
    if(!status) return reply(i,'Unknown review action.');
    db.exec('BEGIN IMMEDIATE');
    try {
        if (!activeBan(a.playerId)) throw Error('Ban expired before review');
        const result=db.prepare("UPDATE appeals SET status=?,reviewerId=?,reviewNotes=?,reviewedAt=CURRENT_TIMESTAMP,revision=revision+1 WHERE id=? AND revision=? AND status='pending'").run(status,i.user.id,text,a.id,a.revision);
        if(!result.changes) throw Error('Appeal already reviewed');
        if(status==='approved') db.prepare('DELETE FROM bot_bans WHERE user_id=?').run(a.playerId);
        db.exec('COMMIT');
    } catch(error) {db.exec('ROLLBACK');throw error;}
    await reply(i,`Appeal #${a.id} updated: **${status}**.`).catch(() => {});
    try {
        const user=await i.client.users.fetch(a.playerId);
        await user.send(card(`## Appeal #${a.id}: ${status}\n${text || 'Your bot ban has been lifted.'}${status==='denied'?'\nYou may appeal again in 24 hours if your ban is still active.':''}`,status==='more_info'?[button('appeal:start','Respond')]:[],false));
    } catch {await i.followUp(card('The user’s DMs are unavailable. Their decision is visible through /appeal.'));}
}
module.exports={OWNER,start,handle,list,pageOption};
