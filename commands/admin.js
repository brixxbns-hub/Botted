const { isAdmin, successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');
const db = require('../utils/db');

module.exports = {
  name: 'admin',
  async handle(message, args, cmd) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('You need Administrator permission or Bot Admin access.')] });
    }

    if (cmd === 'add_admin') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const admins = db.getAdmins();
      if (admins.admins.includes(target.id)) {
        return message.reply({ embeds: [errorEmbed(`${target.tag} is already a bot admin.`)] });
      }
      admins.admins.push(target.id);
      db.saveAdmins(admins);
      return message.reply({ embeds: [successEmbed(`Granted bot admin access to **${target.tag}**.`)] });
    }

    if (cmd === 'remove_admin') {
      const target = message.mentions.users.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      const admins = db.getAdmins();
      const idx = admins.admins.indexOf(target.id);
      if (idx === -1) return message.reply({ embeds: [errorEmbed(`${target.tag} is not a bot admin.`)] });
      admins.admins.splice(idx, 1);
      db.saveAdmins(admins);
      return message.reply({ embeds: [successEmbed(`Revoked bot admin access from **${target.tag}**.`)] });
    }

    if (cmd === 'list_admins') {
      const admins = db.getAdmins();
      if (!admins.admins.length) {
        return message.reply({ embeds: [infoEmbed('Bot Admins', 'No bot admins have been set.')] });
      }
      const list = admins.admins.map((id, i) => `${i + 1}. <@${id}>`).join('\n');
      return message.reply({ embeds: [infoEmbed('🛡️ Bot Admins', list)] });
    }
  }
};
