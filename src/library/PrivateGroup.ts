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

  addVoice(voice: VoiceChannel, owner: GuildMember | string, blocks: string[] = []) {
    const newVoice = new PrivateVoice(
      this,
      voice,
      owner instanceof GuildMember ? owner.id : owner,
      this.deleteTimeout,
      blocks
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
        const blocks = config?.blocks ?? [];

        const findChannel = this.multyChannel ? null : (
          [...this.voices].find(e => e.ownerId === member.id)?.voice ?? null
        );

        const channel = findChannel ?? await (
          async () => {
            return await this.root.guild.channels.create({
              name: config?.name ?? member.displayName ?? member.user.displayName,
              bitrate: config?.bitrate ?? undefined,
              rtcRegion: config?.region ?? undefined,
              userLimit: config?.limit ?? undefined,
              nsfw: config?.nsfw ?? undefined,
              videoQualityMode: config?.video ?? undefined,
              parent: this.root,
              type: ChannelType.GuildVoice,
              permissionOverwrites: await PrivateVoice.getDefaultPermissions(member.id, blocks, this.root.guild)
            });
          }
        )();

        if (member.voice.channel)
          await member.voice.setChannel(channel);
        const voice = this.addVoice(channel, member, blocks);
        if (!voice.voice.messages.cache.size) await voice.welcomeMessage();
      }
    }

    for (const voice of this.voices)
      await voice.loop();
  }
}