import { ChannelType } from "discord.js";
import { PrivateState } from "./library/PrivateState";
import { bot } from "./bot";

const state = new PrivateState(bot);
const taskList: (() => Promise<any>)[] = [];

function asyncTask<T extends any[]>(func: (...args: T) => Promise<void>) {
  return (...args: T) => {
    taskList.push(async () => {
      await func(...args);
    });
  };
}

bot.on('messageCreate', asyncTask(
  async (message) => {
    if (!message.guild) return;
    if (message.channel.type !== ChannelType.GuildVoice) return;
    if (!message.content.startsWith('!')) return;
    const voice = state.getVoice(message.channel);
    if (!voice || voice.ownerId !== message.author.id) return;
    await voice.runCommand(message);
  }
));

bot.on('channelDelete', (channel) => {
  if (channel.type !== ChannelType.GuildVoice) return;
  state.getVoice(channel)?.delete(true);
});

bot.on('channelUpdate', (_, channel) => {
  if (channel.type !== ChannelType.GuildVoice) return;
  state.getVoice(channel)?.updateConfig();
});

bot.on('guildMemberAdd', (member) => {
  state.checkBlock(member);
});

(async () => {
  while (true) {
    await taskList.shift()?.();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
})();

(async () => {
  while (true) {
    await state.loop();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
})();
