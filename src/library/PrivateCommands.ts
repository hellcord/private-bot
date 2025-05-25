import type { ArgumentsParser } from "./ArgumentsParser";
import { PrivateVoice } from "./PrivateVoice";

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
      const user = await args.user({ notBot: true, notMe: true });
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
      voice.mutes.clear();
      await voice.updateConfig();
      await voice.reset();
      return 'Все пользователи были размьючены.';
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

      const limitBlockUsers = blockUsers.slice(0, 10).join('\n');
      const appendString = limitBlockUsers.length < blockUsers.length ? `\n\nИ еще ${blockUsers.length - limitBlockUsers.length}` : '';
      return `Список блокировок:\n\n${limitBlockUsers}${appendString}`;
    }
  },
  help: {
    title: 'Показать список доступных команд.',
    async exec(voice) {
      await voice.welcomeMessage();
    }
  }
}

