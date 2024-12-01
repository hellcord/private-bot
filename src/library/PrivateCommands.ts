import type { ArgumentsParser } from "./ArgumentsParser";
import { PrivateVoice } from "./PrivateVoice";
import { VoiceChannel } from "discord.js";

export type Command = {
  title: string;
  args?: string[];
  exec: (voice: PrivateVoice, args: ArgumentsParser) => void | string | Promise<void | string>;
};

export const PrivateCommands: { [key: string]: Command; } = {
  ban: {
    title: 'Перманентная блокировка пользователя.',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true });
      const blockUsers = voice.getBlockUsersIds();
      if (blockUsers.includes(user.id))
        throw new Error(`Пользователь ${user} уже заблокирован.`);
      if (user.permissions.has('MoveMembers'))
        throw new Error(`Пользователь ${user} не может быть заблокирован.`);
      voice.ban(user.id);
      await voice.block(user);
      return `Пользователь ${user} перманентно заблокирован.`;
    }
  },
  block: {
    title: 'Блокировка пользователя до пересоздания комнаты.',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true });
      const blockUsers = voice.getBlockUsersIds();
      if (blockUsers.includes(user.id))
        throw new Error(`Пользователь ${user} уже заблокирован`);
      if (user.permissions.has('MoveMembers'))
        throw new Error(`Пользователь ${user} не может быть заблокирован.`);
      await voice.block(user);
      return `Пользователь ${user} заблокирован до пересоздания.`;
    }
  },
  revoke: {
    title: 'Разблокировать пользователя.',
    args: ['user'],
    async exec(voice, args) {
      if (args.raw.includes('all'))
        return PrivateCommands.revokeall.exec(voice, args);

      const user = await args.user({ notBot: true, notMe: true });
      const blockUsers = voice.getBlockUsersIds();
      if (!blockUsers.includes(user.id))
        throw new Error(`Пользователь ${user} не был заблокирован.`);
      voice.unban(user.id);
      await voice.unblock(user);
      return `Пользователь ${user} полностью разблокирован.`;
    }
  },
  revokeall: {
    title: 'Разблокировать всех пользователей.',
    async exec(voice) {
      voice.blocks.splice(0);
      await voice.unblockall();
      return 'Все пользователи разблокированы.';
    }
  },
  transfer: {
    title: 'Передать комнату участнику.',
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true });

      if (user.voice.channelId !== voice.voice.id)
        throw new Error(`Пользователь ${user} должен находится в комнате.`);

      voice.ownerId = user.id;
      const channel = voice.voice;
      const config = await PrivateVoice.getConfig(
        voice.id,
        user.id,
        user.displayName,
        voice.voice.guild
      );
      await channel.permissionOverwrites.set(config.permissionOverwrites);
      await channel.setName(config.name);
      await voice.updateConfig();
      return `Канал успено передан ${user}.`;
    }
  },
  list: {
    title: 'Вывести список пользователей в блокировке.',
    async exec(voice) {
      const blockUsers = voice.getBlockUsersIds()
        .map(id => `- <@${id}> ${voice.blocks.includes(id) ? '(перм)' : ''}`);

      if (!blockUsers.length)
        return 'Список заблокированных людей пуст.';

      const limitBlockUsers = blockUsers.slice(0, 10).join('\n');
      const appendString = limitBlockUsers.length < blockUsers.length ? `\n\nИ еще ${blockUsers.length - limitBlockUsers.length}` : '';
      return `Список заблокированных людей:\n\n${limitBlockUsers}${appendString}`;
    }
  },
}

