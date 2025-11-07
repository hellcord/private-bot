import type { Message } from "discord.js";
import type { PrivateVoice } from "./PrivateVoice";

export type UserParams = {
  notMe?: boolean;
  notBot?: boolean;
  noIgnore?: boolean;
};

export type NumberParams = {
  int?: boolean;
  default?: number;
};

export class ArgumentsParser {
  cursor = 0;
  raw = '';

  constructor(public message: Message, public voice: PrivateVoice) {
    this.raw = message.content;
  }

  skip() {
    const slice = this.raw.slice(this.cursor);
    const match = /^\s+/.exec(slice);
    if (!match) return;
    this.cursor += match[0].length;
  }

  command() {
    const slice = this.raw.slice(this.cursor);
    const match = /^\!(\w+)/.exec(slice);
    if (!match)
      throw new Error('Неверно указана команда');
    this.cursor += match[0].length;
    return match[1];
  }

  userid() {
    this.skip();
    const slice = this.raw.slice(this.cursor);
    const match = /^(<@(\d+)>|(\d+))/.exec(slice);
    if (!match)
      throw new Error('Неверно указан пользователь');
    this.cursor += match[0].length;
    return match[2] ?? match[3] ?? '';
  }

  number(params?: NumberParams) {
    this.skip();
    const slice = this.raw.slice(this.cursor);
    const match = /^(\d+(\.(\d+))?)/.exec(slice);

    if (!match && params?.default === undefined)
      throw new Error('Неверно указано число');

    const val = Number(match?.[0] ?? params?.default ?? 0);

    if (params?.int && Math.floor(val) !== val)
      throw new Error('Число должно быть целочисленным');

    this.cursor += match?.[0].length ?? 0;
    return val;
  }

  async user(params?: UserParams) {
    const id = this.userid();
    const user = await this.message.guild?.members.fetch(id)
      .catch(e => { throw new Error('Ошибка получения пользователя'); });
    if (!user) throw new Error(`Указанный пользователь не найден.`);
    if (params?.notMe && this.message.author.id === user.id) throw new Error(`Здесь нельзя указать себя`);
    if (params?.notBot && user.user.bot) throw new Error(`Здесь нельзя указать бота`);
    if (params?.noIgnore && this.voice.group.ignore?.includes(user.id)) throw new Error('Данного пользователя не существует для этой команды!');
    return user;
  }
}