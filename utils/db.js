const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');

function read(file) {
  const fp = path.join(dataDir, file + '.json');
  if (!fs.existsSync(fp)) return {};
  return JSON.parse(fs.readFileSync(fp, 'utf8'));
}

function write(file, data) {
  const fp = path.join(dataDir, file + '.json');
  fs.writeFileSync(fp, JSON.stringify(data, null, 2));
}

function getConfig() { return read('config'); }
function saveConfig(data) { write('config', data); }

function getAdmins() { return read('admins'); }
function saveAdmins(data) { write('admins', data); }

function getWarnings() { return read('warnings'); }
function saveWarnings(data) { write('warnings', data); }

function getVouches() { return read('vouches'); }
function saveVouches(data) { write('vouches', data); }

function getTickets() { return read('tickets'); }
function saveTickets(data) { write('tickets', data); }

module.exports = {
  getConfig, saveConfig,
  getAdmins, saveAdmins,
  getWarnings, saveWarnings,
  getVouches, saveVouches,
  getTickets, saveTickets,
};
