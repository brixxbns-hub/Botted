import { createRequire } from 'node:module';
globalThis.require = createRequire(import.meta.url);
import startServer from './server.js';
await startServer();

// src/index.ts
import { Client as Client6, GatewayIntentBits, Partials } from "discord.js";

// src/events/ready.ts
import { ActivityType } from "discord.js";

// src/lib/database.ts
import { DatabaseSync } from "node:sqlite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
var __dirname = path.dirname(fileURLToPath(import.meta.url));
var DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
var DB_PATH = path.join(DATA_DIR, "bot.db");
var db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id TEXT PRIMARY KEY,
    prefix TEXT DEFAULT '$',
    ticket_category TEXT,
    ticket_staff_roles TEXT DEFAULT '[]',
    ticket_transcript_channel TEXT,
    ticket_name_format TEXT DEFAULT 'ticket-{username}',
    ticket_title TEXT DEFAULT 'Support Ticket',
    ticket_description TEXT DEFAULT 'Please describe your issue and a staff member will assist you shortly.',
    ticket_color TEXT DEFAULT '#5865F2',
    ticket_banner TEXT,
    welcome_channel TEXT,
    welcome_title TEXT DEFAULT 'Welcome to the server!',
    welcome_description TEXT DEFAULT 'Welcome {user} to {server}!',
    welcome_color TEXT DEFAULT '#57F287',
    welcome_banner TEXT,
    mod_log_channel TEXT,
    staff_roles TEXT DEFAULT '[]',
    mm_fee TEXT DEFAULT '5%',
    mm_info TEXT DEFAULT 'Middleman service available.',
    auto_vouch_channel TEXT,
    auto_vouch_users TEXT DEFAULT '[]',
    auto_vouch_enabled INTEGER DEFAULT 0,
    auto_vouch_interval INTEGER DEFAULT 150000,
    role_hierarchy TEXT DEFAULT '[]',
    anti_spam INTEGER DEFAULT 0,
    anti_link INTEGER DEFAULT 0,
    support_role TEXT,
    auto_vouch_target TEXT,
    mm_image TEXT,
    bot_admins TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    claimed_by TEXT,
    status TEXT DEFAULT 'open',
    created_at INTEGER DEFAULT (strftime('%s','now')),
    closed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS vouches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    count INTEGER DEFAULT 0,
    UNIQUE(guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  );

  CREATE TABLE IF NOT EXISTS custom_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    color TEXT DEFAULT '#5865F2',
    image TEXT,
    thumbnail TEXT,
    footer TEXT,
    buttons TEXT DEFAULT '[]',
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS auto_vouch_last (
    guild_id TEXT PRIMARY KEY,
    last_user_id TEXT
  );

  CREATE TABLE IF NOT EXISTS client_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    message TEXT NOT NULL
  );
`);
var existingCols = db.prepare("PRAGMA table_info(guild_config)").all();
var colNames = existingCols.map((c) => c.name);
if (!colNames.includes("auto_vouch_target")) {
  db.exec("ALTER TABLE guild_config ADD COLUMN auto_vouch_target TEXT");
}
if (!colNames.includes("support_role")) {
  db.exec("ALTER TABLE guild_config ADD COLUMN support_role TEXT");
}
if (!colNames.includes("mm_image")) {
  db.exec("ALTER TABLE guild_config ADD COLUMN mm_image TEXT");
}
if (!colNames.includes("bot_admins")) {
  db.exec("ALTER TABLE guild_config ADD COLUMN bot_admins TEXT DEFAULT '[]'");
}
function getGuildConfig(guildId) {
  let config = db.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId);
  if (!config) {
    db.prepare("INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)").run(guildId);
    config = db.prepare("SELECT * FROM guild_config WHERE guild_id = ?").get(guildId);
  }
  config.ticket_staff_roles = JSON.parse(config.ticket_staff_roles || "[]");
  config.staff_roles = JSON.parse(config.staff_roles || "[]");
  config.auto_vouch_users = JSON.parse(config.auto_vouch_users || "[]");
  try {
    const raw = config.auto_vouch_target;
    if (!raw) config.auto_vouch_targets = [];
    else if (raw.startsWith("[")) config.auto_vouch_targets = JSON.parse(raw);
    else config.auto_vouch_targets = [raw];
  } catch { config.auto_vouch_targets = []; }
  config.role_hierarchy = JSON.parse(config.role_hierarchy || "[]");
  config.bot_admins = JSON.parse(config.bot_admins || "[]");
  return config;
}
function updateGuildConfig(guildId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  db.prepare("INSERT OR IGNORE INTO guild_config (guild_id) VALUES (?)").run(guildId);
  for (const key of keys) {
    const val = updates[key];
    const serialized = Array.isArray(val) || typeof val === "object" && val !== null ? JSON.stringify(val) : val;
    db.prepare(`UPDATE guild_config SET ${key} = ? WHERE guild_id = ?`).run(serialized, guildId);
  }
}
function getVouches(guildId, userId) {
  const row = db.prepare("SELECT count FROM vouches WHERE guild_id = ? AND user_id = ?").get(guildId, userId);
  return row ? row.count : 0;
}
function setVouches(guildId, userId, amount) {
  db.prepare(
    "INSERT INTO vouches (guild_id, user_id, count) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET count = ?"
  ).run(guildId, userId, amount, amount);
}
function addVouch(guildId, userId, amount = 1) {
  db.prepare(
    "INSERT INTO vouches (guild_id, user_id, count) VALUES (?, ?, ?) ON CONFLICT(guild_id, user_id) DO UPDATE SET count = count + ?"
  ).run(guildId, userId, amount, amount);
  return getVouches(guildId, userId);
}
function getVouchLeaderboard(guildId) {
  return db.prepare("SELECT user_id, count FROM vouches WHERE guild_id = ? ORDER BY count DESC LIMIT 10").all(guildId);
}
function addClientFeedback(guildId, message) {
  db.prepare("INSERT INTO client_feedback (guild_id, message) VALUES (?, ?)").run(guildId, message);
}
function getClientFeedback(guildId) {
  return db.prepare("SELECT id, message FROM client_feedback WHERE guild_id = ? ORDER BY id ASC").all(guildId);
}
function removeClientFeedback(guildId, id) {
  db.prepare("DELETE FROM client_feedback WHERE guild_id = ? AND id = ?").run(guildId, id);
}
function getRandomClientFeedback(guildId) {
  const all = getClientFeedback(guildId);
  if (all.length === 0) return null;
  return all[Math.floor(Math.random() * all.length)].message;
}
function addWarning(guildId, userId, moderatorId, reason) {
  db.prepare(
    "INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)"
  ).run(guildId, userId, moderatorId, reason);
}
function getWarnings(guildId, userId) {
  return db.prepare("SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC").all(guildId, userId);
}
function getTicket(channelId) {
  return db.prepare("SELECT * FROM tickets WHERE channel_id = ?").get(channelId);
}
function updateTicket(channelId, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;
  const sets = keys.map((k) => `${k} = ?`).join(", ");
  const vals = keys.map((k) => updates[k]);
  db.prepare(`UPDATE tickets SET ${sets} WHERE channel_id = ?`).run(...vals, channelId);
}
function getCustomCommand(guildId, name) {
  const row = db.prepare("SELECT * FROM custom_commands WHERE guild_id = ? AND name = ?").get(guildId, name);
  if (row) row.buttons = JSON.parse(row.buttons || "[]");
  return row;
}
function saveCustomCommand(guildId, name, data) {
  const { title, description, color, image, thumbnail, footer, buttons } = data;
  db.prepare(
    `INSERT INTO custom_commands (guild_id, name, title, description, color, image, thumbnail, footer, buttons)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, name) DO UPDATE SET
       title=excluded.title, description=excluded.description, color=excluded.color,
       image=excluded.image, thumbnail=excluded.thumbnail, footer=excluded.footer, buttons=excluded.buttons`
  ).run(guildId, name, title, description, color || "#5865F2", image, thumbnail, footer, JSON.stringify(buttons || []));
}

// src/events/ready.ts
function writeHeartbeat(client2) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bot_heartbeat (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        bot_tag TEXT,
        last_ping INTEGER,
        guild_count INTEGER
      )
    `);
    const guildCount = client2.guilds.cache.size;
    const tag = client2.user?.tag ?? "Unknown";
    const now = Math.floor(Date.now() / 1e3);
    db.prepare(
      `INSERT INTO bot_heartbeat (id, bot_tag, last_ping, guild_count)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET bot_tag=excluded.bot_tag, last_ping=excluded.last_ping, guild_count=excluded.guild_count`
    ).run(tag, now, guildCount);
  } catch {
  }
}
function handleReady(client2) {
  client2.once("clientReady", () => {
    console.log(`\u2705 Logged in as ${client2.user?.tag}`);
    client2.user?.setActivity("$ | Middleman Bot", { type: ActivityType.Watching });
    writeHeartbeat(client2);
    setInterval(() => writeHeartbeat(client2), 3e4);
  });
}

// src/events/messageCreate.ts
import { PermissionFlagsBits as PermissionFlagsBits3 } from "discord.js";

// src/commands/admin/index.ts
import { EmbedBuilder as EmbedBuilder2, ActionRowBuilder as ActionRowBuilder2, ButtonBuilder as ButtonBuilder2, ButtonStyle as ButtonStyle2 } from "discord.js";

// src/lib/utils.ts
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} from "discord.js";
function parseColor(hex) {
  return parseInt(hex.replace("#", ""), 16);
}
function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}
function isStaff(member, guildId) {
  if (isAdmin(member)) return true;
  const config = getGuildConfig(guildId);
  const staffRoles = config.staff_roles || [];
  const ticketStaffRoles = config.ticket_staff_roles || [];
  const allStaff = [...staffRoles, ...ticketStaffRoles];
  return allStaff.some((r) => member.roles.cache.has(r));
}
function successEmbed(title, description) {
  const e = new EmbedBuilder().setColor(5763719).setTitle(`\u2705 ${title}`);
  if (description) e.setDescription(description);
  return e;
}
function errorEmbed(title, description) {
  const e = new EmbedBuilder().setColor(15548997).setTitle(`\u274C ${title}`);
  if (description) e.setDescription(description);
  return e;
}
function infoEmbed(title, description) {
  const e = new EmbedBuilder().setColor(5793266).setTitle(`\u2139\uFE0F ${title}`);
  if (description) e.setDescription(description);
  return e;
}
function buildCustomEmbed(data) {
  const e = new EmbedBuilder();
  if (data.title) e.setTitle(data.title);
  if (data.description) e.setDescription(data.description);
  if (data.color) e.setColor(parseColor(data.color));
  if (data.image) e.setImage(data.image);
  if (data.thumbnail) e.setThumbnail(data.thumbnail);
  if (data.footer) e.setFooter({ text: data.footer });
  if (data.timestamp) e.setTimestamp();
  return e;
}
function buildButtonRow(buttons) {
  const row = new ActionRowBuilder();
  for (const btn of buttons.slice(0, 5)) {
    const b = new ButtonBuilder().setLabel(btn.label);
    if (btn.url) {
      b.setStyle(ButtonStyle.Link).setURL(btn.url);
    } else {
      const style = btn.style === "danger" ? ButtonStyle.Danger : btn.style === "success" ? ButtonStyle.Success : btn.style === "secondary" ? ButtonStyle.Secondary : ButtonStyle.Primary;
      b.setStyle(style).setCustomId(btn.customId || btn.label.toLowerCase());
    }
    row.addComponents(b);
  }
  return row;
}
async function sendTranscript(guild, channelId, ticketChannelId, userId) {
  try {
    const transcriptChannel = guild.channels.cache.get(channelId);
    if (!transcriptChannel) return;
    const ticketChannel = guild.channels.cache.get(ticketChannelId);
    if (!ticketChannel) return;
    const messages = await ticketChannel.messages.fetch({ limit: 100 });
    const sorted = [...messages.values()].reverse();
    const transcript = sorted.map(
      (m) => `[${new Date(m.createdTimestamp).toISOString()}] ${m.author.tag}: ${m.content}`
    ).join("\n");
    const embed = new EmbedBuilder().setColor(5793266).setTitle("\u{1F4CB} Ticket Transcript").setDescription(`Ticket: <#${ticketChannelId}>\nUser: <@${userId}>`).setTimestamp();
    await transcriptChannel.send({
      embeds: [embed],
      files: [
        {
          attachment: Buffer.from(transcript, "utf-8"),
          name: `transcript-${ticketChannelId}.txt`
        }
      ]
    });
  } catch {
  }
}
function accountAge(createdAt) {
  const now = Date.now();
  const diff = now - createdAt.getTime();
  const days = Math.floor(diff / (1e3 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.floor(days / 30)} months`;
  return `${Math.floor(days / 365)} years`;
}

// src/commands/admin/index.ts
async function handleAdminCommands(message, command, args, config, isAdminUser) {
  const guildId = message.guild.id;
  switch (command) {
    case "help": {
      if (!isAdminUser) {
        const denied = new EmbedBuilder2().setColor(15548997).setDescription("\u274C Sorry, this command is for admins only.");
        await message.reply({ embeds: [denied] });
        return true;
      }
      await showAdminHelp(message);
      return true;
    }
    case "add_admin": {
      if (!isAdminUser) return false;
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply({ embeds: [errorEmbed("Usage", "$add_admin @user")] });
        return true;
      }
      const admins = [...config.bot_admins || []];
      if (admins.includes(target.id)) {
        await message.reply({ embeds: [errorEmbed("Already Admin", `${target} is already a bot admin.`)] });
        return true;
      }
      admins.push(target.id);
      updateGuildConfig(guildId, { bot_admins: admins });
      await message.reply({ embeds: [successEmbed("Bot Admin Added", `${target} has been granted bot admin access.`)] });
      return true;
    }
    case "remove_admin": {
      if (!isAdminUser) return false;
      const target = message.mentions.users.first();
      if (!target) {
        await message.reply({ embeds: [errorEmbed("Usage", "$remove_admin @user")] });
        return true;
      }
      const admins = (config.bot_admins || []).filter((id) => id !== target.id);
      updateGuildConfig(guildId, { bot_admins: admins });
      await message.reply({ embeds: [successEmbed("Bot Admin Removed", `${target} has been removed from bot admin access.`)] });
      return true;
    }
    case "list_admins": {
      if (!isAdminUser) return false;
      const admins = config.bot_admins || [];
      const desc = admins.length ? admins.map((id) => `<@${id}>`).join("\n") : "No bot admins added yet.";
      await message.reply({
        embeds: [new EmbedBuilder2().setColor(5793266).setTitle("\u{1F6E1}\uFE0F Bot Admins").setDescription(desc)]
      });
      return true;
    }
    case "ticketpanel": {
      if (!isAdminUser) return false;
      const embed = new EmbedBuilder2().setColor(15770880).setTitle("Middleman Service").setDescription(
        "Found a trade and would like to ensure a safe trading experience?\n\n**Open a ticket below**\n\n**What we provide**\n\u2022 Safe trades between 2 parties\n\u2022 Fast and easy deals\n\n**Important notes**\n\u2022 Both parties must agree before opening a ticket\n\u2022 Fake/Troll tickets will result in a ban\n\u2022 Follow Discord ToS and server guidelines"
      );
      if (config.ticket_banner) embed.setImage(config.ticket_banner);
      const row = new ActionRowBuilder2().addComponents(
        new ButtonBuilder2().setCustomId("ticket_open").setLabel("Request").setStyle(ButtonStyle2.Success).setEmoji("\u2705")
      );
      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete().catch(() => {});
      return true;
    }
    case "setticket": {
      if (!isAdminUser) return false;
      const sub = args[0]?.toLowerCase();
      const val = args.slice(1).join(" ");
      if (!sub || !val) {
        await message.reply({ embeds: [errorEmbed("Usage", `$setticket <title|description|color|banner|category|format|staffrole|transcriptchannel> <value>`)] });
        return true;
      }
      const fieldMap = {
        title: "ticket_title",
        description: "ticket_description",
        color: "ticket_color",
        banner: "ticket_banner",
        category: "ticket_category",
        format: "ticket_name_format"
      };
      if (sub === "staffrole") {
        const roleId = val.replace(/[<@&>]/g, "");
        const roles = [...config.ticket_staff_roles || []];
        if (!roles.includes(roleId)) roles.push(roleId);
        updateGuildConfig(guildId, { ticket_staff_roles: roles });
        await message.reply({ embeds: [successEmbed("Staff Role Added", `<@&${roleId}> added as ticket staff.`)] });
        return true;
      }
      if (sub === "transcriptchannel") {
        const chId = val.replace(/[<#>]/g, "");
        updateGuildConfig(guildId, { ticket_transcript_channel: chId });
        await message.reply({ embeds: [successEmbed("Transcript Channel Set", `<#${chId}> set as transcript channel.`)] });
        return true;
      }
      if (fieldMap[sub]) {
        updateGuildConfig(guildId, { [fieldMap[sub]]: val });
        await message.reply({ embeds: [successEmbed("Updated", `Ticket ${sub} updated.`)] });
      } else {
        await message.reply({ embeds: [errorEmbed("Unknown Setting", `Unknown ticket setting: ${sub}`)] });
      }
      return true;
    }
    case "setwelcome": {
      if (!isAdminUser) return false;
      const sub = args[0]?.toLowerCase();
      const val = args.slice(1).join(" ");
      if (!sub || !val) {
        await message.reply({ embeds: [errorEmbed("Usage", "$setwelcome <title|description|color|banner|channel> <value>")] });
        return true;
      }
      const fieldMap = {
        title: "welcome_title",
        description: "welcome_description",
        color: "welcome_color",
        banner: "welcome_banner",
        channel: "welcome_channel"
      };
      if (sub === "channel") {
        const chId = val.replace(/[<#>]/g, "");
        updateGuildConfig(guildId, { welcome_channel: chId });
        await message.reply({ embeds: [successEmbed("Welcome Channel Set", `<#${chId}> set.`)] });
        return true;
      }
      if (fieldMap[sub]) {
        updateGuildConfig(guildId, { [fieldMap[sub]]: val });
        await message.reply({ embeds: [successEmbed("Updated", `Welcome ${sub} updated.`)] });
      }
      return true;
    }
    case "welcometest": {
      if (!isAdminUser) return false;
      const member = message.member;
      const cfg = getGuildConfig(guildId);
      const desc = (cfg.welcome_description || "Welcome {user} to {server}!").replace("{user}", `${member}`).replace("{server}", message.guild.name).replace("{membercount}", `${message.guild.memberCount}`);
      const embed = new EmbedBuilder2().setColor(parseInt((cfg.welcome_color || "#57F287").replace("#", ""), 16)).setTitle(cfg.welcome_title || "Welcome!").setDescription(desc).setThumbnail(member.displayAvatarURL()).addFields(
        { name: "Account Age", value: `${Math.floor((Date.now() - member.user.createdTimestamp) / 864e5)} days`, inline: true },
        { name: "Member Count", value: `${message.guild.memberCount}`, inline: true }
      ).setTimestamp();
      if (cfg.welcome_banner) embed.setImage(cfg.welcome_banner);
      await message.channel.send({ embeds: [embed] });
      return true;
    }
    case "setmodlog": {
      if (!isAdminUser) return false;
      const chId = args[0]?.replace(/[<#>]/g, "");
      if (!chId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$setmodlog #channel")] });
        return true;
      }
      updateGuildConfig(guildId, { mod_log_channel: chId });
      await message.reply({ embeds: [successEmbed("Mod Log Set", `<#${chId}> set as mod log channel.`)] });
      return true;
    }
    case "setstaffrole": {
      if (!isAdminUser) return false;
      const roleId = args[0]?.replace(/[<@&>]/g, "");
      if (!roleId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$setstaffrole @role")] });
        return true;
      }
      const roles = [...config.staff_roles || []];
      if (!roles.includes(roleId)) roles.push(roleId);
      updateGuildConfig(guildId, { staff_roles: roles });
      await message.reply({ embeds: [successEmbed("Staff Role Added", `<@&${roleId}> added as staff.`)] });
      return true;
    }
    case "setsupportrole": {
      if (!isAdminUser) return false;
      const roleId = args[0]?.replace(/[<@&>]/g, "");
      if (!roleId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$setsupportrole @role")] });
        return true;
      }
      updateGuildConfig(guildId, { support_role: roleId });
      await message.reply({ embeds: [successEmbed("Support Role Set", `<@&${roleId}> set as support role.`)] });
      return true;
    }
    case "setroletier": {
      if (!isAdminUser) return false;
      const roleIds = args.map((a) => a.replace(/[<@&>]/g, ""));
      if (roleIds.length === 0) {
        await message.reply({ embeds: [errorEmbed("Usage", "$setroletier @role1 @role2 @role3 (lowest to highest)")] });
        return true;
      }
      updateGuildConfig(guildId, { role_hierarchy: roleIds });
      const roleList = roleIds.map((r, i) => `${i + 1}. <@&${r}>`).join("\n");
      await message.reply({ embeds: [successEmbed("Role Hierarchy Set", roleList)] });
      return true;
    }
    case "embed":
    case "panel":
    case "builder": {
      if (!isAdminUser) return false;
      await message.reply({ embeds: [infoEmbed("Embed Builder", "Please answer the following prompts (type `skip` to skip any field):\n\n**Title:**")] });
      const collected = await collectEmbedData(message);
      if (!collected) return true;
      const embed = buildCustomEmbed(collected);
      const buttons = collected.buttons;
      if (buttons && buttons.length > 0) {
        const row = buildButtonRow(buttons);
        await message.channel.send({ embeds: [embed], components: [row] });
      } else {
        await message.channel.send({ embeds: [embed] });
      }
      return true;
    }
    case "createcmd": {
      if (!isAdminUser) return false;
      const cmdName = args[0]?.toLowerCase();
      if (!cmdName) {
        await message.reply({ embeds: [errorEmbed("Usage", "$createcmd <commandname>")] });
        return true;
      }
      await message.reply({ embeds: [infoEmbed("Create Command", `Creating command **$${cmdName}**\n\nAnswer the following prompts (type \`skip\` to skip):\n\n**Title:**`)] });
      const collected = await collectEmbedData(message);
      if (!collected) return true;
      saveCustomCommand(guildId, cmdName, collected);
      await message.channel.send({ embeds: [successEmbed("Command Created", `Custom command **$${cmdName}** has been created!`)] });
      return true;
    }
    case "autovouch": {
      if (!isAdminUser) return false;
      updateGuildConfig(guildId, { auto_vouch_enabled: 1 });
      await message.reply({ embeds: [successEmbed("Auto Vouch Enabled", "Auto vouch system is now active.")] });
      return true;
    }
    case "autovouchstop": {
      if (!isAdminUser) return false;
      updateGuildConfig(guildId, { auto_vouch_enabled: 0 });
      await message.reply({ embeds: [successEmbed("Auto Vouch Disabled", "Auto vouch system stopped.")] });
      return true;
    }
    case "autovouchchannel": {
      if (!isAdminUser) return false;
      const chId = args[0]?.replace(/[<#>]/g, "");
      if (!chId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$autovouchchannel #channel")] });
        return true;
      }
      updateGuildConfig(guildId, { auto_vouch_channel: chId });
      await message.reply({ embeds: [successEmbed("Auto Vouch Channel Set", `<#${chId}> set.`)] });
      return true;
    }
    case "autovouchusers": {
      if (!isAdminUser) return false;
      const userIds = args.map((a) => a.replace(/[<@!>]/g, "")).filter(Boolean);
      if (userIds.length === 0) {
        await message.reply({ embeds: [errorEmbed("Usage", "$autovouchusers @user1 @user2")] });
        return true;
      }
      const current = config.auto_vouch_users || [];
      const merged = [...new Set([...current, ...userIds])];
      updateGuildConfig(guildId, { auto_vouch_users: merged });
      await message.reply({ embeds: [successEmbed("Auto Vouch Users Added", `Added ${userIds.length} user(s) to auto vouch pool.`)] });
      return true;
    }
    case "autovouchremove": {
      if (!isAdminUser) return false;
      const userId = args[0]?.replace(/[<@!>]/g, "");
      if (!userId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$autovouchremove @user")] });
        return true;
      }
      const current = config.auto_vouch_users || [];
      const filtered = current.filter((u) => u !== userId);
      updateGuildConfig(guildId, { auto_vouch_users: filtered });
      await message.reply({ embeds: [successEmbed("User Removed", `<@${userId}> removed from auto vouch pool.`)] });
      return true;
    }
    case "autovouchtarget": {
      if (!isAdminUser) return false;
      const newIds = args.map((a) => a.replace(/[<@!>]/g, "")).filter(Boolean);
      if (newIds.length === 0) {
        await message.reply({ embeds: [errorEmbed("Usage", "$autovouchtarget @user1 @user2 ...")] });
        return true;
      }
      const current = config.auto_vouch_targets || [];
      const merged = [...new Set([...current, ...newIds])];
      updateGuildConfig(guildId, { auto_vouch_target: JSON.stringify(merged) });
      await message.reply({ embeds: [successEmbed("Auto Vouch Targets Updated", `Added: ${newIds.map((id) => `<@${id}>`).join(", ")}\n**Total targets:** ${merged.length}`)] });
      return true;
    }
    case "autovouchtargetremove": {
      if (!isAdminUser) return false;
      const removeId = args[0]?.replace(/[<@!>]/g, "");
      if (!removeId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$autovouchtargetremove @user")] });
        return true;
      }
      const filtered = (config.auto_vouch_targets || []).filter((id) => id !== removeId);
      updateGuildConfig(guildId, { auto_vouch_target: JSON.stringify(filtered) });
      await message.reply({ embeds: [successEmbed("Target Removed", `<@${removeId}> removed from auto vouch targets.\n**Remaining:** ${filtered.length}`)] });
      return true;
    }
    case "vtlist": {
      if (!isAdminUser) return false;
      const targets = config.auto_vouch_targets || [];
      const desc = targets.length ? targets.map((id, i) => `**${i + 1}.** <@${id}> (${id})`).join("\n") : "No targets set. Use `$autovouchtarget @user` to add one.";
      await message.reply({ embeds: [new EmbedBuilder2().setColor(5793266).setTitle("\u2B50 Auto Vouch Target List").setDescription(desc)] });
      return true;
    }
    case "autovouchinterval": {
      if (!isAdminUser) return false;
      const seconds = parseInt(args[0]);
      if (isNaN(seconds) || seconds < 1) {
        await message.reply({ embeds: [errorEmbed("Usage", "$autovouchinterval <seconds>\nExample: `$autovouchinterval 10` for every 10 seconds")] });
        return true;
      }
      updateGuildConfig(guildId, { auto_vouch_interval: seconds * 1e3 });
      await message.reply({ embeds: [successEmbed("Interval Updated", `Auto vouch will now fire every **${seconds} second${seconds === 1 ? "" : "s"}**.`)] });
      return true;
    }
    case "dmall": {
      if (!isAdminUser) return false;
      await message.reply({ embeds: [infoEmbed("Mass DM", "What message should be sent to all members?")] });
      const filter = (m) => m.author.id === message.author.id;
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 6e4 }).catch(() => null);
      if (!collected || collected.size === 0) {
        await message.channel.send({ embeds: [errorEmbed("Timed Out", "No message received.")] });
        return true;
      }
      const dmMessage = collected.first().content;
      const members = await message.guild.members.fetch();
      const humanMembers = members.filter((m) => !m.user.bot);
      const statusMsg = await message.channel.send({ embeds: [infoEmbed("Mass DM", `Sending to ${humanMembers.size} members...`)] });
      let sent = 0, failed = 0;
      for (const [, m] of humanMembers) {
        try {
          await m.send(dmMessage);
          sent++;
        } catch {
          failed++;
        }
        if (sent % 10 === 0) {
          await statusMsg.edit({ embeds: [infoEmbed("Mass DM Progress", `Sent: ${sent} | Failed: ${failed} | Remaining: ${humanMembers.size - sent - failed}`)] }).catch(() => {});
        }
        await new Promise((r) => setTimeout(r, 1e3));
      }
      await statusMsg.edit({ embeds: [successEmbed("Mass DM Complete", `Sent: ${sent} | Failed: ${failed}`)] }).catch(() => {});
      return true;
    }
    case "antispam": {
      if (!isAdminUser) return false;
      const val = args[0] === "on" ? 1 : 0;
      updateGuildConfig(guildId, { anti_spam: val });
      await message.reply({ embeds: [successEmbed("Anti Spam", `Anti spam ${val ? "enabled" : "disabled"}.`)] });
      return true;
    }
    case "antilink": {
      if (!isAdminUser) return false;
      const val = args[0] === "on" ? 1 : 0;
      updateGuildConfig(guildId, { anti_link: val });
      await message.reply({ embeds: [successEmbed("Anti Link", `Anti link ${val ? "enabled" : "disabled"}.`)] });
      return true;
    }
    default:
      return false;
  }
}
async function collectEmbedData(message) {
  const filter = (m) => m.author.id === message.author.id;
  const channel = message.channel;
  async function prompt(question) {
    await channel.send({ embeds: [{ color: 5793266, description: question }] });
    const r = await channel.awaitMessages({ filter, max: 1, time: 6e4 }).catch(() => null);
    if (!r || r.size === 0) return null;
    const content = r.first().content;
    return content.toLowerCase() === "skip" ? null : content;
  }
  const title = await prompt("**Title** (or type `skip`):");
  const description = await prompt("**Description** (or type `skip`):");
  const color = await prompt("**Color** (hex, e.g. #FF0000, or type `skip`):");
  const image = await prompt("**Image URL** (or type `skip`):");
  const thumbnail = await prompt("**Thumbnail URL** (or type `skip`):");
  const footer = await prompt("**Footer text** (or type `skip`):");
  const btnCountStr = await prompt("**How many buttons?** (0-5):");
  const btnCount = Math.min(5, Math.max(0, parseInt(btnCountStr || "0", 10) || 0));
  const buttons = [];
  for (let i = 0; i < btnCount; i++) {
    const label = await prompt(`**Button ${i + 1} Label:**`);
    if (!label) break;
    const actionType = await prompt(`**Button ${i + 1} Action:** (giverole/removerole/togglerole/url/message/ticket)`);
    let customId = `cc_msg_${label}`;
    let url;
    let style = "primary";
    if (actionType === "giverole") {
      const roleStr = await prompt("Role ID or mention:");
      const roleId = roleStr?.replace(/[<@&>]/g, "");
      customId = `cc_role_give_${roleId}`;
      style = "success";
    } else if (actionType === "removerole") {
      const roleStr = await prompt("Role ID or mention:");
      const roleId = roleStr?.replace(/[<@&>]/g, "");
      customId = `cc_role_remove_${roleId}`;
      style = "danger";
    } else if (actionType === "togglerole") {
      const roleStr = await prompt("Role ID or mention:");
      const roleId = roleStr?.replace(/[<@&>]/g, "");
      customId = `cc_role_toggle_${roleId}`;
      style = "secondary";
    } else if (actionType === "url") {
      url = await prompt("Enter URL:") || void 0;
      style = "link";
    } else if (actionType === "message") {
      const msg = await prompt("Message to send:");
      customId = `cc_msg_${(msg || label).replace(/\s+/g, "_").slice(0, 50)}`;
    } else if (actionType === "ticket") {
      customId = "ticket_open";
      style = "primary";
    }
    buttons.push({ label, customId, url, style });
  }
  return { title, description, color: color || "#5865F2", image, thumbnail, footer, buttons };
}
async function showAdminHelp(message) {
  const embed = new EmbedBuilder2().setColor(5793266).setTitle("\u{1F4D6} Full Command List (Admin)").addFields(
    {
      name: "\u{1F6E1}\uFE0F Bot Admin Management",
      value: "`$add_admin @user` \u2014 Grant bot admin access\n`$remove_admin @user` \u2014 Revoke bot admin access\n`$list_admins` \u2014 List all bot admins"
    },
    {
      name: "\u{1F3AB} Ticket System",
      value: "`$ticketpanel` `$setticket <field> <val>`\n`$close` `$claim` `$rename <name>`\n`$transfer @user` `$add @user` `$remove @user`\n`$transcript` `$closetickets`"
    },
    {
      name: "\u2B50 Auto Vouch",
      value: "`$autovouch` `$autovouchstop`\n`$autovouchchannel #ch`\n`$autovouchtarget @u1 @u2` `$autovouchtargetremove @u`\n`$vtlist` `$autovouchinterval <secs>`\n`$autovouchusers @u` `$autovouchremove @u`\n`$addcf <msg>` `$removecf <id>` `$cflist`"
    },
    {
      name: "\u{1F3A8} Embed Builder",
      value: "`$embed` `$panel` `$builder`\n`$createcmd <name>`"
    },
    {
      name: "\u{1F44B} Welcome",
      value: "`$setwelcome <field> <value>` `$welcometest`"
    },
    {
      name: "\u{1F528} Moderation",
      value: "`$ban @user [reason]` `$kick @user [reason]`\n`$mute @user [mins] [reason]`\n`$warn @user [reason]` `$warnings @user`\n`$lock` `$unlock` `$purge <amount>`"
    },
    {
      name: "\u{1F451} Roles",
      value: "`$promote @user` `$demote @user`\n`$fill @user` `$setroletier @r1 @r2 @r3`\n`$setstaffrole @role`"
    },
    {
      name: "\u{1F4E8} Mass DM",
      value: "`$dmall` \u2014 Send a DM to all server members"
    },
    {
      name: "\u2699\uFE0F Setup",
      value: "`$setmodlog #channel` `$setsupportrole @role`\n`$antispam on/off` `$antilink on/off`"
    },
    {
      name: "\u{1F4BC} Middleman",
      value: "`$mmfee [amount]` `$mminfo` `$mminfo setimage <url>`\n`$safety` `$blunderbluss` `$confirm` `$close` `$claim`\n`$w @user` `$userinfo @user` `$serverinfo`\n`$vouches @user` `$vouchlb` `$setvouches @user <n>`\n`$roleinfo @role`"
    },
    {
      name: "\u{1F3AE} Fun",
      value: "`$rps` `$ttt` `$cf` `$roll` `$8ball`\n`$guess` `$meme` `$dadjoke` `$ship` `$rate`"
    }
  ).setFooter({ text: "Admin view \u2014 full access | $add_admin @user to grant access" }).setTimestamp();
  await message.reply({ embeds: [embed] });
}

// src/commands/middleman/index.ts
import {
  EmbedBuilder as EmbedBuilder3,
  ActionRowBuilder as ActionRowBuilder3,
  ButtonBuilder as ButtonBuilder3,
  ButtonStyle as ButtonStyle3
} from "discord.js";
async function handleMiddlemanCommands(message, command, args, config, isAdminUser) {
  const guildId = message.guild.id;
  switch (command) {
    case "mmfee": {
      if (!isAdminUser) return false;
      if (args.length > 0) {
        updateGuildConfig(guildId, { mm_fee: args.join(" ") });
        await message.reply({ embeds: [successEmbed("MM Fee Updated", `Fee set to: **${args.join(" ")}**`)] });
        return true;
      }
      const feeEmbed = new EmbedBuilder3()
        .setColor(5793266)
        .setTitle("1  __Middleman Fee Agreement__ \u{1F4CC}")
        .setDescription(
          "\u2022 Choose an option on how the Middleman fees will be paid \u{1FA99}\n\n" +
          "\u2022 50/50 \u2705 Both parties spilt fees equally \u{1F99D}\n\n" +
          "\u2022 100% \u{1FA99} one party pays the full fees\n\n" +
          "\u2022 **__Click below and choose an option__**"
        );
      const feeRow = new ActionRowBuilder3().addComponents(
        new ButtonBuilder3().setCustomId("mmfee_5050").setLabel("50/50").setStyle(ButtonStyle3.Success).setEmoji("\u{1F451}"),
        new ButtonBuilder3().setCustomId("mmfee_100").setLabel("100%").setStyle(ButtonStyle3.Danger).setEmoji("\u{1FA99}")
      );
      await message.channel.send({ embeds: [feeEmbed], components: [feeRow] });
      await message.delete().catch(() => {});
      return true;
    }
    case "mminfo": {
      if (args[0] === "setimage" && isAdminUser) {
        const url = args.slice(1).join(" ").trim();
        updateGuildConfig(guildId, { mm_image: url || null });
        await message.reply({ embeds: [successEmbed("MM Image Updated", url ? `Image set to: ${url}` : "Image cleared.")] });
        return true;
      }
      const desc = [
        "**__1\u2002\u2002Advanced Middleman (MM) Guide__ \u{1F4B5}**\n",
        "\u2022 Safe & Secure Trading System \u{1F511}\n",
        "\u2022 A middleman (MM) is a trusted third party who holds items or payments during a trade to ensure no one gets scammed. \u2705\n",
        "**__2\u2002\u2002Step-by-Step Process__ \u{1F3A5}**\n",
        "\u2022 Step 1 \u2014 Deal Agreement \u{1F4B5}",
        "\u2022 Both users clearly agree on the trade terms.\nUse `/confirm` or `$confirm` to lock the deal. \u{1F4CB}\n",
        "\u2022 Step 2 \u2014 Seller Sends Item \u{1F512}",
        "\u2022 The seller gives the item/account to the middleman. Item is securely held. \u{1F7E1}\n",
        "\u2022 Step 3 \u2014 Buyer Sends Payment \u{1F4B5}",
        "\u2022 The buyer sends payment after item is secured. \u{1F4B5}\n",
        "\u2022 Step 4 \u2014 Verification \u{1F3A9}",
        "\u2022 Middleman verifies:\n\u2022 Item is correct\n\u2022 Payment is received\n",
        "\u2022 Step 5 \u2014 Final Transfer \u2705",
        "\u2022 Item is delivered to the buyer safely. \u{1F919}\n",
        "**__3\u2002\u2002Why Use a Middleman?__**\n",
        "\u2022 Prevents scams\n\u2022 No need to \u201Cgo first\u201D\n\u2022 Safe for both buyer & seller\n\u2022 Trusted system with proof & logs\n",
        "\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014\u2014"
      ].join("\n");
      const embed = new EmbedBuilder3().setColor(58998).setDescription(desc);
      if (config.mm_image) embed.setImage(config.mm_image);
      const row = new ActionRowBuilder3().addComponents(
        new ButtonBuilder3().setCustomId("mminfo_understood").setLabel("Understood").setStyle(ButtonStyle3.Success).setEmoji("\u2705"),
        new ButtonBuilder3().setCustomId("mminfo_not_understood").setLabel("Not Understood").setStyle(ButtonStyle3.Danger).setEmoji("\u2753")
      );
      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete().catch(() => {});
      return true;
    }
    case "safety": {
      if (!isAdminUser) return false;
      const safetyEmbed = new EmbedBuilder3()
        .setColor(5793266)
        .setDescription(
          "\u{1F504} **__Refund & Anti-Scam Policy__**\n\n" +
          "\u2022 If one party fails to complete their side of the trade, the middleman will securely refund the item or payment to the rightful owner.\n\n" +
          "\u26A0\uFE0F **__Important:__**\n\n" +
          "\u2022 Any attempt to scam, deceive, or abandon a trade may result in \u{1F504}\n\n" +
          "\u2022 \ud83d\udd12 Immediate blacklist from middleman services\n" +
          "\u2022 \ud83e\udd16 Permanent ban from the server\n" +
          "\u2022 \ud83c\uddec\ud83c\uddf1 Loss of trust & recorded reports against your account\n\n" +
          "**__Our system ensures:__**\n\n" +
          "\u2022 No one loses items unfairly\n" +
          "\u2022 Trades remain fully protected\n" +
          "\u2022 Scammers are dealt with strictly"
        );
      await message.channel.send({ embeds: [safetyEmbed] });
      await message.delete().catch(() => {});
      return true;
    }
    case "confirm": {
      const confirmEmbed = new EmbedBuilder3().setColor(5763719).setDescription(
        "**__Trade Confirmation__** \u2705\n\n\u2022 Do both traders agree to proceed with this trade?\n\u2022 By clicking **Confirm** you agree to the terms of this deal.\n\u2022 If you wish to cancel, click **Decline**.\n\n**__Click below to confirm or decline__**"
      );
      const confirmRow = new ActionRowBuilder3().addComponents(
        new ButtonBuilder3().setCustomId("confirm_trade").setLabel("Confirm").setStyle(ButtonStyle3.Success).setEmoji("\u2705"),
        new ButtonBuilder3().setCustomId("decline_trade").setLabel("Decline").setStyle(ButtonStyle3.Danger).setEmoji("\u274C")
      );
      await message.channel.send({ embeds: [confirmEmbed], components: [confirmRow] });
      await message.delete().catch(() => {});
      return true;
    }
    case "blunderbluss": {
      const embed = new EmbedBuilder3().setColor(5793266).setTitle("\u{1F52B} Blunderbluss").setDescription(
        "Do you want to become a **Hitter**?\n\nClick **Accept** to receive the Hitter role and gain access to exclusive channels!"
      ).setTimestamp();
      const row = new ActionRowBuilder3().addComponents(
        new ButtonBuilder3().setCustomId("blunderbluss_accept").setLabel("Accept").setStyle(ButtonStyle3.Success).setEmoji("\u2705")
      );
      await message.channel.send({ embeds: [embed], components: [row] });
      await message.delete().catch(() => {});
      return true;
    }
    case "close": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) return false;
      if (!isStaff(message.member, guildId) && ticket.user_id !== message.author.id) {
        await message.reply({ embeds: [errorEmbed("No Permission", "Only staff or the ticket creator can close this ticket.")] });
        return true;
      }
      await message.channel.send({ embeds: [successEmbed("Closing Ticket", "This ticket will be closed in 5 seconds...")] });
      if (config.ticket_transcript_channel) {
        await sendTranscript(message.guild, config.ticket_transcript_channel, message.channel.id, ticket.user_id);
      }
      updateTicket(message.channel.id, { status: "closed", closed_at: Math.floor(Date.now() / 1e3) });
      setTimeout(async () => {
        try {
          await message.channel.delete();
        } catch {}
      }, 5e3);
      return true;
    }
    case "claim": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) return false;
      if (!isStaff(message.member, guildId)) {
        await message.reply({ embeds: [errorEmbed("No Permission", "Only staff can claim tickets.")] });
        return true;
      }
      if (ticket.claimed_by) {
        await message.reply({ embeds: [errorEmbed("Already Claimed", `Claimed by <@${ticket.claimed_by}>`)] });
        return true;
      }
      updateTicket(message.channel.id, { claimed_by: message.author.id });
      await message.channel.permissionOverwrites.set([
        { id: message.guild.id, deny: ["ViewChannel"] },
        { id: ticket.user_id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
        { id: message.author.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"] }
      ]);
      await message.channel.send({ embeds: [successEmbed("Ticket Claimed", `${message.author} has claimed this ticket. Channel is now private.`)] });
      return true;
    }
    case "rename": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) return false;
      const newName = args.join("-").toLowerCase().replace(/[^a-z0-9-]/g, "-");
      if (!newName) {
        await message.reply({ embeds: [errorEmbed("Usage", "$rename <new-name>")] });
        return true;
      }
      if (!isStaff(message.member, guildId) && ticket.user_id !== message.author.id) {
        await message.reply({ embeds: [errorEmbed("No Permission", "Only staff or ticket creator can rename.")] });
        return true;
      }
      await message.channel.setName(newName);
      await message.channel.send({ embeds: [successEmbed("Ticket Renamed", `Channel renamed to **${newName}**`)] });
      return true;
    }
    case "transfer": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) return false;
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$transfer @user")] });
        return true;
      }
      if (!isStaff(message.member, guildId)) {
        await message.reply({ embeds: [errorEmbed("No Permission", "Only staff can transfer tickets.")] });
        return true;
      }
      updateTicket(message.channel.id, { claimed_by: targetId });
      await message.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await message.channel.send({ embeds: [successEmbed("Ticket Transferred", `Ticket transferred to <@${targetId}>`)] });
      return true;
    }
    case "sadd":
    case "add": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) return false;
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$add @user")] });
        return true;
      }
      await message.channel.permissionOverwrites.edit(targetId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true });
      await message.channel.send({ embeds: [successEmbed("User Added", `<@${targetId}> has been added to the ticket.`)] });
      return true;
    }
    case "sremove":
    case "remove": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) return false;
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$remove @user")] });
        return true;
      }
      await message.channel.permissionOverwrites.delete(targetId);
      await message.channel.send({ embeds: [successEmbed("User Removed", `<@${targetId}> has been removed from the ticket.`)] });
      return true;
    }
    case "transcript": {
      const ticket = getTicket(message.channel.id);
      if (!ticket) {
        await message.reply({ embeds: [errorEmbed("Not a Ticket", "This is not a ticket channel.")] });
        return true;
      }
      if (!isStaff(message.member, guildId)) {
        await message.reply({ embeds: [errorEmbed("No Permission", "Only staff can generate transcripts.")] });
        return true;
      }
      if (!config.ticket_transcript_channel) {
        await message.reply({ embeds: [errorEmbed("No Transcript Channel", "Set one with $setticket transcriptchannel #channel")] });
        return true;
      }
      await sendTranscript(message.guild, config.ticket_transcript_channel, message.channel.id, ticket.user_id);
      await message.reply({ embeds: [successEmbed("Transcript Sent", `Transcript sent to <#${config.ticket_transcript_channel}>`)] });
      return true;
    }
    case "closetickets": {
      if (!isAdminUser) return false;
      const openTickets = db.prepare("SELECT channel_id FROM tickets WHERE guild_id = ? AND status = 'open'").all(guildId);
      await message.reply({ embeds: [infoEmbed("Closing Tickets", `Closing ${openTickets.length} open tickets...`)] });
      for (const t of openTickets) {
        try {
          if (config.ticket_transcript_channel) await sendTranscript(message.guild, config.ticket_transcript_channel, t.channel_id, "");
          updateTicket(t.channel_id, { status: "closed" });
          const ch = message.guild.channels.cache.get(t.channel_id);
          if (ch) await ch.delete().catch(() => {});
        } catch {}
      }
      return true;
    }
    case "w":
    case "userinfo": {
      const targetId = args[0]?.replace(/[<@!>]/g, "") || message.author.id;
      try {
        const member = await message.guild.members.fetch(targetId);
        const vouches = getVouches(guildId, targetId);
        const roles = member.roles.cache.filter((r) => r.id !== message.guild.id).sort((a, b) => b.position - a.position).map((r) => `<@&${r.id}>`).slice(0, 10).join(", ") || "None";
        const embed = new EmbedBuilder3().setColor(5793266).setTitle(`\u{1F464} ${member.user.tag}`).setThumbnail(member.displayAvatarURL({ size: 256 })).addFields(
          { name: "Username", value: member.user.username, inline: true },
          { name: "User ID", value: member.user.id, inline: true },
          { name: "Nickname", value: member.nickname || "None", inline: true },
          { name: "Account Created", value: accountAge(member.user.createdAt), inline: true },
          { name: "Joined Server", value: accountAge(member.joinedAt || new Date()), inline: true },
          { name: "Vouches", value: `\u2B50 ${vouches}`, inline: true },
          { name: "Roles", value: roles },
          { name: "Bot?", value: member.user.bot ? "Yes" : "No", inline: true },
          { name: "Boosting?", value: member.premiumSince ? "Yes" : "No", inline: true }
        ).setTimestamp();
        await message.reply({ embeds: [embed] });
      } catch {
        await message.reply({ embeds: [errorEmbed("User Not Found", "Could not find that user.")] });
      }
      return true;
    }
    case "serverinfo": {
      const guild = message.guild;
      const embed = new EmbedBuilder3().setColor(5793266).setTitle(`\u{1F3E0} ${guild.name}`).setThumbnail(guild.iconURL() || "").addFields(
        { name: "Server ID", value: guild.id, inline: true },
        { name: "Owner", value: `<@${guild.ownerId}>`, inline: true },
        { name: "Members", value: `${guild.memberCount}`, inline: true },
        { name: "Channels", value: `${guild.channels.cache.size}`, inline: true },
        { name: "Roles", value: `${guild.roles.cache.size}`, inline: true },
        { name: "Created", value: accountAge(guild.createdAt), inline: true },
        { name: "Boost Level", value: `${guild.premiumTier}`, inline: true },
        { name: "Boosts", value: `${guild.premiumSubscriptionCount || 0}`, inline: true }
      ).setTimestamp();
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "vouches": {
      const targetId = args[0]?.replace(/[<@!>]/g, "") || message.author.id;
      const count = getVouches(guildId, targetId);
      const embed = new EmbedBuilder3().setColor(16705372).setTitle("\u2B50 Vouches").setDescription(`<@${targetId}> has **${count}** vouches`).setTimestamp();
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "vouchlb": {
      const lb = getVouchLeaderboard(guildId);
      const lines = lb.map((e, i) => `**${i + 1}.** <@${e.user_id}> \u2014 \u2B50 ${e.count}`).join("\n") || "No vouches yet.";
      const embed = new EmbedBuilder3().setColor(16705372).setTitle("\u2B50 Vouch Leaderboard").setDescription(lines).setTimestamp();
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "setvouches": {
      if (!isAdminUser) {
        await message.reply({ embeds: [errorEmbed("No Permission", "Only admins can set vouches.")] });
        return true;
      }
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      const amount = parseInt(args[1]);
      if (!targetId || isNaN(amount) || amount < 0) {
        await message.reply({ embeds: [errorEmbed("Usage", "$setvouches @user <amount>")] });
        return true;
      }
      setVouches(guildId, targetId, amount);
      const embed = new EmbedBuilder3().setColor(16705372).setTitle("\u2B50 Vouches Set").setDescription(`<@${targetId}>'s vouches have been set to **${amount}**.`).setTimestamp();
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "addcf": {
      if (!isAdminUser) return false;
      const msg = args.join(" ").trim();
      if (!msg) {
        await message.reply({ embeds: [errorEmbed("Usage", "$addcf <feedback message>")] });
        return true;
      }
      addClientFeedback(guildId, msg);
      await message.reply({ embeds: [successEmbed("Feedback Added", `\u201C${msg}\u201D has been added to the client feedback pool.`)] });
      return true;
    }
    case "cflist": {
      if (!isAdminUser) return false;
      const feedbacks = getClientFeedback(guildId);
      const desc = feedbacks.length
        ? feedbacks.map((f) => `**#${f.id}** \u2014 ${f.message}`).join("\n")
        : "No feedback messages yet. Use `$addcf <message>` to add one.";
      await message.reply({ embeds: [new EmbedBuilder3().setColor(5793266).setTitle("\u{1F4AC} Client Feedback Pool").setDescription(desc)] });
      return true;
    }
    case "removecf": {
      if (!isAdminUser) return false;
      const id = parseInt(args[0]);
      if (isNaN(id)) {
        await message.reply({ embeds: [errorEmbed("Usage", "$removecf <id> — use $cflist to see IDs")] });
        return true;
      }
      removeClientFeedback(guildId, id);
      await message.reply({ embeds: [successEmbed("Feedback Removed", `Entry #${id} has been removed.`)] });
      return true;
    }
    case "roleinfo": {
      const roleId = args[0]?.replace(/[<@&>]/g, "");
      if (!roleId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$roleinfo @role")] });
        return true;
      }
      const role = message.guild.roles.cache.get(roleId);
      if (!role) {
        await message.reply({ embeds: [errorEmbed("Not Found", "Role not found.")] });
        return true;
      }
      const embed = new EmbedBuilder3().setColor(role.color || 5793266).setTitle(`\u{1F3AD} ${role.name}`).addFields(
        { name: "Role ID", value: role.id, inline: true },
        { name: "Color", value: role.hexColor, inline: true },
        { name: "Mentionable", value: role.mentionable ? "Yes" : "No", inline: true },
        { name: "Hoisted", value: role.hoist ? "Yes" : "No", inline: true },
        { name: "Position", value: `${role.position}`, inline: true },
        { name: "Members", value: `${role.members.size}`, inline: true },
        { name: "Created", value: accountAge(role.createdAt), inline: true }
      ).setTimestamp();
      await message.reply({ embeds: [embed] });
      return true;
    }
    default:
      return false;
  }
}

// src/commands/fun/index.ts
import { EmbedBuilder as EmbedBuilder4 } from "discord.js";
var eightBallResponses = [
  "It is certain.",
  "It is decidedly so.",
  "Without a doubt.",
  "Yes, definitely.",
  "You may rely on it.",
  "As I see it, yes.",
  "Most likely.",
  "Outlook good.",
  "Yes.",
  "Signs point to yes.",
  "Reply hazy, try again.",
  "Ask again later.",
  "Better not tell you now.",
  "Cannot predict now.",
  "Concentrate and ask again.",
  "Don't count on it.",
  "My reply is no.",
  "My sources say no.",
  "Outlook not so good.",
  "Very doubtful."
];
var shipMessages = [
  "Absolute soulmates! \u{1F495}",
  "A perfect match made in heaven! \u{1F496}",
  "They vibe hard! \u{1F525}",
  "Pretty good chemistry! \u{1F4AB}",
  "Could work with some effort! \u{1F914}",
  "It's complicated... \u{1F605}",
  "Friends is the better option \u{1F62C}",
  "Hard no. \u{1F480}"
];
async function handleFunCommands(message, command, args, _config) {
  switch (command) {
    case "rps": {
      const choices = ["rock", "paper", "scissors"];
      const userChoice = args[0]?.toLowerCase();
      if (!choices.includes(userChoice)) {
        await message.reply({ embeds: [{ color: 15548997, description: "Usage: `$rps rock|paper|scissors`" }] });
        return true;
      }
      const botChoice = choices[Math.floor(Math.random() * 3)];
      let result = "It's a tie!";
      if (userChoice === "rock" && botChoice === "scissors" || userChoice === "paper" && botChoice === "rock" || userChoice === "scissors" && botChoice === "paper") result = "You win! \u{1F389}";
      else if (userChoice !== botChoice) result = "I win! \u{1F60E}";
      const emojis = { rock: "\u{1FAA8}", paper: "\u{1F4C4}", scissors: "\u2702\uFE0F" };
      const embed = new EmbedBuilder4().setColor(5793266).setTitle("\u{1FAA8}\u{1F4C4}\u2702\uFE0F Rock Paper Scissors").addFields(
        { name: "Your choice", value: `${emojis[userChoice]} ${userChoice}`, inline: true },
        { name: "My choice", value: `${emojis[botChoice]} ${botChoice}`, inline: true },
        { name: "Result", value: result }
      );
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "cf": {
      const result = Math.random() < 0.5 ? "Heads \u{1FA99}" : "Tails \u{1FA99}";
      const embed = new EmbedBuilder4().setColor(16705372).setTitle("\u{1FA99} Coin Flip").setDescription(`The coin landed on: **${result}**`);
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "roll": {
      const max = parseInt(args[0]) || 100;
      const result = Math.floor(Math.random() * max) + 1;
      const embed = new EmbedBuilder4().setColor(5763719).setTitle("\u{1F3B2} Dice Roll").setDescription(`You rolled: **${result}** (1-${max})`);
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "8ball": {
      const question = args.join(" ");
      if (!question) {
        await message.reply("Please ask a question!");
        return true;
      }
      const response = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];
      const embed = new EmbedBuilder4().setColor(5793266).setTitle("\u{1F3B1} Magic 8-Ball").addFields(
        { name: "Question", value: question },
        { name: "Answer", value: response }
      );
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "guess": {
      const secret = Math.floor(Math.random() * 10) + 1;
      const embed = new EmbedBuilder4().setColor(5793266).setTitle("\u{1F522} Guess the Number").setDescription("I'm thinking of a number between **1 and 10**. You have 3 tries!");
      await message.channel.send({ embeds: [embed] });
      const filter = (m) => m.author.id === message.author.id && !isNaN(parseInt(m.content));
      let tries = 3;
      while (tries > 0) {
        const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15e3 }).catch(() => null);
        if (!collected || collected.size === 0) {
          await message.channel.send(`Time's up! The number was **${secret}**`);
          break;
        }
        const guess = parseInt(collected.first().content);
        tries--;
        if (guess === secret) {
          await message.channel.send({ embeds: [new EmbedBuilder4().setColor(5763719).setDescription(`\u{1F389} Correct! The number was **${secret}**!`)] });
          break;
        } else if (tries === 0) {
          await message.channel.send(`\u274C Out of tries! The number was **${secret}**`);
        } else {
          await message.channel.send(`${guess < secret ? "\u{1F4C8} Too low!" : "\u{1F4C9} Too high!"} \u2014 **${tries}** ${tries === 1 ? "try" : "tries"} left`);
        }
      }
      return true;
    }
    case "ttt": {
      const board = Array(9).fill("\u2B1C");
      const symbols = ["\u274C", "\u2B55"];
      let current = 0;
      const players = [message.author.id, args[0]?.replace(/[<@!>]/g, "") || "bot"];
      const wins = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
      function renderBoard() {
        return board.slice(0, 3).join("") + "\n" + board.slice(3, 6).join("") + "\n" + board.slice(6, 9).join("");
      }
      function checkWin(sym) {
        return wins.some(([a, b, c]) => board[a] === sym && board[b] === sym && board[c] === sym);
      }
      const msg = await message.channel.send({
        embeds: [new EmbedBuilder4().setColor(5793266).setTitle("\u274C\u2B55 Tic Tac Toe").setDescription(renderBoard() + `\n\n<@${players[current]}>'s turn (${symbols[current]})`)]
      });
      for (let move = 0; move < 9; move++) {
        const isBot = players[current] === "bot";
        let pos;
        if (isBot) {
          const empty = board.map((v, i) => v === "\u2B1C" ? i : -1).filter((i) => i !== -1);
          pos = empty[Math.floor(Math.random() * empty.length)];
          await new Promise((r) => setTimeout(r, 1e3));
        } else {
          const col = await message.channel.awaitMessages({
            filter: (m) => m.author.id === players[current] && /^[1-9]$/.test(m.content) && board[parseInt(m.content) - 1] === "\u2B1C",
            max: 1,
            time: 3e4
          }).catch(() => null);
          if (!col || col.size === 0) {
            await msg.edit({ embeds: [new EmbedBuilder4().setColor(15548997).setDescription("Game timed out!")] });
            return true;
          }
          pos = parseInt(col.first().content) - 1;
          try { await col.first().delete(); } catch {}
        }
        board[pos] = symbols[current];
        if (checkWin(symbols[current])) {
          await msg.edit({ embeds: [new EmbedBuilder4().setColor(5763719).setTitle("\u274C\u2B55 Tic Tac Toe").setDescription(renderBoard() + `\n\n\u{1F389} <@${players[current]}> wins!`)] });
          return true;
        }
        current = current === 0 ? 1 : 0;
        await msg.edit({ embeds: [new EmbedBuilder4().setColor(5793266).setTitle("\u274C\u2B55 Tic Tac Toe").setDescription(renderBoard() + `\n\n<@${players[current]}>'s turn (${symbols[current]})\n*Type 1-9 to place*`)] });
      }
      await msg.edit({ embeds: [new EmbedBuilder4().setColor(16705372).setTitle("\u274C\u2B55 Tic Tac Toe").setDescription(renderBoard() + "\n\nIt's a tie!")] });
      return true;
    }
    case "meme": {
      const memes = [
        { title: "When the code works", url: "https://i.imgur.com/7EHc9Kq.gif" },
        { title: "Debugging at 3am", url: "https://i.imgur.com/8W4U3Sd.gif" },
        { title: "My code in production", url: "https://i.imgur.com/s3D5MKb.gif" }
      ];
      const meme = memes[Math.floor(Math.random() * memes.length)];
      const embed = new EmbedBuilder4().setColor(5793266).setTitle(`\u{1F602} ${meme.title}`).setImage(meme.url);
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "dadjoke": {
      const jokes = [
        "Why don't scientists trust atoms? Because they make up everything!",
        "I'm reading a book about anti-gravity. It's impossible to put down!",
        "Did you hear about the mathematician who's afraid of negative numbers? He'll stop at nothing to avoid them.",
        "Why did the scarecrow win an award? Because he was outstanding in his field!",
        "I used to hate facial hair, but then it grew on me.",
        "Why don't eggs tell jokes? They'd crack each other up.",
        "I'm on a seafood diet. I see food and I eat it."
      ];
      const joke = jokes[Math.floor(Math.random() * jokes.length)];
      const embed = new EmbedBuilder4().setColor(16705372).setTitle("\u{1F604} Dad Joke").setDescription(joke);
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "ship": {
      const u1 = args[0]?.replace(/[<@!>]/g, "") || message.author.id;
      const u2 = args[1]?.replace(/[<@!>]/g, "");
      if (!u2) {
        await message.reply("Usage: `$ship @user1 @user2`");
        return true;
      }
      const compatibility = Math.floor(Math.random() * 101);
      const msgIdx = Math.min(Math.floor((100 - compatibility) / 14), shipMessages.length - 1);
      const embed = new EmbedBuilder4().setColor(16738740).setTitle("\u{1F495} Shipometer").setDescription(`<@${u1}> \u{1F49E} <@${u2}>\n\n**${compatibility}% Compatible!**\n${shipMessages[msgIdx]}`);
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "rate": {
      const target = args.join(" ") || message.author.username;
      const rating = Math.floor(Math.random() * 11);
      const stars = "\u2B50".repeat(rating) + "\u2606".repeat(10 - rating);
      const embed = new EmbedBuilder4().setColor(16705372).setTitle("\u2B50 Rate").setDescription(`**${target}**\n${stars}\n**${rating}/10**`);
      await message.reply({ embeds: [embed] });
      return true;
    }
    default:
      return false;
  }
}

// src/commands/moderation/index.ts
import { EmbedBuilder as EmbedBuilder5 } from "discord.js";
async function logMod(message, config, action, target, reason) {
  if (!config.mod_log_channel) return;
  const ch = message.guild.channels.cache.get(config.mod_log_channel);
  if (!ch) return;
  const embed = new EmbedBuilder5().setColor(15548997).setTitle(`\u{1F528} ${action}`).addFields(
    { name: "Target", value: target, inline: true },
    { name: "Moderator", value: `${message.author}`, inline: true },
    { name: "Reason", value: reason }
  ).setTimestamp();
  await ch.send({ embeds: [embed] }).catch(() => {});
}
async function handleModerationCommands(message, command, args, config) {
  const guildId = message.guild.id;
  switch (command) {
    case "ban": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      const reason = args.slice(1).join(" ") || "No reason provided";
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$ban @user [reason]")] });
        return true;
      }
      try {
        await message.guild.members.ban(targetId, { reason });
        await message.reply({ embeds: [successEmbed("Banned", `<@${targetId}> has been banned.\n**Reason:** ${reason}`)] });
        await logMod(message, config, "Ban", `<@${targetId}>`, reason);
      } catch (e) {
        await message.reply({ embeds: [errorEmbed("Failed", "Could not ban that user.")] });
      }
      return true;
    }
    case "kick": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      const reason = args.slice(1).join(" ") || "No reason provided";
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$kick @user [reason]")] });
        return true;
      }
      try {
        const member = await message.guild.members.fetch(targetId);
        await member.kick(reason);
        await message.reply({ embeds: [successEmbed("Kicked", `<@${targetId}> has been kicked.\n**Reason:** ${reason}`)] });
        await logMod(message, config, "Kick", `<@${targetId}>`, reason);
      } catch {
        await message.reply({ embeds: [errorEmbed("Failed", "Could not kick that user.")] });
      }
      return true;
    }
    case "mute":
    case "timeout": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      const duration = parseInt(args[1]) || 10;
      const reason = args.slice(2).join(" ") || "No reason provided";
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$mute @user [minutes] [reason]")] });
        return true;
      }
      try {
        const member = await message.guild.members.fetch(targetId);
        await member.timeout(duration * 60 * 1e3, reason);
        await message.reply({ embeds: [successEmbed("Muted", `<@${targetId}> has been timed out for **${duration} minutes**.\n**Reason:** ${reason}`)] });
        await logMod(message, config, "Mute", `<@${targetId}>`, reason);
      } catch {
        await message.reply({ embeds: [errorEmbed("Failed", "Could not mute that user.")] });
      }
      return true;
    }
    case "warn": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      const reason = args.slice(1).join(" ") || "No reason provided";
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$warn @user [reason]")] });
        return true;
      }
      addWarning(guildId, targetId, message.author.id, reason);
      const warns = getWarnings(guildId, targetId);
      await message.reply({ embeds: [successEmbed("Warning Issued", `<@${targetId}> has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${warns.length}`)] });
      await logMod(message, config, "Warn", `<@${targetId}>`, reason);
      try {
        const member = await message.guild.members.fetch(targetId);
        await member.user.send(`\u26A0\uFE0F You have been warned in **${message.guild.name}**: ${reason}`).catch(() => {});
      } catch {}
      return true;
    }
    case "warnings": {
      const targetId = args[0]?.replace(/[<@!>]/g, "") || message.author.id;
      const warns = getWarnings(guildId, targetId);
      if (warns.length === 0) {
        await message.reply({ embeds: [successEmbed("No Warnings", `<@${targetId}> has no warnings.`)] });
        return true;
      }
      const list = warns.slice(0, 10).map((w, i) => `**${i + 1}.** ${w.reason} \u2014 by <@${w.moderator_id}>`).join("\n");
      const embed = new EmbedBuilder5().setColor(16705372).setTitle(`\u26A0\uFE0F Warnings for <@${targetId}>`).setDescription(list).setFooter({ text: `${warns.length} total warning(s)` }).setTimestamp();
      await message.reply({ embeds: [embed] });
      return true;
    }
    case "lock": {
      const ch = message.channel;
      await ch.permissionOverwrites.edit(message.guild.id, { SendMessages: false });
      await message.channel.send({ embeds: [successEmbed("Channel Locked", "This channel has been locked.")] });
      await logMod(message, config, "Lock", `<#${ch.id}>`, "Channel locked by moderator");
      return true;
    }
    case "unlock": {
      const ch = message.channel;
      await ch.permissionOverwrites.edit(message.guild.id, { SendMessages: null });
      await message.channel.send({ embeds: [successEmbed("Channel Unlocked", "This channel has been unlocked.")] });
      await logMod(message, config, "Unlock", `<#${ch.id}>`, "Channel unlocked by moderator");
      return true;
    }
    case "purge":
    case "clear": {
      const amount = Math.min(100, parseInt(args[0]) || 10);
      await message.channel.bulkDelete(amount + 1, true);
      const msg = await message.channel.send({ embeds: [successEmbed("Purged", `Deleted ${amount} messages.`)] });
      setTimeout(() => msg.delete().catch(() => {}), 3e3);
      return true;
    }
    default:
      return false;
  }
}

// src/commands/roles/index.ts
async function handleRoleCommands(message, command, args, config) {
  switch (command) {
    case "promote": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$promote @user")] });
        return true;
      }
      if (targetId === message.author.id) {
        await message.reply({ embeds: [errorEmbed("Error", "You cannot promote yourself.")] });
        return true;
      }
      const hierarchy = config.role_hierarchy || [];
      if (hierarchy.length === 0) {
        await message.reply({ embeds: [errorEmbed("No Hierarchy", "Set up role hierarchy first with $setroletier")] });
        return true;
      }
      try {
        const member = await message.guild.members.fetch(targetId);
        const invoker = message.member;
        const memberHighest = hierarchy.findIndex((r) => member.roles.cache.has(r));
        const invokerHighest = hierarchy.findIndex((r) => invoker.roles.cache.has(r));
        if (invokerHighest !== -1 && memberHighest !== -1 && memberHighest >= invokerHighest) {
          await message.reply({ embeds: [errorEmbed("Cannot Promote", "You cannot promote someone at or above your rank.")] });
          return true;
        }
        const nextIndex = memberHighest === -1 ? 0 : memberHighest + 1;
        if (nextIndex >= hierarchy.length) {
          await message.reply({ embeds: [errorEmbed("Already Max Rank", "This user is already at the top of the hierarchy.")] });
          return true;
        }
        await member.roles.add(hierarchy[nextIndex]);
        await message.reply({ embeds: [successEmbed("Promoted", `<@${targetId}> has been promoted to <@&${hierarchy[nextIndex]}>`)] });
      } catch {
        await message.reply({ embeds: [errorEmbed("Failed", "Could not promote that user.")] });
      }
      return true;
    }
    case "demote": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$demote @user")] });
        return true;
      }
      if (targetId === message.author.id) {
        await message.reply({ embeds: [errorEmbed("Error", "You cannot demote yourself.")] });
        return true;
      }
      const hierarchy = config.role_hierarchy || [];
      if (hierarchy.length === 0) {
        await message.reply({ embeds: [errorEmbed("No Hierarchy", "Set up role hierarchy first with $setroletier")] });
        return true;
      }
      try {
        const member = await message.guild.members.fetch(targetId);
        const topRoleIndex = hierarchy.findLastIndex((r) => member.roles.cache.has(r));
        if (topRoleIndex === -1) {
          await message.reply({ embeds: [errorEmbed("No Role", "This user has no hierarchy roles.")] });
          return true;
        }
        await member.roles.remove(hierarchy[topRoleIndex]);
        await message.reply({ embeds: [successEmbed("Demoted", `<@${targetId}> has been demoted. Removed <@&${hierarchy[topRoleIndex]}>`)] });
      } catch {
        await message.reply({ embeds: [errorEmbed("Failed", "Could not demote that user.")] });
      }
      return true;
    }
    case "fill": {
      const targetId = args[0]?.replace(/[<@!>]/g, "");
      if (!targetId) {
        await message.reply({ embeds: [errorEmbed("Usage", "$fill @user")] });
        return true;
      }
      const hierarchy = config.role_hierarchy || [];
      if (hierarchy.length === 0) {
        await message.reply({ embeds: [errorEmbed("No Hierarchy", "Set up role hierarchy first with $setroletier")] });
        return true;
      }
      try {
        const member = await message.guild.members.fetch(targetId);
        const highestIndex = hierarchy.findLastIndex((r) => member.roles.cache.has(r));
        if (highestIndex === -1) {
          await message.reply({ embeds: [errorEmbed("No Role", "This user has no hierarchy roles to fill below.")] });
          return true;
        }
        const toGive = hierarchy.slice(0, highestIndex).filter((r) => !member.roles.cache.has(r));
        if (toGive.length === 0) {
          await message.reply({ embeds: [successEmbed("Already Filled", "This user already has all lower roles.")] });
          return true;
        }
        await member.roles.add(toGive);
        const list = toGive.map((r) => `<@&${r}>`).join(", ");
        await message.reply({ embeds: [successEmbed("Roles Filled", `Added to <@${targetId}>: ${list}`)] });
      } catch {
        await message.reply({ embeds: [errorEmbed("Failed", "Could not fill roles for that user.")] });
      }
      return true;
    }
    default:
      return false;
  }
}

// src/events/messageCreate.ts
var _processedMsgIds = new Set();
function handleMessageCreate(client2) {
  client2.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild) return;
    if (_processedMsgIds.has(message.id)) return;
    _processedMsgIds.add(message.id);
    setTimeout(() => _processedMsgIds.delete(message.id), 5e3);
    const config = getGuildConfig(message.guild.id);
    const prefix = config.prefix || "$";
    if (!message.content.startsWith(prefix)) return;
    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const command = args.shift()?.toLowerCase() || "";
    if (!command) return;
    const member = message.member;
    const botAdmins = config.bot_admins || [];
    const isAdmin3 = member.permissions.has(PermissionFlagsBits3.Administrator) || botAdmins.includes(message.author.id);
    try {
      const adminHandled = await handleAdminCommands(message, command, args, config, isAdmin3);
      if (adminHandled) return;
      const mmHandled = await handleMiddlemanCommands(message, command, args, config, isAdmin3);
      if (mmHandled) return;
      if (isAdmin3) {
        const modHandled = await handleModerationCommands(message, command, args, config);
        if (modHandled) return;
        const roleHandled = await handleRoleCommands(message, command, args, config);
        if (roleHandled) return;
      }
      const funHandled = await handleFunCommands(message, command, args, config);
      if (funHandled) return;
      const customCmd = getCustomCommand(message.guild.id, command);
      if (customCmd) {
        const embed = buildCustomEmbed({
          title: customCmd.title,
          description: customCmd.description,
          color: customCmd.color,
          image: customCmd.image,
          thumbnail: customCmd.thumbnail,
          footer: customCmd.footer
        });
        const buttons = customCmd.buttons || [];
        if (buttons.length > 0) {
          const row = buildButtonRow(buttons);
          await message.channel.send({ embeds: [embed], components: [row] });
        } else {
          await message.channel.send({ embeds: [embed] });
        }
        return;
      }
    } catch (err) {
      console.error(`Error handling command ${command}:`, err);
      try {
        await message.reply({ embeds: [errorEmbed("Error", "Something went wrong.")] });
      } catch {}
    }
  });
}

// src/events/interactionCreate.ts
import {
  EmbedBuilder as EmbedBuilder6,
  ActionRowBuilder as ActionRowBuilder4,
  ButtonBuilder as ButtonBuilder4,
  ButtonStyle as ButtonStyle4,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from "discord.js";
function handleInteractionCreate(client2) {
  client2.on("interactionCreate", async (interaction) => {
    try {
      if (interaction.isButton()) {
        await handleButton(interaction);
      } else if (interaction.isModalSubmit()) {
        await handleModal(interaction);
      }
    } catch (err) {
      console.error("Interaction error:", err);
      try {
        if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
          await interaction.reply({ embeds: [errorEmbed("Error", "Something went wrong.")], ephemeral: true });
        }
      } catch {}
    }
  });
}
async function handleButton(btn) {
  if (!btn.guild) return;
  const { customId } = btn;
  if (customId === "ticket_open" || customId.startsWith("cc_ticket_")) {
    await showTicketModal(btn);
    return;
  }
  if (customId === "ticket_close") {
    await handleCloseTicket(btn);
    return;
  }
  if (customId === "ticket_claim") {
    await handleClaimTicket(btn);
    return;
  }
  if (customId === "blunderbluss_accept") {
    await handleBlunderblussAccept(btn);
    return;
  }
  if (customId.startsWith("cc_role_give_")) {
    const roleId = customId.replace("cc_role_give_", "");
    const m = btn.guild.members.cache.get(btn.user.id);
    if (m) {
      await m.roles.add(roleId).catch(() => {});
      await btn.reply({ embeds: [successEmbed("Role Given", `You've been given <@&${roleId}>`)], ephemeral: true });
    }
    return;
  }
  if (customId.startsWith("cc_role_remove_")) {
    const roleId = customId.replace("cc_role_remove_", "");
    const m = btn.guild.members.cache.get(btn.user.id);
    if (m) {
      await m.roles.remove(roleId).catch(() => {});
      await btn.reply({ embeds: [successEmbed("Role Removed", `Role <@&${roleId}> removed`)], ephemeral: true });
    }
    return;
  }
  if (customId.startsWith("cc_role_toggle_")) {
    const roleId = customId.replace("cc_role_toggle_", "");
    const m = btn.guild.members.cache.get(btn.user.id);
    if (m) {
      if (m.roles.cache.has(roleId)) {
        await m.roles.remove(roleId).catch(() => {});
        await btn.reply({ embeds: [successEmbed("Role Removed", `Role <@&${roleId}> removed`)], ephemeral: true });
      } else {
        await m.roles.add(roleId).catch(() => {});
        await btn.reply({ embeds: [successEmbed("Role Given", `You've been given <@&${roleId}>`)], ephemeral: true });
      }
    }
    return;
  }
  if (customId.startsWith("cc_msg_")) {
    const msg = customId.replace("cc_msg_", "").replace(/_/g, " ");
    await btn.reply({ content: msg, ephemeral: true });
    return;
  }
  if (customId === "confirm_trade") {
    await btn.reply({ content: `\u2705 ${btn.user} has **confirmed** the trade.` });
    return;
  }
  if (customId === "decline_trade") {
    await btn.reply({ content: `\u274C ${btn.user} has **declined** the trade.` });
    return;
  }
  if (customId === "mmfee_5050") {
    await btn.reply({ content: `\u{1F451} ${btn.user} has agreed to cover **50%** of the middleman fee.`, ephemeral: false });
    return;
  }
  if (customId === "mmfee_100") {
    await btn.reply({ content: `\u{1FA99} ${btn.user} has agreed to cover **100%** of the middleman fee.`, ephemeral: false });
    return;
  }
  if (customId === "mminfo_understood") {
    await btn.reply({ content: `\u2705 ${btn.user} has **understood** how the middleman works.` });
    return;
  }
  if (customId === "mminfo_not_understood") {
    await btn.reply({ content: `\u2753 ${btn.user} has **not understood** how the middleman works.` });
    return;
  }
}
async function showTicketModal(btn) {
  const guild = btn.guild;
  const existing = db.prepare("SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'").get(guild.id, btn.user.id);
  if (existing) {
    await btn.reply({
      embeds: [errorEmbed("Ticket Exists", `You already have an open ticket: <#${existing.channel_id}>`)],
      ephemeral: true
    });
    return;
  }
  const modal = new ModalBuilder().setCustomId("ticket_modal").setTitle("Please answer the question below.");
  const traderInput = new TextInputBuilder().setCustomId("trader").setLabel("Who's Your Other Trader").setStyle(TextInputStyle.Short).setPlaceholder("Example: hallo.ws").setMaxLength(500).setRequired(true);
  const tradeInput = new TextInputBuilder().setCustomId("trade").setLabel("What Is The Trade").setStyle(TextInputStyle.Paragraph).setPlaceholder("Example: My 30$ PayPal for their Fr Frost Dragon in Adopt Me").setMaxLength(500).setRequired(true);
  modal.addComponents(
    new ActionRowBuilder4().addComponents(traderInput),
    new ActionRowBuilder4().addComponents(tradeInput)
  );
  await btn.showModal(modal);
}
async function handleModal(modal) {
  if (modal.customId !== "ticket_modal") return;
  if (!modal.guild) return;
  await modal.deferReply({ ephemeral: true });
  const guild = modal.guild;
  const config = getGuildConfig(guild.id);
  const trader = modal.fields.getTextInputValue("trader");
  const trade = modal.fields.getTextInputValue("trade");
  const ticketName = (config.ticket_name_format || "ticket-{username}").replace("{username}", modal.user.username).replace("{userid}", modal.user.id).toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const staffRoles = config.ticket_staff_roles || [];
  const permOverwrites = [
    { id: guild.id, deny: ["ViewChannel"] },
    { id: modal.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] }
  ];
  for (const roleId of staffRoles) {
    permOverwrites.push({
      id: roleId,
      allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"]
    });
  }
  const channel = await guild.channels.create({
    name: ticketName,
    parent: config.ticket_category || void 0,
    permissionOverwrites: permOverwrites
  });
  db.prepare("INSERT INTO tickets (guild_id, channel_id, user_id) VALUES (?, ?, ?)").run(
    guild.id,
    channel.id,
    modal.user.id
  );
  const member = await guild.members.fetch(modal.user.id);
  const color = parseInt((config.ticket_color || "#5865F2").replace("#", ""), 16);
  const supportRole = config.support_role ? `<@&${config.support_role}>` : "@unknown-role";
  const embed = new EmbedBuilder6().setColor(color).setTitle(config.ticket_title || "Support Ticket").setThumbnail(member.displayAvatarURL({ size: 256 })).addFields(
    { name: "User", value: `${modal.user} (${modal.user.tag})`, inline: true },
    { name: "User ID", value: modal.user.id, inline: true },
    { name: "Account Age", value: `${Math.floor((Date.now() - modal.user.createdTimestamp) / 864e5)} days`, inline: true },
    { name: "Other Trader", value: trader },
    { name: "The Trade", value: trade }
  ).setFooter({ text: "User Found \u2705" }).setTimestamp();
  if (config.ticket_banner) embed.setImage(config.ticket_banner);
  const row = new ActionRowBuilder4().addComponents(
    new ButtonBuilder4().setCustomId("ticket_close").setLabel("Close Ticket").setStyle(ButtonStyle4.Danger).setEmoji("\u{1F512}"),
    new ButtonBuilder4().setCustomId("ticket_claim").setLabel("Claim").setStyle(ButtonStyle4.Success).setEmoji("\u270B")
  );
  await channel.send({
    content: `${modal.user} | **Middleman Role:** ${supportRole}`,
    embeds: [embed],
    components: [row]
  });
  await modal.editReply({
    embeds: [successEmbed("Ticket Created", `Your ticket has been created: ${channel}`)]
  });
}
async function handleCloseTicket(btn) {
  const guild = btn.guild;
  const config = getGuildConfig(guild.id);
  const ticket = getTicket(btn.channel.id);
  if (!ticket) {
    await btn.reply({ embeds: [errorEmbed("Not a Ticket", "This is not a ticket channel.")], ephemeral: true });
    return;
  }
  await btn.reply({ embeds: [successEmbed("Closing Ticket", "This ticket will be closed in 5 seconds...")] });
  if (config.ticket_transcript_channel) {
    await sendTranscript(guild, config.ticket_transcript_channel, btn.channel.id, ticket.user_id);
  }
  updateTicket(btn.channel.id, { status: "closed", closed_at: Math.floor(Date.now() / 1e3) });
  setTimeout(async () => {
    try {
      await btn.channel?.delete();
    } catch {}
  }, 5e3);
}
async function handleClaimTicket(btn) {
  const guild = btn.guild;
  const ticket = getTicket(btn.channel.id);
  if (!ticket) {
    await btn.reply({ embeds: [errorEmbed("Not a Ticket", "This is not a ticket channel.")], ephemeral: true });
    return;
  }
  if (ticket.claimed_by) {
    await btn.reply({ embeds: [errorEmbed("Already Claimed", `Claimed by <@${ticket.claimed_by}>`)], ephemeral: true });
    return;
  }
  updateTicket(btn.channel.id, { claimed_by: btn.user.id });
  await btn.channel.permissionOverwrites.set([
    { id: guild.id, deny: ["ViewChannel"] },
    { id: ticket.user_id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"] },
    { id: btn.user.id, allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"] }
  ]);
  await btn.reply({
    embeds: [successEmbed("Ticket Claimed", `${btn.user} has claimed this ticket. Channel is now private.`)]
  });
}
async function handleBlunderblussAccept(btn) {
  const guild = btn.guild;
  const HITTER_ROLE_ID = "1408644461050855584";
  const member = await guild.members.fetch(btn.user.id);
  await member.roles.add(HITTER_ROLE_ID).catch(() => {});
  const embed = new EmbedBuilder6().setColor(5763719).setTitle("Congratulations!").setDescription(`You're now a **Hitter**! You can proceed to <#1454384283165917351> to hangout with other hitters.`).setTimestamp();
  await btn.reply({ embeds: [embed] });
  try {
    const dmEmbed = new EmbedBuilder6().setColor(5793266).setTitle("Welcome, Hitter!").setDescription(
      `Welcome to the team! You can now start hitting and be rich!\n\n**If you're new to hitting:**\n\u2022 Alt hit: <#1477528228053651631>\n\u2022 Normal hit: <#1477528678278889483>\n\u2022 More resources: <#1454384093390311444> and <#1495346357647704186>\n\u2022 Fake proofs: <#1477532655081984011>\n\nGood luck and get that bag! \u{1F4B0}`
    ).setTimestamp();
    await btn.user.send({ embeds: [dmEmbed] });
  } catch {}
}

// src/events/guildMemberAdd.ts
import { EmbedBuilder as EmbedBuilder7 } from "discord.js";
function handleGuildMemberAdd(client2) {
  client2.on("guildMemberAdd", async (member) => {
    const config = getGuildConfig(member.guild.id);
    if (!config.welcome_channel) return;
    const channel = member.guild.channels.cache.get(config.welcome_channel);
    if (!channel) return;
    const desc = (config.welcome_description || "Welcome {user} to {server}!").replace("{user}", `${member}`).replace("{server}", member.guild.name).replace("{membercount}", `${member.guild.memberCount}`);
    const embed = new EmbedBuilder7().setColor(parseInt((config.welcome_color || "#57F287").replace("#", ""), 16)).setTitle(config.welcome_title || `Welcome to ${member.guild.name}!`).setDescription(desc).setThumbnail(member.displayAvatarURL({ size: 256 })).addFields(
      { name: "Account Age", value: `${Math.floor((Date.now() - member.user.createdTimestamp) / 864e5)} days`, inline: true },
      { name: "Member #", value: `${member.guild.memberCount}`, inline: true }
    ).setTimestamp();
    if (config.welcome_banner) embed.setImage(config.welcome_banner);
    await channel.send({ embeds: [embed] }).catch(() => {});
  });
}

// src/events/antiSpam.ts
var spamMap = new Map();
var URL_REGEX = /(https?:\/\/|discord\.gg\/|discord\.com\/invite\/)/i;
function handleAntiSpam(client2) {
  client2.on("messageCreate", async (message) => {
    if (message.author.bot || !message.guild || !message.member) return;
    if (message.member.permissions.has(BigInt(8))) return;
    const config = getGuildConfig(message.guild.id);
    if (config.anti_link && URL_REGEX.test(message.content)) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send({
        content: `${message.author}`,
        embeds: [errorEmbed("No Links", "Links are not allowed in this server.")]
      });
      setTimeout(() => warn.delete().catch(() => {}), 5e3);
      return;
    }
    if (config.anti_spam) {
      const key = `${message.guild.id}-${message.author.id}`;
      const current = spamMap.get(key);
      if (current) {
        current.count++;
        clearTimeout(current.timer);
        if (current.count >= 5) {
          spamMap.delete(key);
          try {
            await message.member.timeout(3e4, "Spam detected");
            const warn = await message.channel.send({
              content: `${message.author}`,
              embeds: [errorEmbed("Spam Detected", "You've been timed out for 30 seconds.")]
            });
            setTimeout(() => warn.delete().catch(() => {}), 5e3);
          } catch {}
          return;
        }
        current.timer = setTimeout(() => spamMap.delete(key), 5e3);
        spamMap.set(key, current);
      } else {
        const timer = setTimeout(() => spamMap.delete(key), 5e3);
        spamMap.set(key, { count: 1, timer });
      }
    }
  });
}

// src/events/autoVouch.ts
import { EmbedBuilder as EmbedBuilder8 } from "discord.js";
var lastVouchTime = new Map();
function startAutoVouch(client2) {
  setInterval(async () => {
    const guilds = db.prepare(
      "SELECT guild_id FROM guild_config WHERE auto_vouch_enabled = 1 AND auto_vouch_channel IS NOT NULL AND auto_vouch_target IS NOT NULL"
    ).all();
    const now = Date.now();
    for (const { guild_id } of guilds) {
      try {
        const config = getGuildConfig(guild_id);
        const intervalMs = config.auto_vouch_interval || 1e4;
        const last = lastVouchTime.get(guild_id) ?? 0;
        if (now - last < intervalMs) continue;
        lastVouchTime.set(guild_id, now);
        const targets = config.auto_vouch_targets || [];
        if (targets.length === 0) continue;
        const vouchedUserId = targets[Math.floor(Math.random() * targets.length)];
        if (!vouchedUserId) continue;
        const guild = client2.guilds.cache.get(guild_id);
        if (!guild) continue;
        const allMembers = await guild.members.fetch();
        const eligible = allMembers.filter(
          (m) => !m.user.bot && m.id !== vouchedUserId
        );
        if (eligible.size === 0) continue;
        const membersArr = [...eligible.values()];
        const voucherMember = membersArr[Math.floor(Math.random() * membersArr.length)];
        const vouchedBy = voucherMember.id;
        const vouchedByUsername = voucherMember.user.username;
        const newCount = addVouch(guild_id, vouchedUserId);
        const channel = client2.channels.cache.get(config.auto_vouch_channel);
        if (!channel) continue;
        let vouchedUserUsername = vouchedUserId;
        let vouchedUserAvatarUrl = null;
        try {
          const targetMember = await guild.members.fetch(vouchedUserId);
          vouchedUserUsername = targetMember.user.username;
          vouchedUserAvatarUrl = targetMember.displayAvatarURL({ size: 256 });
        } catch {}
        const randomFeedback = getRandomClientFeedback(guild_id);
        const embedFields = [
          { name: "Vouched User", value: `${vouchedUserUsername} (<@${vouchedUserId}>)` },
          { name: "Vouched By", value: `${vouchedByUsername} (<@${vouchedBy}>)` },
          { name: "Total Vouches", value: `\u2B50 ${newCount}` }
        ];
        if (randomFeedback) embedFields.push({ name: "\u{1F4AC} Client Feedback", value: `\u201C${randomFeedback}\u201D` });
        const embed = new EmbedBuilder8().setColor(5793266).setTitle("\u2B50 New Vouch!").setDescription(`<@${vouchedBy}> vouched for <@${vouchedUserId}>`).addFields(...embedFields);
        if (vouchedUserAvatarUrl) embed.setThumbnail(vouchedUserAvatarUrl);
        await channel.send({
          content: `\u{1F389} <@${vouchedUserId}> received +1 vouch!`,
          embeds: [embed]
        });
      } catch (err) {
        console.error(`Auto vouch error for guild ${guild_id}:`, err);
      }
    }
  }, 1e3);
}

// src/index.ts
if (!process.env.DISCORD_TOKEN) {
  throw new Error("DISCORD_TOKEN environment variable is required.");
}
var client = new Client6({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel, Partials.Message]
});
handleReady(client);
handleMessageCreate(client);
handleInteractionCreate(client);
handleGuildMemberAdd(client);
handleAntiSpam(client);
startAutoVouch(client);
client.login(process.env.DISCORD_TOKEN).catch((err) => {
  console.error("Failed to login:", err);
  process.exit(1);
});

function shutdown(signal) {
  console.log(`Received ${signal} — shutting down cleanly.`);
  client.destroy();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
