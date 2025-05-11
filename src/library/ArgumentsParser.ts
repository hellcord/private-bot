import type { Message } from "discord.js";

export type UserParams = {
  notMe?: boolean;
  notBot?: boolean;
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
    if (!match || !match[1])
      throw new Error('Неверно указана команда');
    this.cursor += match.length;
    return match[1];
  }

  userid() {
    const slice = this.raw.slice(this.cursor);
    const match = /(<@(\d+)>|(\d+))/.exec(slice);
    if (!match || (!match[2] && !match[3]))
      throw new Error('Неверно указан пользователь');
    this.cursor += match.length;
    return match[2];
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