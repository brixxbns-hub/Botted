const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, ChannelType } = require('discord.js');
const { isAdmin, isMod, successEmbed, errorEmbed, infoEmbed } = require('../utils/helpers');
const db = require('../utils/db');

async function createTicketChannel(guild, user) {
  const config = db.getConfig();
  const tickets = db.getTickets();
  config.ticketCounter = (config.ticketCounter || 0) + 1;
  db.saveConfig(config);

  const channelName = `ticket-${String(config.ticketCounter).padStart(4, '0')}`;
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (config.supportRole) {
    overwrites.push({ id: config.supportRole, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  }

  const options = { name: channelName, type: ChannelType.GuildText, permissionOverwrites: overwrites };
  if (config.ticketCategory) options.parent = config.ticketCategory;

  const channel = await guild.channels.create(options);

  tickets[channel.id] = {
    opener: user.id,
    claimed: null,
    created: Date.now(),
    counter: config.ticketCounter,
  };
  db.saveTickets(tickets);

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('🎫 Ticket Opened')
    .setDescription(`Hello ${user}, a staff member will assist you shortly.\nUse the button below to close this ticket.`)
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
    new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setStyle(ButtonStyle.Success).setEmoji('✋'),
  );

  await channel.send({ content: `${user}`, embeds: [embed], components: [row] });
  return channel;
}

module.exports = {
  name: 'tickets',
  async handle(message, args, cmd) {
    const config = db.getConfig();
    const tickets = db.getTickets();

    if (cmd === 'ticketpanel') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🎫 Support Tickets')
        .setDescription('Click the button below to open a support ticket. Our team will assist you shortly.');
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket_open').setLabel('Open Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'),
      );
      return message.channel.send({ embeds: [embed], components: [row] });
    }

    if (cmd === 'setticket') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
      const field = args[0];
      const val = args.slice(1).join(' ');
      if (field === 'category') {
        const cat = message.guild.channels.cache.find(c => c.name.toLowerCase().includes(val.toLowerCase()) && c.type === ChannelType.GuildCategory);
        if (!cat) return message.reply({ embeds: [errorEmbed('Category not found.')] });
        config.ticketCategory = cat.id;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Ticket category set to **${cat.name}**.`)] });
      }
      if (field === 'log') {
        const ch = message.mentions.channels.first();
        if (!ch) return message.reply({ embeds: [errorEmbed('Please mention a channel.')] });
        config.ticketLogChannel = ch.id;
        db.saveConfig(config);
        return message.reply({ embeds: [successEmbed(`Ticket log channel set to ${ch}.`)] });
      }
      return message.reply({ embeds: [errorEmbed('Unknown field. Use: category, log')] });
    }

    if (cmd === 'close') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      if (!isMod(message.member) && message.author.id !== ticket.opener) {
        return message.reply({ embeds: [errorEmbed('You cannot close this ticket.')] });
      }
      await message.reply({ embeds: [successEmbed('Closing ticket in 5 seconds...')] });
      setTimeout(() => message.channel.delete().catch(() => {}), 5000);
      delete tickets[message.channel.id];
      db.saveTickets(tickets);
      return;
    }

    if (cmd === 'claim') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      if (!isMod(message.member)) return message.reply({ embeds: [errorEmbed('Staff only.')] });
      ticket.claimed = message.author.id;
      db.saveTickets(tickets);
      return message.reply({ embeds: [successEmbed(`Ticket claimed by **${message.author.tag}**.`)] });
    }

    if (cmd === 'rename') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      if (!isMod(message.member)) return message.reply({ embeds: [errorEmbed('Staff only.')] });
      const name = args[0];
      if (!name) return message.reply({ embeds: [errorEmbed('Please provide a name.')] });
      await message.channel.setName(name);
      return message.reply({ embeds: [successEmbed(`Renamed channel to **${name}**.`)] });
    }

    if (cmd === 'transfer') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      if (!isMod(message.member)) return message.reply({ embeds: [errorEmbed('Staff only.')] });
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      ticket.claimed = target.id;
      db.saveTickets(tickets);
      return message.reply({ embeds: [successEmbed(`Ticket transferred to **${target.user.tag}**.`)] });
    }

    if (cmd === 'add') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      if (!isMod(message.member)) return message.reply({ embeds: [errorEmbed('Staff only.')] });
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      await message.channel.permissionOverwrites.edit(target, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      return message.reply({ embeds: [successEmbed(`Added **${target.user.tag}** to the ticket.`)] });
    }

    if (cmd === 'remove') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      if (!isMod(message.member)) return message.reply({ embeds: [errorEmbed('Staff only.')] });
      const target = message.mentions.members.first();
      if (!target) return message.reply({ embeds: [errorEmbed('Please mention a user.')] });
      await message.channel.permissionOverwrites.delete(target);
      return message.reply({ embeds: [successEmbed(`Removed **${target.user.tag}** from the ticket.`)] });
    }

    if (cmd === 'transcript') {
      const ticket = tickets[message.channel.id];
      if (!ticket) return message.reply({ embeds: [errorEmbed('This is not a ticket channel.')] });
      const messages = await message.channel.messages.fetch({ limit: 100 });
      const sorted = [...messages.values()].reverse();
      const lines = sorted.map(m => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content || '[embed/attachment]'}`);
      const text = lines.join('\n');
      const buf = Buffer.from(text, 'utf8');
      return message.reply({
        embeds: [successEmbed('Transcript generated.')],
        files: [{ attachment: buf, name: `transcript-${message.channel.name}.txt` }]
      });
    }

    if (cmd === 'closetickets') {
      if (!isAdmin(message.member)) return message.reply({ embeds: [errorEmbed('Administrator only.')] });
      const ticketIds = Object.keys(tickets);
      await message.reply({ embeds: [infoEmbed('Close All Tickets', `Closing ${ticketIds.length} ticket(s)...`)] });
      for (const id of ticketIds) {
        const ch = message.guild.channels.cache.get(id);
        if (ch) await ch.delete().catch(() => {});
        delete tickets[id];
      }
      db.saveTickets(tickets);
    }
  },

  async handleButton(interaction) {
    const config = db.getConfig();

    if (interaction.customId === 'ticket_open') {
      const tickets = db.getTickets();
      const existing = Object.values(tickets).find(t => t.opener === interaction.user.id);
      if (existing) {
        return interaction.reply({ embeds: [errorEmbed('You already have an open ticket.')], ephemeral: true });
      }
      const channel = await createTicketChannel(interaction.guild, interaction.user);
      return interaction.reply({ embeds: [successEmbed(`Your ticket has been created: ${channel}`)], ephemeral: true });
    }

    if (interaction.customId === 'ticket_close') {
      const tickets = db.getTickets();
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('This is not a ticket.')], ephemeral: true });
      await interaction.reply({ embeds: [successEmbed('Closing ticket in 5 seconds...')] });
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      delete tickets[interaction.channel.id];
      db.saveTickets(tickets);
    }

    if (interaction.customId === 'ticket_claim') {
      if (!isMod(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Staff only.')], ephemeral: true });
      }
      const tickets = db.getTickets();
      const ticket = tickets[interaction.channel.id];
      if (!ticket) return interaction.reply({ embeds: [errorEmbed('This is not a ticket.')], ephemeral: true });
      ticket.claimed = interaction.user.id;
      db.saveTickets(tickets);
      return interaction.reply({ embeds: [successEmbed(`Ticket claimed by **${interaction.user.tag}**.`)] });
    }
  }
};
