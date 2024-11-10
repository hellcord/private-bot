import { CategoryChannel, ChannelType, VoiceChannel } from "discord.js";
import { PrivateGroup, configStore } from "./library/PrivateGroup";

import { PRIVATES } from "./config";
import { bot } from "./bot";

const state = new Set<PrivateGroup>();

bot.on('ready', async () => {
  console.log('Bot starting');
  for (const config of PRIVATES) {
    // Fetch guild
    const guild = bot.guilds.cache.get(config.guildId);
    if (!guild)
      throw new Error('No find guild');

    // Fetch root
    const root = guild.channels.cache.get(config.categoryId);
    if (!root || !(root instanceof CategoryChannel))
      throw new Error('No find category');

    // Fetch create
    const create = config.createVoiceIds.reduce((acc, id) => {
      const channel = guild.channels.cache.get(id);
      if (!channel || !(channel instanceof VoiceChannel))
        return acc;
      return [...acc, channel];
    }, [] as VoiceChannel[]);

    const group = new PrivateGroup(
      root,
      create,
      config.deleteTimeout
    );

    state.add(group);

    const channels = guild.channels.cache.filter((channel) => {
      if (channel.parent !== root)
        return false;

      if (!(channel instanceof VoiceChannel))
        return false;

      return true;
    });

    for (const [id, voice] of channels) {
      if (!(voice instanceof VoiceChannel))
        continue;

      const ownerPerm = voice.permissionOverwrites.cache.find((perm, id) => {
        return perm.allow.has('ManageChannels') && !guild.members.cache.get(id)?.user.bot;
      });

      if (!ownerPerm)
        continue;

      const id = group.getId(ownerPerm.id);
      const config = configStore.get(id);

      group.addVoice(voice, ownerPerm.id, config?.blocks ?? []);
    }
  }
});

bot.on('messageCreate', async (message) => {
  if (!message.guild) return;
  if (message.channel.type !== ChannelType.GuildVoice) return;
  if (!message.content.startsWith('!')) return;


  for (const group of state) {
    for (const voice of group.voices) {
      if (voice.voice === message.channel) {
        if (voice.ownerId !== message.author.id)
          return;

        const [cmd, arg = ''] = message.content.slice(1).split(/\s+/);

        const getUser = async () => {
          const match = /(\<@(\d+)\>|(\d+))/.exec(arg);
          if (!match) throw new Error(`Неверный формат аргумента.`);
          if (match[2] === message.author.id) throw new Error('Вы не можете использовать команду для себя');
          const user = await message.guild?.members.fetch(match[2])
            .catch(e => { throw new Error('Ошибка получения пользователя'); });
          if (!user) throw new Error(`Указанный пользователь не найден.`);
          if (user.user.bot) throw new Error('Вы не можете использовать эту команду для бота');
          return user;
        };

        try {
          switch (cmd) {
            case 'ban': {
              const user = await getUser();
              voice.ban(user.id);
              await message.channel.permissionOverwrites.edit(user, {
                Connect: false,
                SendMessages: false
              });
              await message.reply(`Пользователь ${user} перманентно заблокирован.`);
              await configStore.put(voice.id, voice.saveConfig());
              if (user.voice.channel === message.channel)
                await user.voice.disconnect().catch(console.log);
              break;
            }
            case 'block': {
              const user = await getUser();
              await message.channel.permissionOverwrites.edit(user, {
                Connect: false,
                SendMessages: false
              });
              if (user.voice.channel === message.channel)
                await user.voice.disconnect().catch(console.log);
              await message.reply(`Пользователь ${user} заблокирован до пересоздания канала.`);
              break;
            }
            case 'revoke': {
              const user = await getUser();
              voice.unban(user.id);
              await message.channel.permissionOverwrites.edit(user, {
                Connect: null,
                SendMessages: null
              });
              await message.reply(`Пользователь ${user} полностью разблокирован.`);
              break;
            }
            case 'list': {
              const blockUsers = message.channel.permissionOverwrites.cache
                .filter(perm => {
                  return perm.deny.has('Connect') && perm.deny.has('SendMessages');
                })
                .map(perm => {
                  return `- <@${perm.id}> ${voice.blocks.includes(perm.id) ? '(перм)' : ''}`;
                });

              if (!blockUsers.length) {
                await message.reply('Список заблокированных людей пуст.');
                break;
              }
              const limitBlockUsers = blockUsers.slice(0, 1);
              const appendString = limitBlockUsers.length < blockUsers.length ? `\n\nИ еще ${blockUsers.length - limitBlockUsers.length}` : '';

              await message.reply(`Список заблокированных людей:\n\n${limitBlockUsers}${appendString}`);
              break;
            }
          }
        } catch (error) {
          const msg = error instanceof Error ? error.message : `${error}`;
          await message.reply(`Error: ${msg}`);
        }
      }
    }
  }
});

bot.on('channelDelete', (channel) => {
  if (channel.type !== ChannelType.GuildVoice)
    return;

  for (const group of state) {
    for (const voice of group.voices) {
      if (voice.voice === channel)
        voice.delete(true);
    }
  }
});

bot.on('channelUpdate', (_, channel) => {
  if (channel.type !== ChannelType.GuildVoice)
    return;

  for (const group of state) {
    for (const voice of group.voices) {
      if (voice.voice === channel) {
        configStore.put(voice.id, voice.saveConfig());
      }
    }
  }
});

while (true) {
  for (const group of state)
    await group.loop();

  await new Promise(resolve => setTimeout(resolve, 500));
}
