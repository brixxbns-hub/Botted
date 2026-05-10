const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { isMod, isAdmin, successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');
const db = require('../utils/db');

async function logAction(guild, action, target, mod, reason) {
  const config = db.getConfig();
  if (!config.modlog) return;
  const channel = guild.channels.cache.get(config.modlog);
  if (!channel) return;
  const embed = new EmbedBuilder()
    .setColor(0xFEE75C)
    .setTitle(`🔨 ${action}`)
    .addFields(
      { name: 'User', value: `${target.tag} (${target.id})`, inline: true },
      { name: 'Moderator', value: `${mod.user.tag}`, inline: true },
      { name: 'Reason', value: reason || 'No reason provided' }
    )
    .setTimestamp();
  channel.send({ embeds: [embed] });
}

module.exports = {
  name: 'moderation',
  async handle(message, args, cmd) {
    if (!isMod(message.member)) {
      return message.reply({ embeds: [errorEmbed('You do not have permission to use moderation commands.')] });
    }

    if (cmd === 'ban') {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const reason = args.slice(1).join(' ') || 'No reason provided';
      if (!target.bannable) return message.reply({ embeds: [errorEmbed('I cannot ban this user.')] });
      await target.ban({ reason });
      await logAction(message.guild, 'Ban', target.user, message.member, reason);
      return message.reply({ embeds: [successEmbed(`**${target.user.tag}** has been banned. Reason: ${reason}`)] });
    }

    if (cmd === 'kick') {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const reason = args.slice(1).join(' ') || 'No reason provided';
      if (!target.kickable) return message.reply({ embeds: [errorEmbed('I cannot kick this user.')] });
      await target.kick(reason);
      await logAction(message.guild, 'Kick', target.user, message.member, reason);
      return message.reply({ embeds: [successEmbed(`**${target.user.tag}** has been kicked. Reason: ${reason}`)] });
    }

    if (cmd === 'mute') {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const mins = parseInt(args[1]) || 10;
      const reason = args.slice(2).join(' ') || 'No reason provided';
      const ms = mins * 60 * 1000;
      await target.timeout(ms, reason);
      await logAction(message.guild, `Mute (${mins}m)`, target.user, message.member, reason);
      return message.reply({ embeds: [successEmbed(`**${target.user.tag}** has been muted for ${mins} minutes. Reason: ${reason}`)] });
    }

    if (cmd === 'warn') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const warnings = db.getWarnings();
      if (!warnings[target.id]) warnings[target.id] = [];
      warnings[target.id].push({ reason, mod: message.author.id, date: Date.now() });
      db.saveWarnings(warnings);
      await logAction(message.guild, 'Warn', target, message.member, reason);
      return message.reply({ embeds: [successEmbed(`**${target.tag}** has been warned. Reason: ${reason} (Total: ${warnings[target.id].length})`)] });
    }

    if (cmd === 'warnings') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const warnings = db.getWarnings();
      const userWarns = warnings[target.id] || [];
      if (!userWarns.length) return message.reply({ embeds: [infoEmbed(`Warnings for ${target.tag}`, 'No warnings found.')] });
      const list = userWarns.map((w, i) => `**${i + 1}.** ${w.reason} — <@${w.mod}> • <t:${Math.floor(w.date / 1000)}:R>`).join('\n');
      return message.reply({ embeds: [infoEmbed(`⚠️ Warnings for ${target.tag}`, list)] });
    }

    if (cmd === 'lock') {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
      return message.reply({ embeds: [successEmbed('Channel locked.')] });
    }

    if (cmd === 'unlock') {
      await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
      return message.reply({ embeds: [successEmbed('Channel unlocked.')] });
    }

    if (cmd === 'purge') {
      const amount = parseInt(args[0]);
      if (!amount || amount < 1 || amount > 100) {
        return message.reply({ embeds: [errorEmbed('Please provide a number between 1 and 100.')] });
      }
      await message.channel.bulkDelete(amount + 1, true);
      const reply = await message.channel.send({ embeds: [successEmbed(`Deleted ${amount} messages.`)] });
      setTimeout(() => reply.delete().catch(() => {}), 3000);
    }
  }
};
