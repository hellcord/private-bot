import { ChannelType } from "discord.js";
import { PrivateState } from "./library/PrivateState";
import { bot } from "./bot";

const state = new PrivateState(bot);
const taskList: (() => Promise<any>)[] = [];

bot.on('messageCreate', (message) => {
  const { guild, channel, member, content } = message;
  if (!guild)
    return;

  if (channel.type !== ChannelType.GuildVoice)
    return;

  if (!content.startsWith('!'))
    return;

  const voice = state.getVoice(channel);

  if (!voice || !member)
    return;

  const isOwner = voice.ownerId === member.id;
  const permissions = channel.permissionsFor(member);

  if (
    true &&
    !isOwner &&
    !permissions.has('MuteMembers') &&
    !permissions.has('MoveMembers')
  ) return;

  taskList.push(
    voice.runCommand.bind(voice, message, isOwner)
  );
});

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
    if (!taskList.length)
      await new Promise(resolve => setTimeout(resolve, 10));

    await Promise.resolve()
      .then(() => taskList.shift()?.())
      .catch(console.error);
  }
})();

(async () => {
  while (true) {
    await state.loop();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
})();
