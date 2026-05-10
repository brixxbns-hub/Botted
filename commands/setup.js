const { isAdmin, successEmbed, errorEmbed } = require('../utils/helpers');
const db = require('../utils/db');

module.exports = {
  name: 'setup',
  async handle(message, args, cmd) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('Administrator only.')] });
    }
    const config = db.getConfig();

    if (cmd === 'setmodlog') {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply({ embeds: [errorEmbed('Please mention a channel.')] });
      config.modlog = ch.id;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Mod log channel set to ${ch}.`)] });
    }

    if (cmd === 'setsupportrole') {
      const role = message.mentions.roles.first();
      if (!role) return message.reply({ embeds: [errorEmbed('Please mention a role.')] });
      config.supportRole = role.id;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Support role set to **${role.name}**.`)] });
    }

    if (cmd === 'antispam') {
      const val = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(val)) return message.reply({ embeds: [errorEmbed('Use on or off.')] });
      config.antispam = val === 'on';
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Anti-spam ${val === 'on' ? 'enabled' : 'disabled'}.`)] });
    }

    if (cmd === 'antilink') {
      const val = args[0]?.toLowerCase();
      if (!['on', 'off'].includes(val)) return message.reply({ embeds: [errorEmbed('Use on or off.')] });
      config.antilink = val === 'on';
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Anti-link ${val === 'on' ? 'enabled' : 'disabled'}.`)] });
    }
  }
};
