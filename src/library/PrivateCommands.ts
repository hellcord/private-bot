import type { ArgumentsParser } from "./ArgumentsParser";
import { PrivateVoice } from "./PrivateVoice";
import env from "../env";

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
      if (voice.blocks.has(user.id))
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
      if (voice.blocks.has(user.id))
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
      if (!voice.blocks.has(user.id))
        throw new Error(`Пользователь ${user} не был заблокирован.`);
      voice.unban(user.id);
      await voice.unblock(user);
      return `Пользователь ${user} полностью разблокирован.`;
    }
  },
  revokeall: {
    title: 'Разблокировать всех пользователей.',
    async exec(voice) {
      voice.blocks.clear();
      await voice.updateConfig();
      await voice.unblockall();
      return 'Все пользователи разблокированы.';
    }
  },
  transfer: {
    title: 'Передать комнату участнику.',
    args: ['user'],
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
      voice.blocks = voice.blocks;
      await channel.edit(config);
      await voice.updateConfig();
      return `Канал успешно передан ${user}.`;
    }
  },
  list: {
    title: 'Вывести список пользователей в блокировке.',
    async exec(voice) {
      const blockUsers = voice.getBlockList()
        .map(id => `- <@${id}> ${voice.blocks.has(id) ? '(перм)' : ''}`);

      if (!blockUsers.length)
        return 'Список заблокированных людей пуст.';

      const limitBlockUsers = blockUsers.slice(0, 10).join('\n');
      const appendString = limitBlockUsers.length < blockUsers.length ? `\n\nИ еще ${blockUsers.length - limitBlockUsers.length}` : '';
      return `Список заблокированных людей:\n\n${limitBlockUsers}${appendString}`;
    }
  },
  test: {
    title: 'Проверка парсинга числа',
    args: ['number'],
    exec(_, args) {
      return `Ваше число: ${args.number({ default: 0 })}. По умолчанию: 0`;
    }
  },
  help: {
    title: 'Показать список доступных команд.',
    async exec(voice) {
      await voice.welcomeMessage();
    }
  },
  mute: {
    title: 'Заглушить микрофон пользователя на сервере.',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true });

      if (!user.voice.channel)
        throw new Error(`Пользователь ${user} не находится в голосовом канале.`);

      if (!user.roles.cache.has(env.ALL_MUTED_ROLE))
        throw new Error(`Пользователь ${user} не имеет роли для заглушения.`);

      if (user.voice.serverMute)
        throw new Error(`Пользователь ${user} уже заглушен.`);

      await user.voice.setMute(true);
      return `Микрофон пользователя ${user} заглушен на сервере.`;
    }
  },
  unmute: {
    title: 'Включить микрофон пользователя на сервере.',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true });

      if (!user.voice.channel)
        throw new Error(`Пользователь ${user} не находится в голосовом канале.`);

      if (!user.roles.cache.has(env.ALL_MUTED_ROLE))
        throw new Error(`Пользователь ${user} не имеет роли для заглушения.`);

      if (!user.voice.serverMute)
        throw new Error(`Пользователь ${user} не заглушен.`);

      await user.voice.setMute(false);
      return `Микрофон пользователя ${user} включен на сервере.`;
    }
  }
}

