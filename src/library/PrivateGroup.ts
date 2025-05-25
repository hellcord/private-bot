import { ChannelType, EmbedBuilder, GuildMember, VoiceChannel, type CategoryChannel, type OverwriteData } from "discord.js";

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

  async loop() {
    for (const create of this.create) {
      for (const [, member] of create.members) {
        const config = configStore.get(this.getId(member));
        const blocks = new Set(config?.blocks ?? []);
        const mutes = new Set(config?.mutes ?? []);

        const findChannel = this.multyChannel ? null : (
          [...this.voices].find(e => e.ownerId === member.id)?.voice ?? null
        );

        const channel = findChannel ?? await (
          async () => {
            let iterations = 3;

            while (--iterations) {
              try {
                return await this.root.guild.channels.create({
                  parent: this.root,
                  type: ChannelType.GuildVoice,
                  ...await PrivateVoice.getConfig(
                    this.getId(member),
                    member.id,
                    member.displayName,
                    this.root.guild
                  )
                });
              } catch (e) {
                configStore.removeSync(this.getId(member));
              }
            }

            throw new Error('Can not create voice');
          }
        )();

        if (member.voice.channel && member.voice.channelId === create.id)
          await member.voice.setChannel(channel);
        const voice = this.addVoice(channel, member, blocks, mutes);
        if (!voice.voice.messages.cache.size) await voice.welcomeMessage();
      }
    }

    for (const voice of this.voices)
      await voice.loop();
  }

  checkBlock(member: GuildMember) {
    this.voices.forEach(voice => {
      voice.checkBlock(member);
    });
  }
}