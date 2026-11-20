import { BaseChannel, CategoryChannel, ChannelType, DiscordAPIError, GuildMember, RESTJSONErrorCodes, VoiceChannel, type Client } from "discord.js";
import { PRIVATES } from "../config";
import { configStore, PrivateGroup, trashStore } from "./PrivateGroup";
import { PrivateVoice } from "./PrivateVoice";

export class PrivateState {
  groups = new Set<PrivateGroup>();
  private nextTrashCheck = 0;

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
        config.multyChannel,
        config.ignore,
        config.trash && config.trashTime !== undefined
          ? { categoryId: config.trash, retention: config.trashTime }
          : undefined
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

        const ownerId = PrivateVoice.getOwner(voice);

        if (!ownerId)
          continue;

        const config = configStore.get(group.getId(ownerId));

        group.addVoice(voice, ownerId, new Set(config?.blocks ?? []), new Set(config?.mutes ?? []));

      }
    }

    if (!this.groups.size)
      throw new Error('You state is empty!');
  }

  async loop() {
    for (const group of this.groups)
      await group.loop();

    const now = Date.now();
    if (now < this.nextTrashCheck || !this.bot.isReady()) return;
    this.nextTrashCheck = now + 5000;

    for (const { key: channelId, value: entry } of [...trashStore.getRange()]) {
      if (entry.expiresAt > now) continue;

      const guild = this.bot.guilds.cache.get(entry.guildId);
      if (!guild?.available) continue;

      const channel = guild.channels.cache.get(channelId);
      if (channel?.type === ChannelType.GuildVoice && channel.parentId === entry.categoryId) {
        if (channel.members.size) continue;

        try {
          await channel.delete();
        } catch (error) {
          if (!(error instanceof DiscordAPIError) || error.code !== RESTJSONErrorCodes.UnknownChannel) {
            console.error(error);
            continue;
          }
        }
      }

      await trashStore.remove(channelId);
    }
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