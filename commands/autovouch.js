const { EmbedBuilder } = require('discord.js');
const { isAdmin, successEmbed, errorEmbed } = require('../utils/helpers');
const db = require('../utils/db');

let autovouchTimer = null;

async function runAutoVouch(client) {
  const config = db.getConfig();
  if (!config.autovouchRunning || !config.autovouchChannel || !config.autovouchUsers?.length) return;

  const channel = client.channels.cache.get(config.autovouchChannel);
  if (!channel) return;

  const target = config.autovouchTarget ? `<@${config.autovouchTarget}>` : null;
  const users = config.autovouchUsers;
  const user = users[Math.floor(Math.random() * users.length)];

  const embed = new EmbedBuilder()
    .setColor(0xFFD700)
    .setTitle('⭐ Auto Vouch')
    .setDescription(`<@${user}> vouches for ${target || 'the server'}!\n\n⭐ Great service and trustworthy!`)
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => {});

  if (config.autovouchTarget) {
    const vouches = db.getVouches();
    if (!vouches[config.autovouchTarget]) vouches[config.autovouchTarget] = 0;
    vouches[config.autovouchTarget]++;
    db.saveVouches(vouches);
  }
}

module.exports = {
  name: 'autovouch',
  startTimer(client) {
    const config = db.getConfig();
    if (autovouchTimer) clearInterval(autovouchTimer);
    if (config.autovouchRunning) {
      autovouchTimer = setInterval(() => runAutoVouch(client), (config.autovouchInterval || 60) * 1000);
    }
  },

  async handle(message, args, cmd, client) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('Administrator only.')] });
    }
    const config = db.getConfig();

    if (cmd === 'autovouch') {
      config.autovouchRunning = true;
      db.saveConfig(config);
      if (autovouchTimer) clearInterval(autovouchTimer);
      autovouchTimer = setInterval(() => runAutoVouch(client), (config.autovouchInterval || 60) * 1000);
      return message.reply({ embeds: [successEmbed('Auto vouch started.')] });
    }

    if (cmd === 'autovouchstop') {
      config.autovouchRunning = false;
      db.saveConfig(config);
      if (autovouchTimer) { clearInterval(autovouchTimer); autovouchTimer = null; }
      return message.reply({ embeds: [successEmbed('Auto vouch stopped.')] });
    }

    if (cmd === 'autovouchchannel') {
      const ch = message.mentions.channels.first();
      if (!ch) return message.reply({ embeds: [errorEmbed('Please mention a channel.')] });
      config.autovouchChannel = ch.id;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Auto vouch channel set to ${ch}.`)] });
    }

    if (cmd === 'autovouchtarget') {
      const user = message.mentions.users.first();
      if (!user) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      config.autovouchTarget = user.id;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Auto vouch target set to **${user.tag}**.`)] });
    }

    if (cmd === 'autovouchinterval') {
      const secs = parseInt(args[0]);
      if (!secs || secs < 5) return message.reply({ embeds: [errorEmbed('Please provide a number of seconds (min 5).')] });
      config.autovouchInterval = secs;
      db.saveConfig(config);
      if (autovouchTimer && config.autovouchRunning) {
        clearInterval(autovouchTimer);
        autovouchTimer = setInterval(() => runAutoVouch(client), secs * 1000);
      }
      return message.reply({ embeds: [successEmbed(`Auto vouch interval set to **${secs}** seconds.`)] });
    }

    if (cmd === 'autovouchusers') {
      const users = message.mentions.users;
      if (!users.size) return message.reply({ embeds: [errorEmbed('Please mention at least one user.')] });
      config.autovouchUsers = [...new Set([...(config.autovouchUsers || []), ...users.map(u => u.id)])];
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Added ${users.size} user(s) to the auto vouch pool.`)] });
    }

    if (cmd === 'autovouchremove') {
      const users = message.mentions.users;
      if (!users.size) return message.reply({ embeds: [errorEmbed('Please mention at least one user.')] });
      config.autovouchUsers = (config.autovouchUsers || []).filter(id => !users.has(id));
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Removed ${users.size} user(s) from the auto vouch pool.`)] });
    }
  }
};
