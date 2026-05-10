const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { isAdmin, isMod, successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');
const db = require('../utils/db');

const activeDeals = {};

module.exports = {
  name: 'middleman',
  async handle(message, args, cmd) {
    const config = db.getConfig();

    if (cmd === 'mmfee') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
      const amount = args[0];
      if (!amount) {
        return message.reply({ embeds: [infoEmbed('MM Fee', `Current fee: **$${config.mmFee || 0}**`)] });
      }
      config.mmFee = parseFloat(amount) || 0;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Middleman fee set to **$${config.mmFee}**.`)] });
    }

    if (cmd === 'mminfo') {
      if (args[0] === 'setimage') {
        if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
        const url = args[1];
        if (!url) return message.reply({ embeds: [errorEmbed('Please provide an image URL.')] });
        config.mmImage = url;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed('MM info image updated.')] });
      }
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🤝 Middleman Service')
        .setDescription('Our middleman service ensures safe transactions between buyers and sellers.')
        .addFields(
          { name: '💰 Fee', value: `$${config.mmFee || 0}`, inline: true },
          { name: '📋 How it works', value: '1. Both parties agree on terms\n2. Buyer sends payment to MM\n3. Seller delivers goods\n4. MM releases payment' }
        )
        .setTimestamp();
      if (config.mmImage) embed.setImage(config.mmImage);
      return message.channel.send({ embeds: [embed] });
    }

    if (cmd === 'blunderbluss') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('⚠️ Blunderbluss Alert')
        .setDescription(`**${target.tag}** has been marked as a scammer/blunderbluss.\nDo not trade with this user.`)
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    if (cmd === 'w') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🤝 Middleman Deal Initiated')
        .setDescription(`A middleman deal has been started with **${target.tag}**.\nBoth parties must confirm to proceed.`)
        .addFields({ name: 'Fee', value: `$${config.mmFee || 0}` })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mm_confirm_${message.author.id}_${target.id}`).setLabel('Confirm').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`mm_close_${message.author.id}_${target.id}`).setLabel('Cancel').setStyle(ButtonStyle.Danger),
      );

      const msg = await message.channel.send({ content: `${message.author} ${target}`, embeds: [embed], components: [row] });
      activeDeals[msg.id] = { buyer: message.author.id, seller: target.id, confirmed: [] };
    }

    if (cmd === 'confirm') {
      const deal = Object.values(activeDeals).find(d => d.buyer === message.author.id || d.seller === message.author.id);
      if (!deal) return message.reply({ embeds: [errorEmbed('No active deal found.')] });
      if (!deal.confirmed.includes(message.author.id)) deal.confirmed.push(message.author.id);
      if (deal.confirmed.length >= 2) {
        return message.reply({ embeds: [successEmbed('Both parties confirmed. Deal is now active!')] });
      }
      return message.reply({ embeds: [successEmbed('You confirmed the deal. Waiting for the other party...')] });
    }

    if (cmd === 'serverinfo') {
      const guild = message.guild;
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`📊 ${guild.name}`)
        .setThumbnail(guild.iconURL())
        .addFields(
          { name: 'Members', value: `${guild.memberCount}`, inline: true },
          { name: 'Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Owner', value: `<@${guild.ownerId}>`, inline: true },
          { name: 'Channels', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Roles', value: `${guild.roles.cache.size}`, inline: true },
          { name: 'Boosts', value: `${guild.premiumSubscriptionCount}`, inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'userinfo') {
      const target = message.mentions.members.first() || message.member;
      const user = target.user;
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(`👤 ${user.tag}`)
        .setThumbnail(user.displayAvatarURL())
        .addFields(
          { name: 'ID', value: user.id, inline: true },
          { name: 'Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
          { name: 'Account Created', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Roles', value: target.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.toString()).join(', ') || 'None' },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'roleinfo') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Please mention a role.')] });
      const embed = new EmbedBuilder()
        .setColor(role.color || 0x5865F2)
        .setTitle(`🏷️ ${role.name}`)
        .addFields(
          { name: 'ID', value: role.id, inline: true },
          { name: 'Color', value: role.hexColor, inline: true },
          { name: 'Members', value: `${role.members.size}`, inline: true },
          { name: 'Position', value: `${role.position}`, inline: true },
          { name: 'Mentionable', value: role.mentionable ? 'Yes' : 'No', inline: true },
          { name: 'Hoisted', value: role.hoist ? 'Yes' : 'No', inline: true },
        )
        .setTimestamp();
      return message.reply({ embeds: [embed] });
    }

    if (cmd === 'vouches') {
      const target = message.mentions.users.first() || message.author;
      const vouches = db.getVouches();
      const count = vouches[target.id] || 0;
      return message.reply({ embeds: [infoEmbed(`⭐ Vouches for ${target.tag}`, `**${count}** vouch(es)`)] });
    }

    if (cmd === 'vouchlb') {
      const vouches = db.getVouches();
      const sorted = Object.entries(vouches).sort((a, b) => b[1] - a[1]).slice(0, 10);
      if (!sorted.length) return message.reply({ embeds: [infoEmbed('⭐ Vouch Leaderboard', 'No vouches yet.')] });
      const list = sorted.map(([id, count], i) => `**${i + 1}.** <@${id}> — ${count} vouch(es)`).join('\n');
      return message.reply({ embeds: [infoEmbed('⭐ Vouch Leaderboard', list)] });
    }

    if (cmd === 'setvouches') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const n = parseInt(args[1]);
      if (isNaN(n)) return message.reply({ embeds: [errorEmbed('Please provide a number.')] });
      const vouches = db.getVouches();
      vouches[target.id] = n;
      db.saveVouches(vouches);
      return message.reply({ embeds: [successEmbed(`Set vouches for **${target.tag}** to **${n}**.`)] });
    }
  }
};
