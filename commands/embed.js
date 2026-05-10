const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { isAdmin, successEmbed, errorEmbed } = require('../utils/helpers');
const db = require('../utils/db');

const builderSessions = {};

module.exports = {
  name: 'embed',
  async handle(message, args, cmd) {
    if (!isAdmin(message.member)) {
      return message.reply({ embeds: [errorEmbed('Administrator only.')] });
    }
    const config = db.getConfig();

    if (cmd === 'embed') {
      const content = args.join(' ');
      if (!content) return message.reply({ embeds: [errorEmbed('Usage: $embed <title> | <description> | [color]')] });
      const parts = content.split('|').map(p => p.trim());
      const embed = new EmbedBuilder()
        .setColor(parts[2] ? parseInt(parts[2].replace('#', ''), 16) : 0x5865F2)
        .setTitle(parts[0] || 'Embed')
        .setDescription(parts[1] || '');
      return message.channel.send({ embeds: [embed] });
    }

    if (cmd === 'panel') {
      const content = args.join(' ');
      if (!content) return message.reply({ embeds: [errorEmbed('Usage: $panel <title> | <description> | [color]')] });
      const parts = content.split('|').map(p => p.trim());
      const embed = new EmbedBuilder()
        .setColor(parts[2] ? parseInt(parts[2].replace('#', ''), 16) : 0x5865F2)
        .setTitle(parts[0] || 'Panel')
        .setDescription(parts[1] || '');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('panel_btn').setLabel('Click Me').setStyle(ButtonStyle.Primary)
      );
      return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === 'builder') {
      builderSessions[message.author.id] = {
        title: '',
        description: '',
        color: '#5865F2',
        footer: '',
        thumbnail: '',
        image: '',
        fields: []
      };

      const previewEmbed = buildPreview(builderSessions[message.author.id]);
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('builder_title').setLabel('Set Title').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('builder_desc').setLabel('Set Description').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('builder_color').setLabel('Set Color').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('builder_footer').setLabel('Set Footer').setStyle(ButtonStyle.Secondary),
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('builder_addfield').setLabel('Add Field').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('builder_send').setLabel('Send Embed').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('builder_cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
      );

      return message.reply({ content: '**Embed Builder** — use the buttons to customize your embed:', embeds: [previewEmbed], components: [row, row2] });
    }

    if (cmd === 'createcmd') {
      const name = args[0];
      if (!name) return message.reply({ embeds: [errorEmbed('Please provide a command name.')] });
      const response = args.slice(1).join(' ');
      if (!response) return message.reply({ embeds: [errorEmbed('Please provide a response.')] });
      config.customCommands = config.customCommands || {};
      config.customCommands[name.toLowerCase()] = response;
      db.saveConfig(config);
      return message.reply({ embeds: [successEmbed(`Custom command **$${name}** created.`)] });
    }
  },

  getBuilderSession(userId) { return builderSessions[userId]; },
  setBuilderSession(userId, data) { builderSessions[userId] = data; },
  deleteBuilderSession(userId) { delete builderSessions[userId]; },
  buildPreview,
};

function buildPreview(session) {
  const embed = new EmbedBuilder();
  embed.setColor(parseInt((session.color || '#5865F2').replace('#', ''), 16));
  if (session.title) embed.setTitle(session.title);
  if (session.description) embed.setDescription(session.description);
  if (session.footer) embed.setFooter({ text: session.footer });
  if (session.thumbnail) embed.setThumbnail(session.thumbnail);
  if (session.image) embed.setImage(session.image);
  if (session.fields?.length) {
    for (const f of session.fields) embed.addFields({ name: f.name, value: f.value, inline: f.inline || false });
  }
  return embed;
}
