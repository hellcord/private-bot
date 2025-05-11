import type { Message } from "discord.js";

export type UserParams = {
  notMe?: boolean;
  notBot?: boolean;
};

export type NumberParams = {
  int?: boolean;
  default?: number;
};

export class ArgumentsParser {
  cursor = 0;
  raw = '';

  constructor(public message: Message) {
    this.raw = message.content;
  }

  command() {
    const slice = this.raw.slice(this.cursor);
    const match = /\!(\w+)/.exec(slice);
    if (!match)
      throw new Error('Неверно указана команда');
    this.cursor += match.length;
    return match[1];
  }

  userid() {
    const slice = this.raw.slice(this.cursor);
    const match = /(<@(\d+)>|(\d+))/.exec(slice);
    if (!match)
      throw new Error('Неверно указан пользователь');
    this.cursor += match.length;
    return match[2] ?? match[3] ?? '';
  }

  number(params?: NumberParams) {
    const slice = this.raw.slice(this.cursor);
    const match = /(\d+(\.|,(\d+)))/.exec(slice);

    if (!match && params?.default === undefined)
      throw new Error('Неверно указано число');

    const val = Number(match?.[1] ?? params?.default ?? 0);

    if (params?.int && Math.floor(val) !== val)
      throw new Error('Число должно быть целочисленным');

    return val;
  }

  async user(params?: UserParams) {
    const id = this.userid();
    const user = await this.message.guild?.members.fetch(id)
      .catch(e => { throw new Error('Ошибка получения пользователя'); });
    if (!user) throw new Error(`Указанный пользователь не найден.`);
    if (params?.notMe && this.message.author.id === user.id) throw new Error(`Здесь нельзя указать себя`);
    if (params?.notBot && user.user.bot) throw new Error(`Здесь нельзя указать бота`);
    return user;
  }
}