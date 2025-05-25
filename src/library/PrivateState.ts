import { BaseChannel, CategoryChannel, ChannelType, GuildMember, VoiceChannel, type Client } from "discord.js";
import { PRIVATES } from "../config";
import { configStore, PrivateGroup } from "./PrivateGroup";

export class PrivateState {
  groups = new Set<PrivateGroup>();

  constructor(public bot: Client) {
    for (const config of PRIVATES) {
      // Fetch guild
      const guild = bot.guilds.cache.get(config.guildId);
      if (!guild) {
        continue;
      }

      // Fetch root
      const root = guild.channels.cache.get(config.categoryId);
      if (!root || !(root instanceof CategoryChannel)) {
        continue;
      }

      // Fetch create
      const create = config.createVoiceIds.reduce((acc, id) => {
        const channel = guild.channels.cache.get(id);
        if (!channel || !(channel instanceof VoiceChannel))
          return acc;
        return [...acc, channel];
      }, [] as VoiceChannel[]);

      const group = new PrivateGroup(
        root,
        create,
        config.deleteTimeout,
        config.multyChannel
      );

      this.groups.add(group);

      const channels = guild.channels.cache.filter((channel) => {
        if (channel.parent !== root)
          return false;

        if (!(channel instanceof VoiceChannel))
          return false;

        return true;
      });

      for (const [id, voice] of channels) {
        if (!(voice instanceof VoiceChannel))
          continue;

        const ownerPerm = voice.permissionOverwrites.cache.find((perm, id) => {
          return perm.allow.has('ManageChannels') && !guild.members.cache.get(id)?.user.bot;
        });


        if (!ownerPerm)
          continue;

        const id = group.getId(ownerPerm.id);
        const config = configStore.get(id);

        group.addVoice(voice, ownerPerm.id, new Set(config?.blocks ?? []));

      }
    }

    if (!this.groups.size)
      throw new Error('You state is empty!');
  }

  async loop() {
    for (const group of this.groups)
      await group.loop();
  }

  getVoice(channel: BaseChannel) {
    if (channel.type !== ChannelType.GuildVoice) return;

    for (const group of this.groups) {
      for (const voice of group.voices) {
        if (voice.voice === channel) {
          return voice;
        }
      }
    }

    return;
  }

  checkBlock(member: GuildMember) {
    this.groups.forEach(group => {
      group.checkBlock(member);
    });
  }
}