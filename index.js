const { Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const db = require('./utils/db');
const { isMod, isAdmin, successEmbed, errorEmbed, infoEmbed } = require('./utils/helpers');

const adminCmd = require('./commands/admin');
const moderationCmd = require('./commands/moderation');
const ticketsCmd = require('./commands/tickets');
const setupCmd = require('./commands/setup');
const welcomeCmd = require('./commands/welcome');
const rolesCmd = require('./commands/roles');
const massdmCmd = require('./commands/massdm');
const autovouchCmd = require('./commands/autovouch');
const middlemanCmd = require('./commands/middleman');
const embedCmd = require('./commands/embed');
const funCmd = require('./commands/fun');

const PREFIX = '$';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setPresence({ activities: [{ name: '$help | TradingValley' }], status: 'online' });
  autovouchCmd.startTimer(client);
});

client.on('guildMemberAdd', async (member) => {
  await welcomeCmd.sendWelcome(member.guild, member);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const config = db.getConfig();

  if (config.antilink && !isAdmin(message.member)) {
    const linkRegex = /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i;
    if (linkRegex.test(message.content)) {
      await message.delete().catch(() => {});
      return message.channel.send({ embeds: [errorEmbed(`${message.author}, links are not allowed in this server.`)] })
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
  }

  if (config.antispam && !isAdmin(message.member)) {
    if (!client._spamMap) client._spamMap = new Map();
    const key = `${message.author.id}_${message.channel.id}`;
    const now = Date.now();
    const entry = client._spamMap.get(key) || { count: 0, last: now };
    if (now - entry.last < 3000) {
      entry.count++;
      if (entry.count >= 5) {
        await message.delete().catch(() => {});
        await message.member.timeout(60000, 'Spam').catch(() => {});
        client._spamMap.delete(key);
        return message.channel.send({ embeds: [errorEmbed(`${message.author} has been muted for spamming.`)] })
          .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
      }
    } else {
      entry.count = 1;
    }
    entry.last = now;
    client._spamMap.set(key, entry);
  }

  if (!message.content.startsWith(PREFIX)) {
    await funCmd.handleGuess(message);
    return;
  }

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = args.shift().toLowerCase();

  if (config.customCommands && config.customCommands[cmd]) {
    return message.channel.send(config.customCommands[cmd]);
  }

  if (cmd === 'help') return handleHelp(message);

  if (['add_admin', 'remove_admin', 'list_admins'].includes(cmd)) {
    return adminCmd.handle(message, args, cmd);
  }

  if (['ticketpanel', 'setticket', 'close', 'claim', 'rename', 'transfer', 'add', 'remove', 'transcript', 'closetickets'].includes(cmd)) {
    return ticketsCmd.handle(message, args, cmd);
  }

  if (['autovouch', 'autovouchstop', 'autovouchchannel', 'autovouchtarget', 'autovouchinterval', 'autovouchusers', 'autovouchremove'].includes(cmd)) {
    return autovouchCmd.handle(message, args, cmd, client);
  }

  if (['embed', 'panel', 'builder', 'createcmd'].includes(cmd)) {
    return embedCmd.handle(message, args, cmd);
  }

  if (['setwelcome', 'welcometest'].includes(cmd)) {
    return welcomeCmd.handle(message, args, cmd);
  }

  if (['ban', 'kick', 'mute', 'warn', 'warnings', 'lock', 'unlock', 'purge'].includes(cmd)) {
    return moderationCmd.handle(message, args, cmd);
  }

  if (['promote', 'demote', 'fill', 'setroletier', 'setstaffrole'].includes(cmd)) {
    return rolesCmd.handle(message, args, cmd);
  }

  if (cmd === 'dmall') {
    return massdmCmd.handle(message, args, cmd);
  }

  if (['setmodlog', 'setsupportrole', 'antispam', 'antilink'].includes(cmd)) {
    return setupCmd.handle(message, args, cmd);
  }

  if (['mmfee', 'mminfo', 'blunderbluss', 'confirm', 'serverinfo', 'userinfo', 'roleinfo', 'vouches', 'vouchlb', 'setvouches', 'w'].includes(cmd)) {
    return middlemanCmd.handle(message, args, cmd);
  }

  if (['rps', 'ttt', 'cf', 'roll', '8ball', 'guess', 'meme', 'dadjoke', 'ship', 'rate'].includes(cmd)) {
    return funCmd.handle(message, args, cmd);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const id = interaction.customId;

    if (['ticket_open', 'ticket_close', 'ticket_claim'].includes(id)) {
      return ticketsCmd.handleButton(interaction);
    }

    if (id.startsWith('rps_')) {
      return funCmd.handleButtonRPS(interaction);
    }

    if (id.startsWith('ttt_')) {
      return handleTTT(interaction);
    }

    if (id.startsWith('builder_')) {
      return handleBuilder(interaction);
    }
  }

  if (interaction.isModalSubmit()) {
    return handleModalSubmit(interaction);
  }
});

async function handleTTT(interaction) {
  const parts = interaction.customId.split('_');
  const gameId = `${parts[1]}_${parts[2]}`;
  const idx = parseInt(parts[3]);

  const { getTTTGame, setTTTGame, deleteTTTGame, buildTTTEmbed } = funCmd;
  const game = funCmd.getTTTGame(gameId);
  if (!game) return interaction.reply({ embeds: [errorEmbed('Game not found.')], ephemeral: true });
  if (interaction.user.id !== game.currentPlayer) {
    return interaction.reply({ embeds: [errorEmbed("It's not your turn!")], ephemeral: true });
  }
  if (game.board[idx] !== null) return interaction.reply({ embeds: [errorEmbed('That cell is already taken.')], ephemeral: true });

  const symbol = game.players.X === interaction.user.id ? 'X' : 'O';
  game.board[idx] = symbol;

  const winner = checkTTTWinner(game.board);
  const isDraw = !winner && game.board.every(c => c !== null);

  if (winner || isDraw) {
    funCmd.deleteTTTGame(gameId);
    const resultEmbed = new EmbedBuilder().setColor(winner ? 0x57F287 : 0xFEE75C)
      .setTitle('❌⭕ Tic-Tac-Toe')
      .setDescription(buildTTTBoardStr(game.board))
      .addFields({ name: 'Result', value: winner ? `<@${game.players[winner]}> wins! ${winner === 'X' ? '❌' : '⭕'}` : "It's a draw! 🤝" });
    return interaction.update({ embeds: [resultEmbed], components: [] });
  }

  game.currentPlayer = game.players.X === interaction.user.id ? game.players.O : game.players.X;
  funCmd.setTTTGame(gameId, game);

  const symbols = { null: '⬜', X: '❌', O: '⭕' };
  const b = game.board;
  const boardStr = `${symbols[b[0]]}${symbols[b[1]]}${symbols[b[2]]}\n${symbols[b[3]]}${symbols[b[4]]}${symbols[b[5]]}\n${symbols[b[6]]}${symbols[b[7]]}${symbols[b[8]]}`;
  const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('❌⭕ Tic-Tac-Toe').setDescription(boardStr).addFields({ name: 'Turn', value: `<@${game.currentPlayer}>` });

  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const i = r * 3 + c;
      const cell = game.board[i];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${gameId}_${i}`)
          .setLabel(cell === null ? '\u200b' : (cell === 'X' ? '❌' : '⭕'))
          .setStyle(cell === null ? ButtonStyle.Secondary : (cell === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary))
          .setDisabled(cell !== null)
      );
    }
    rows.push(row);
  }
  return interaction.update({ embeds: [embed], components: rows });
}

function buildTTTBoardStr(board) {
  const symbols = { null: '⬜', X: '❌', O: '⭕' };
  const b = board;
  return `${symbols[b[0]]}${symbols[b[1]]}${symbols[b[2]]}\n${symbols[b[3]]}${symbols[b[4]]}${symbols[b[5]]}\n${symbols[b[6]]}${symbols[b[7]]}${symbols[b[8]]}`;
}

function checkTTTWinner(board) {
  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  for (const [a,b,c] of lines) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  }
  return null;
}

async function handleBuilder(interaction) {
  const session = embedCmd.getBuilderSession(interaction.user.id);
  if (!session) return interaction.reply({ embeds: [errorEmbed('No active builder session.')], ephemeral: true });

  const id = interaction.customId;

  if (id === 'builder_send') {
    const embed = embedCmd.buildPreview(session);
    await interaction.channel.send({ embeds: [embed] });
    embedCmd.deleteBuilderSession(interaction.user.id);
    return interaction.update({ content: '✅ Embed sent!', embeds: [], components: [] });
  }

  if (id === 'builder_cancel') {
    embedCmd.deleteBuilderSession(interaction.user.id);
    return interaction.update({ content: '❌ Embed builder cancelled.', embeds: [], components: [] });
  }

  const modals = {
    builder_title: { title: 'Set Embed Title', fields: [{ id: 'title', label: 'Title', placeholder: 'Enter title...', style: TextInputStyle.Short }] },
    builder_desc: { title: 'Set Description', fields: [{ id: 'description', label: 'Description', placeholder: 'Enter description...', style: TextInputStyle.Paragraph }] },
    builder_color: { title: 'Set Color', fields: [{ id: 'color', label: 'Hex Color (e.g. #5865F2)', placeholder: '#5865F2', style: TextInputStyle.Short }] },
    builder_footer: { title: 'Set Footer', fields: [{ id: 'footer', label: 'Footer Text', placeholder: 'Footer text...', style: TextInputStyle.Short }] },
    builder_addfield: { title: 'Add Field', fields: [
      { id: 'fieldname', label: 'Field Name', placeholder: 'Name', style: TextInputStyle.Short },
      { id: 'fieldvalue', label: 'Field Value', placeholder: 'Value', style: TextInputStyle.Paragraph },
    ]},
  };

  const modalDef = modals[id];
  if (!modalDef) return;

  const modal = new ModalBuilder().setCustomId(`modal_${id}`).setTitle(modalDef.title);
  const components = modalDef.fields.map(f =>
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId(f.id).setLabel(f.label).setPlaceholder(f.placeholder || '').setStyle(f.style).setRequired(false)
    )
  );
  modal.addComponents(...components);
  return interaction.showModal(modal);
}

async function handleModalSubmit(interaction) {
  const id = interaction.customId;
  const session = embedCmd.getBuilderSession(interaction.user.id);
  if (!session) return interaction.reply({ embeds: [errorEmbed('Session expired.')], ephemeral: true });

  if (id === 'modal_builder_title') {
    session.title = interaction.fields.getTextInputValue('title') || session.title;
  } else if (id === 'modal_builder_desc') {
    session.description = interaction.fields.getTextInputValue('description') || session.description;
  } else if (id === 'modal_builder_color') {
    session.color = interaction.fields.getTextInputValue('color') || session.color;
  } else if (id === 'modal_builder_footer') {
    session.footer = interaction.fields.getTextInputValue('footer') || session.footer;
  } else if (id === 'modal_builder_addfield') {
    const name = interaction.fields.getTextInputValue('fieldname');
    const value = interaction.fields.getTextInputValue('fieldvalue');
    if (name && value) session.fields.push({ name, value });
  }

  embedCmd.setBuilderSession(interaction.user.id, session);
  const preview = embedCmd.buildPreview(session);

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

  return interaction.update({ content: '**Embed Builder** — live preview:', embeds: [preview], components: [row, row2] });
}

function handleHelp(message) {
  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('📖 Full Command List')
    .addFields(
      { name: '🛡️ Bot Admin Management', value: '`$add_admin @user` `$remove_admin @user` `$list_admins`' },
      { name: '🎫 Ticket System', value: '`$ticketpanel` `$setticket <field> <val>` `$close` `$claim` `$rename <name>` `$transfer @user` `$add @user` `$remove @user` `$transcript` `$closetickets`' },
      { name: '⭐ Auto Vouch', value: '`$autovouch` `$autovouchstop` `$autovouchchannel #ch` `$autovouchtarget @user` `$autovouchinterval <secs>` `$autovouchusers @u` `$autovouchremove @u`' },
      { name: '🎨 Embed Builder', value: '`$embed <title>|<desc>|[color]` `$panel <title>|<desc>` `$builder` `$createcmd <name> <response>`' },
      { name: '👋 Welcome', value: '`$setwelcome <field> <value>` `$welcometest`\nFields: `channel`, `message`, `title`, `color`, `enabled`' },
      { name: '🔨 Moderation', value: '`$ban @user [reason]` `$kick @user [reason]` `$mute @user [mins] [reason]` `$warn @user [reason]` `$warnings @user` `$lock` `$unlock` `$purge <amount>`' },
      { name: '👑 Roles', value: '`$promote @user` `$demote @user` `$fill @user` `$setroletier @r1 @r2 @r3` `$setstaffrole @role`' },
      { name: '📨 Mass DM', value: '`$dmall <message>` — Send a DM to all server members' },
      { name: '⚙️ Setup', value: '`$setmodlog #channel` `$setsupportrole @role` `$antispam on/off` `$antilink on/off`' },
      { name: '🤝 Middleman', value: '`$mmfee [amount]` `$mminfo` `$mminfo setimage <url>` `$blunderbluss @user` `$confirm` `$w @user` `$userinfo @user` `$serverinfo` `$vouches @user` `$vouchlb` `$setvouches @user <n>` `$roleinfo @role`' },
      { name: '🎮 Fun', value: '`$rps` `$ttt @user` `$cf` `$roll [sides]` `$8ball <question>` `$guess` `$meme` `$dadjoke` `$ship @u1 @u2` `$rate <thing>`' },
    )
    .setFooter({ text: 'Admin view — full access | $add_admin @user to grant access' })
    .setTimestamp();
  return message.reply({ embeds: [embed] });
}

const TOKEN = process.env.DISCORD_TOKEN;
if (!TOKEN) {
  console.error('❌ DISCORD_TOKEN is not set. Please add it to your environment secrets.');
  process.exit(1);
}

client.login(TOKEN);
