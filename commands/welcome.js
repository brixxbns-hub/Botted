const { EmbedBuilder } = require('discord.js');
const { isAdmin, successEmbed, errorEmbed } = require('../utils/helpers');
const db = require('../utils/db');

module.exports = {
  name: 'welcome',
  async handle(message, args, cmd) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('Administrator only.')] });
    }
    const config = db.getConfig();

    if (cmd === 'setwelcome') {
      const field = args[0]?.toLowerCase();
      const value = args.slice(1).join(' ');

      if (field === 'channel') {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply({ embeds: [errorEmbed('Please mention a channel.')] });
        config.welcomeChannel = ch.id;
        config.welcomeEnabled = true;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Welcome channel set to ${ch}.`)] });
      }

      if (field === 'message') {
        if (!value) return message.reply({ embeds: [errorEmbed('Please provide a message. Use {user} for mention, {server} for server name, {count} for member count.')] });
        config.welcomeMessage = value;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Welcome message set to: ${value}`)] });
      }

      if (field === 'color') {
        config.welcomeColor = value;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Welcome embed color set to **${value}**.`)] });
      }

      if (field === 'title') {
        config.welcomeTitle = value;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Welcome title set to **${value}**.`)] });
      }

      if (field === 'enabled') {
        config.welcomeEnabled = value === 'true' || value === 'on';
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Welcome messages ${config.welcomeEnabled ? 'enabled' : 'disabled'}.`)] });
      }

      return message.reply({ embeds: [errorEmbed('Fields: channel, message, color, title, enabled')] });
    }

    if (cmd === 'welcometest') {
      return sendWelcome(message.guild, message.member);
    }
  },

  async sendWelcome(guild, member) {
    return sendWelcome(guild, member);
  }
};

async function sendWelcome(guild, member) {
  const config = db.getConfig();
  if (!config.welcomeChannel) return;
  const channel = guild.channels.cache.get(config.welcomeChannel);
  if (!channel) return;

  const msg = (config.welcomeMessage || 'Welcome {user} to {server}!')
    .replace('{user}', member.toString())
    .replace('{server}', guild.name)
    .replace('{count}', guild.memberCount);

  const color = config.welcomeColor ? parseInt(config.welcomeColor.replace('#', ''), 16) : 0x5865F2;
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(config.welcomeTitle || `Welcome to ${guild.name}!`)
    .setDescription(msg)
    .setThumbnail(member.user.displayAvatarURL())
    .setFooter({ text: `Member #${guild.memberCount}` })
    .setTimestamp();

  await channel.send({ embeds: [embed] });
}
