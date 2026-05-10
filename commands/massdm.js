const { EmbedBuilder } = require('discord.js');
const { isAdmin, successEmbed, errorEmbed } = require('../utils/helpers');

module.exports = {
  name: 'massdm',
  async handle(message, args, cmd) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('Administrator only.')] });
    }

    if (cmd === 'dmall') {
      const dmMessage = args.join(' ');
      if (!dmMessage) return message.reply({ embeds: [errorEmbed('Please provide a message to send.')] });

      const statusMsg = await message.reply({ embeds: [new EmbedBuilder().setColor(0xFEE75C).setDescription(`⏳ Sending DMs to server members...`)] });

      const members = await message.guild.members.fetch();
      let sent = 0;
      let failed = 0;

      for (const [, member] of members) {
        if (member.user.bot) continue;
        try {
          const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`📬 Message from ${message.guild.name}`)
            .setDescription(dmMessage)
            .setFooter({ text: `Sent by ${message.author.tag}` })
            .setTimestamp();
          await member.send({ embeds: [embed] });
          sent++;
          await new Promise(r => setTimeout(r, 300));
        } catch {
          failed++;
        }
      }

      return statusMsg.edit({ embeds: [successEmbed(`Mass DM complete. Sent: **${sent}** | Failed: **${failed}**`)] });
    }
  }
};
