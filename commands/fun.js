const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { infoEmbed, errorEmbed } = require('../utils/helpers');
const axios = require('axios');

const tttGames = {};
const guessGames = {};

module.exports = {
  name: 'fun',
  async handle(message, args, cmd) {

    if (cmd === 'rps') {
      const choices = ['🪨 Rock', '📄 Paper', '✂️ Scissors'];
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('rps_rock').setLabel('Rock').setStyle(ButtonStyle.Primary).setEmoji('🪨'),
        new ButtonBuilder().setCustomId('rps_paper').setLabel('Paper').setStyle(ButtonStyle.Primary).setEmoji('📄'),
        new ButtonBuilder().setCustomId('rps_scissors').setLabel('Scissors').setStyle(ButtonStyle.Primary).setEmoji('✂️'),
      );
      return message.reply({ embeds: [infoEmbed('🎮 Rock Paper Scissors', 'Choose your move!')], components: [row] });
    }

    if (cmd === 'cf') {
      const result = Math.random() < 0.5 ? '🪙 Heads' : '🪙 Tails';
      return message.reply({ embeds: [infoEmbed('Coin Flip', `The coin landed on **${result}**!`)] });
    }

    if (cmd === 'roll') {
      const sides = parseInt(args[0]) || 6;
      const result = Math.floor(Math.random() * sides) + 1;
      return message.reply({ embeds: [infoEmbed('🎲 Dice Roll', `You rolled a **${result}** (d${sides})`)] });
    }

    if (cmd === '8ball') {
      const question = args.join(' ');
      if (!question) return message.reply({ embeds: [errorEmbed('Please ask a question.')] });
      const responses = [
        'It is certain.', 'It is decidedly so.', 'Without a doubt.', 'Yes, definitely.',
        'You may rely on it.', 'As I see it, yes.', 'Most likely.', 'Outlook good.',
        'Yes.', 'Signs point to yes.', 'Reply hazy, try again.', 'Ask again later.',
        'Better not tell you now.', 'Cannot predict now.', "Concentrate and ask again.",
        "Don't count on it.", 'My reply is no.', 'My sources say no.', 'Outlook not so good.', 'Very doubtful.'
      ];
      const answer = responses[Math.floor(Math.random() * responses.length)];
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🎱 Magic 8-Ball').addFields({ name: 'Question', value: question }, { name: 'Answer', value: answer })] });
    }

    if (cmd === 'meme') {
      try {
        const res = await axios.get('https://meme-api.com/gimme');
        const embed = new EmbedBuilder()
          .setColor(0xFF4500)
          .setTitle(res.data.title)
          .setImage(res.data.url)
          .setFooter({ text: `👍 ${res.data.ups} | r/${res.data.subreddit}` });
        return message.reply({ embeds: [embed] });
      } catch {
        return message.reply({ embeds: [errorEmbed('Failed to fetch a meme. Try again later.')] });
      }
    }

    if (cmd === 'dadjoke') {
      try {
        const res = await axios.get('https://icanhazdadjoke.com/', { headers: { Accept: 'application/json' } });
        return message.reply({ embeds: [infoEmbed('😄 Dad Joke', res.data.joke)] });
      } catch {
        return message.reply({ embeds: [errorEmbed('Failed to fetch a dad joke.')] });
      }
    }

    if (cmd === 'ship') {
      const user1 = message.mentions.users.first();
      const user2 = message.mentions.users.at(1) || message.author;
      const score = Math.floor(Math.random() * 101);
      const bar = '█'.repeat(Math.floor(score / 10)) + '░'.repeat(10 - Math.floor(score / 10));
      const emoji = score >= 80 ? '💞' : score >= 50 ? '💗' : '💔';
      return message.reply({ embeds: [new EmbedBuilder().setColor(0xFF69B4).setTitle(`${emoji} Shipping`).setDescription(`**${user1?.username || 'Unknown'} + ${user2.username}**\n\n${bar} **${score}%**`)] });
    }

    if (cmd === 'rate') {
      const thing = args.join(' ');
      if (!thing) return message.reply({ embeds: [errorEmbed('Please provide something to rate.')] });
      const score = Math.floor(Math.random() * 11);
      return message.reply({ embeds: [infoEmbed('⭐ Rating', `I rate **${thing}** a **${score}/10**!`)] });
    }

    if (cmd === 'guess') {
      if (guessGames[message.channel.id]) {
        return message.reply({ embeds: [errorEmbed('A guess game is already running in this channel!')] });
      }
      const num = Math.floor(Math.random() * 100) + 1;
      guessGames[message.channel.id] = { number: num, attempts: 0, userId: message.author.id };
      return message.reply({ embeds: [infoEmbed('🎯 Guess the Number', 'I\'m thinking of a number between **1 and 100**! Type your guess in the chat.\nType `stop` to end the game.')] });
    }

    if (cmd === 'ttt') {
      const opponent = message.mentions.members.first();
      if (!opponent) return message.reply({ embeds: [errorEmbed('Please mention an opponent.')] });
      if (opponent.id === message.author.id) return message.reply({ embeds: [errorEmbed('You cannot play against yourself.')] });
      if (opponent.user.bot) return message.reply({ embeds: [errorEmbed('You cannot play against a bot.')] });

      const gameId = `${message.author.id}_${opponent.id}`;
      tttGames[gameId] = {
        board: Array(9).fill(null),
        currentPlayer: message.author.id,
        players: { X: message.author.id, O: opponent.id },
        gameId
      };

      const embed = buildTTTEmbed(tttGames[gameId], message.author, opponent.user);
      const rows = buildTTTButtons(tttGames[gameId]);
      return message.reply({ content: `${message.author} vs ${opponent}`, embeds: [embed], components: rows });
    }
  },

  getTTTGame(gameId) { return tttGames[gameId]; },
  setTTTGame(gameId, game) { tttGames[gameId] = game; },
  deleteTTTGame(gameId) { delete tttGames[gameId]; },

  getGuessGame(channelId) { return guessGames[channelId]; },
  deleteGuessGame(channelId) { delete guessGames[channelId]; },

  async handleGuess(message) {
    const game = guessGames[message.channel.id];
    if (!game) return;
    if (message.author.id !== game.userId) return;

    if (message.content.toLowerCase() === 'stop') {
      delete guessGames[message.channel.id];
      return message.reply({ embeds: [infoEmbed('Game Over', `The number was **${game.number}**!`)] });
    }

    const guess = parseInt(message.content);
    if (isNaN(guess)) return;

    game.attempts++;
    if (guess === game.number) {
      delete guessGames[message.channel.id];
      return message.reply({ embeds: [new EmbedBuilder().setColor(0x57F287).setTitle('🎉 Correct!').setDescription(`You guessed **${game.number}** in **${game.attempts}** attempts!`)] });
    }

    const hint = guess < game.number ? '📈 Too low!' : '📉 Too high!';
    return message.reply({ embeds: [infoEmbed('🎯 Guess the Number', `${hint} Attempt #${game.attempts}`)] });
  },

  async handleButtonRPS(interaction) {
    const moves = { rps_rock: 'Rock', rps_paper: 'Paper', rps_scissors: 'Scissors' };
    const emojis = { Rock: '🪨', Paper: '📄', Scissors: '✂️' };
    const botChoices = ['Rock', 'Paper', 'Scissors'];
    const player = moves[interaction.customId];
    const bot = botChoices[Math.floor(Math.random() * 3)];
    let result;
    if (player === bot) result = "It's a tie!";
    else if ((player === 'Rock' && bot === 'Scissors') || (player === 'Paper' && bot === 'Rock') || (player === 'Scissors' && bot === 'Paper')) result = '🎉 You win!';
    else result = '😔 You lose!';
    return interaction.update({
      embeds: [new EmbedBuilder().setColor(0x5865F2).setTitle('🎮 Rock Paper Scissors')
        .addFields({ name: 'You', value: `${emojis[player]} ${player}`, inline: true }, { name: 'Bot', value: `${emojis[bot]} ${bot}`, inline: true }, { name: 'Result', value: result })],
      components: []
    });
  },
};

function buildTTTEmbed(game, user1, user2) {
  const symbols = { null: '⬜', X: '❌', O: '⭕' };
  const b = game.board;
  const board = `${symbols[b[0]]}${symbols[b[1]]}${symbols[b[2]]}\n${symbols[b[3]]}${symbols[b[4]]}${symbols[b[5]]}\n${symbols[b[6]]}${symbols[b[7]]}${symbols[b[8]]}`;
  return new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle('❌⭕ Tic-Tac-Toe')
    .setDescription(board)
    .addFields({ name: 'Turn', value: `<@${game.currentPlayer}>` });
}

function buildTTTButtons(game) {
  const rows = [];
  for (let r = 0; r < 3; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const cell = game.board[idx];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ttt_${game.gameId}_${idx}`)
          .setLabel(cell === null ? '‎' : (cell === 'X' ? '❌' : '⭕'))
          .setStyle(cell === null ? ButtonStyle.Secondary : (cell === 'X' ? ButtonStyle.Danger : ButtonStyle.Primary))
          .setDisabled(cell !== null)
      );
    }
    rows.push(row);
  }
  return rows;
}
