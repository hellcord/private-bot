import { Client, GatewayIntentBits } from "discord.js";

import env from "./env";

export const bot = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

await bot.login(env.DISCORD_TOKEN);
await new Promise(resove => bot.on('ready', resove));
console.log('Bot started');