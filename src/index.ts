import { ChannelType } from "discord.js";
import { PrivateState } from "./library/PrivateState";
import { bot } from "./bot";

const state = new PrivateState(bot);

bot.on('messageCreate', async (message) => {
  if (!message.guild) return;
  if (message.channel.type !== ChannelType.GuildVoice) return;
  if (!message.content.startsWith('!')) return;
  const voice = state.getVoice(message.channel);
  if (!voice || voice.ownerId !== message.author.id) return;
  await voice.runCommand(message);
});

bot.on('channelDelete', (channel) => {
  if (channel.type !== ChannelType.GuildVoice) return;
  state.getVoice(channel)?.delete(true);
});

bot.on('channelUpdate', (_, channel) => {
  if (channel.type !== ChannelType.GuildVoice) return;
  state.getVoice(channel)?.updateConfig();
});

while (true) {
  await state.loop();
  await new Promise(resolve => setTimeout(resolve, 100));
}
