import { ChannelType, GuildMember, VoiceChannel, type CategoryChannel } from "discord.js";

import { PrivateVoice, type VoiceConfig } from "./PrivateVoice";
import { open } from "lmdb";

export const configStore = open<VoiceConfig, string>({
  path: './configs',
  compression: true
});

export class PrivateGroup {
  voices = new Set<PrivateVoice>();

  constructor(
    public root: CategoryChannel,
    public create: VoiceChannel[],
    public deleteTimeout = 500,
    public multyChannel = false,
    public ignore?: string[]
  ) { }

  addVoice(voice: VoiceChannel, owner: GuildMember | string, blocks: Set<string>, mutes: Set<string>) {
    const newVoice = new PrivateVoice(
      this,
      voice,
      owner instanceof GuildMember ? owner.id : owner,
      this.deleteTimeout,
      blocks,
      mutes
    );
    this.voices.add(newVoice);
    return newVoice;
  }

  getId(owner: GuildMember | string) {
    if (owner instanceof GuildMember)
      owner = owner.id;

    return [
      this.root.guild.id,
      this.root.id,
      owner
    ].join(':');
  }

  async createChannel(member: GuildMember) {
    const attempts = 3;

    for (let i = 0; i < attempts; i++) {
      try {
        return await this.root.guild.channels.create({
          parent: this.root,
          type: ChannelType.GuildVoice,
          ...await PrivateVoice.getConfig(
            this.getId(member),
            member.id,
            member.displayName,
            this.root.guild,
            // Последняя попытка без сохранённых настроек (имя, регион и т.п.),
            // блокировки и мьюты при этом сохраняются
            i < attempts - 1
          )
        });
      } catch (e) {
        console.error(e);
      }
    }

    throw new Error('Can not create voice');
  }

  async moveToChannel(member: GuildMember, create: VoiceChannel) {
    const existing = this.multyChannel ? undefined : (
      [...this.voices].find(e => e.ownerId === member.id)
    );

    if (existing) {
      if (member.voice.channelId === create.id)
        await member.voice.setChannel(existing.voice);
      return;
    }

    const config = configStore.get(this.getId(member));
    const channel = await this.createChannel(member);
    const voice = this.addVoice(
      channel,
      member,
      new Set(config?.blocks ?? []),
      new Set(config?.mutes ?? [])
    );

    if (member.voice.channelId === create.id)
      await member.voice.setChannel(channel);
    if (!voice.voice.messages.cache.size) await voice.welcomeMessage();
  }

  async loop() {
    for (const create of this.create) {
      for (const [, member] of create.members) {
        await this.moveToChannel(member, create)
          .catch(console.error);
      }
    }

    for (const voice of this.voices)
      await voice.loop().catch(console.error);
  }

  checkBlock(member: GuildMember) {
    this.voices.forEach(voice => {
      voice.checkBlock(member);
    });
  }
}