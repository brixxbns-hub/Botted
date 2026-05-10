# TradingValley Discord Bot

A feature-rich Discord bot built with discord.js v14.

## Overview

This bot includes the following systems:
- **Bot Admin Management** — grant/revoke bot admin access
- **Ticket System** — create ticket panels, manage tickets with buttons
- **Auto Vouch** — automated vouch messages on a timer
- **Embed Builder** — interactive embed creator with modal UI
- **Welcome** — configurable welcome messages for new members
- **Moderation** — ban, kick, mute, warn, purge, lock/unlock
- **Roles** — tier-based promotion/demotion system
- **Mass DM** — DM all server members
- **Setup** — configure mod log, support role, antispam, antilink
- **Middleman** — fee tracking, deal management, vouch leaderboard
- **Fun** — RPS, Tic-Tac-Toe, 8ball, memes, dad jokes, ship, rate

## Setup

1. Add your `DISCORD_TOKEN` in the Secrets tab
2. Click Run to start the bot

## Commands

All commands use the `$` prefix. Use `$help` in Discord to see the full command list.

## File Structure

- `index.js` — main bot file
- `commands/` — individual command modules
- `utils/` — database helpers and utility functions
- `data/` — JSON files for persistent storage

## User Preferences

- Prefix: `$`
- Framework: discord.js v14
