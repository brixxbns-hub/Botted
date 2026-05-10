const { EmbedBuilder } = require('discord.js');
const db = require('./db');

function isBotAdmin(userId) {
  const admins = db.getAdmins();
  return admins.admins && admins.admins.includes(userId);
}

function isAdmin(member) {
  return member.permissions.has('Administrator') || isBotAdmin(member.id);
}

function isMod(member) {
  const config = db.getConfig();
  if (isAdmin(member)) return true;
  if (config.staffRole && member.roles.cache.has(config.staffRole)) return true;
  return false;
}

function successEmbed(description) {
  return new EmbedBuilder().setColor(0x57F287).setDescription(`✅ ${description}`);
}

function errorEmbed(description) {
  return new EmbedBuilder().setColor(0xED4245).setDescription(`❌ ${description}`);
}

function infoEmbed(title, description) {
  return new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(description);
}

module.exports = { isBotAdmin, isAdmin, isMod, successEmbed, errorEmbed, infoEmbed };
