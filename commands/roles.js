const { isAdmin, isMod, successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');
const db = require('../utils/db');

module.exports = {
  name: 'roles',
  async handle(message, args, cmd) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('Administrator only.')] });
    }
    const config = db.getConfig();

    if (cmd === 'setstaffrole') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Please mention a role.')] });
      config.staffRole = role.id;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Staff role set to **${role.name}**.`)] });
    }

    if (cmd === 'setroletier') {
      const roles = message.mentions.roles;
      if (!roles.size) return message.reply({ embeds: [errorEmbed('Please mention at least one role.')] });
      config.roleTiers = roles.map(r => r.id);
      db.saveConfig(config);
      const names = roles.map(r => r.name).join(', ');
      return message.reply({ embeds: [successEmbed(`Role tiers set: ${names}`)] });
    }

    if (cmd === 'promote') {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const tiers = config.roleTiers || [];
      if (!tiers.length) return message.reply({ embeds: [errorEmbed('No role tiers configured. Use $setroletier first.')] });

      let currentTierIndex = -1;
      for (let i = 0; i < tiers.length; i++) {
        if (target.roles.cache.has(tiers[i])) currentTierIndex = i;
      }

      const nextIndex = currentTierIndex + 1;
      if (nextIndex >= tiers.length) return message.reply({ embeds: [errorEmbed('User is already at the highest tier.')] });

      const nextRole = message.guild.roles.cache.get(tiers[nextIndex]);
      if (!nextRole) return message.reply({ embeds: [errorEmbed('Role not found.')] });

      if (currentTierIndex >= 0) await target.roles.remove(tiers[currentTierIndex]).catch(() => {});
      await target.roles.add(nextRole);
      return message.reply({ embeds: [successEmbed(`Promoted **${target.user.tag}** to **${nextRole.name}**.`)] });
    }

    if (cmd === 'demote') {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const tiers = config.roleTiers || [];
      if (!tiers.length) return message.reply({ embeds: [errorEmbed('No role tiers configured.')] });

      let currentTierIndex = -1;
      for (let i = 0; i < tiers.length; i++) {
        if (target.roles.cache.has(tiers[i])) currentTierIndex = i;
      }

      if (currentTierIndex <= 0) return message.reply({ embeds: [errorEmbed('User is at the lowest tier or has no tier role.')] });

      const prevRole = message.guild.roles.cache.get(tiers[currentTierIndex - 1]);
      if (!prevRole) return message.reply({ embeds: [errorEmbed('Role not found.')] });

      await target.roles.remove(tiers[currentTierIndex]).catch(() => {});
      await target.roles.add(prevRole);
      return message.reply({ embeds: [successEmbed(`Demoted **${target.user.tag}** to **${prevRole.name}**.`)] });
    }

    if (cmd === 'fill') {
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const tiers = config.roleTiers || [];
      if (!tiers.length) return message.reply({ embeds: [errorEmbed('No role tiers configured.')] });
      for (const roleId of tiers) {
        const role = message.guild.roles.cache.get(roleId);
        if (role) await target.roles.add(role).catch(() => {});
      }
      return message.reply({ embeds: [successEmbed(`Filled all tier roles for **${target.user.tag}**.`)] });
    }
  }
};
