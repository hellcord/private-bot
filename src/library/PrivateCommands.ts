import type { ArgumentsParser } from "./ArgumentsParser";
import type { PrivateVoice } from "./PrivateVoice";

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
      if (args.raw.includes('all')) {
        voice.blocks.splice(0);
        await voice.unblockall();
        return 'Все пользователи разблокированы.';
      }

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

