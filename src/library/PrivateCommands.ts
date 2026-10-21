import type { ArgumentsParser } from "./ArgumentsParser";
import { PrivateVoice } from "./PrivateVoice";

export type Command = {
  title: string;
  args?: string[];
  forModerator?: boolean;
  exec: (voice: PrivateVoice, args: ArgumentsParser) => void | string | Promise<void | string>;
};

export const PrivateCommands: { [key: string]: Command; } = {
  ban: {
    title: 'Перманентная блокировка пользователя.',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true, noIgnore: true });
      if (voice.blocks.has(user.id))
        throw new Error(`Пользователь ${user} уже заблокирован.`);
      if (user.permissions.has('MoveMembers'))
        throw new Error(`Пользователь ${user} не может быть заблокирован.`);
      voice.blocks.add(user.id);
      await voice.updateConfig();
      await voice.block(user);
      return `Пользователь ${user} перманентно заблокирован.`;
    }
  },
  block: {
    title: 'Блокировка пользователя до пересоздания комнаты.',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true, noIgnore: true });
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
      if (!voice.getBlockList().includes(user.id))
        throw new Error(`Пользователь ${user} не был заблокирован.`);
      voice.blocks.delete(user.id);
      await voice.updateConfig();
      await voice.unblock(user);
      return `Пользователь ${user} полностью разблокирован.`;
    }
  },
  revokeall: {
    title: 'Разблокировать всех пользователей.',
    async exec(voice) {
      voice.blocks.clear();
      await voice.updateConfig();
      await voice.reset();
      return 'Все пользователи разблокированы.';
    }
  },
  mute: {
    title: 'Замьютить пользователя',
    args: ['user'],
    async exec(voice, args) {
      const user = await args.user({ notBot: true, notMe: true, noIgnore: true });
      if (voice.mutes.has(user.id))
        throw new Error(`Пользователь ${user} уже замьючен.`);
      if (user.permissions.has('MuteMembers'))
        throw new Error(`Пользователь ${user} не может быть замьючен.`);
      voice.mutes.add(user.id);
      await voice.updateConfig();
      await voice.mute(user);
      return `Пользователь ${user} был замьючен.`;
    }
  },
  unmute: {
    title: 'Размьютить пользователя',
    args: ['user'],
    async exec(voice, args) {
      if (args.raw.includes('all'))
        return PrivateCommands.unmuteall.exec(voice, args);
      const user = await args.user({ notBot: true, notMe: true });
      if (!voice.mutes.has(user.id))
        throw new Error(`Пользователь ${user} не был замьючен.`);
      voice.mutes.delete(user.id);
      await voice.updateConfig();
      await voice.unmute(user);
      return `Пользователь ${user} размьючен.`;
    }
  },
  unmuteall: {
    title: 'Размьютить всех пользователей',
    async exec(voice) {
      // Не через reset(), чтобы не снимать временные блокировки
      const mutes = [...voice.mutes];
      voice.mutes.clear();
      await voice.updateConfig();
      for (const id of mutes)
        await voice.unmute(id);
      return 'Все пользователи были размьючены.';
    }
  },
  transfer: {
    title: 'Передать комнату участнику.',
    args: ['user'],
    forModerator: true,
    async exec(voice, args) {
      const user = await args.user({ notBot: true });

      if (user.id === voice.ownerId)
        throw new Error(`Пользователь ${user} уже является владельцем канала.`);

      if (user.voice.channelId !== voice.voice.id)
        throw new Error(`Пользователь ${user} должен находится в комнате.`);

      await voice.transfer(user);
      return `Канал успешно передан ${user}.`;
    }
  },
  list: {
    title: 'Вывести список пользователей в блокировке.',
    args: ['page?'],
    forModerator: true,
    async exec(voice, args) {
      const block = new Set(voice.getBlockList());
      const state = (id: string) => {
        return [
          block.has(id) ? '💥' : '',
          voice.blocks.has(id) ? '❗️' : '',
          voice.mutes.has(id) ? '🔇' : ''
        ].filter(Boolean).join(' ');
      };

      const blockUsers = [...new Set([...voice.getBlockList(), ...voice.mutes])]
        .map(id => `- <@${id}> ${state(id)}`);

      if (!blockUsers.length)
        return 'Список блокировок пуст.';

      const page = args.number({ int: true, default: 1 });
      const size = 10;
      const start = (page - 1) * size;

      if (start < 0 || start > blockUsers.length - 1)
        throw new Error('Данной страницы не существует');

      const limitBlockUsers = blockUsers.slice(start, start + size).join('\n');
      const pagination = `Страница ${page} из ${Math.ceil(blockUsers.length / size)}`;
      const help = `!list [page] - для отображения нужной страницы.`;
      return `Список блокировок:\n\n${limitBlockUsers}\n\n${pagination}\n${help}`;
    }
  },
  random: {
    title: 'Рандомный пользователь в войсе',
    forModerator: true,
    async exec(voice) {
      return `Случайно выбран ${voice.voice.members.random()}`;
    }
  },
  help: {
    title: 'Показать список доступных команд.',
    forModerator: true,
    async exec(voice) {
      await voice.welcomeMessage();
    }
  }
}

