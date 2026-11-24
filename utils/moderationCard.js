const {ContainerBuilder,TextDisplayBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,MessageFlags}=require('discord.js');

function button(id,label,style=ButtonStyle.Secondary) {
    return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
}
function card(text, buttons=[], privateReply=true) {
    const container=new ContainerBuilder().setAccentColor(0x5865f2)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    if(buttons.length) container.addActionRowComponents(new ActionRowBuilder().addComponents(...buttons));
    return {components:[container],flags:MessageFlags.IsComponentsV2 | (privateReply ? MessageFlags.Ephemeral : 0),allowedMentions:{parse:[]}};
}
module.exports={card,button};
