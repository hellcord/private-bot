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
    public deleteTimeout: number,
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

        let channel = [...this.voices].find(e => e.ownerId === member.id)?.voice ?? await (
          async () => {
            const channel = await this.root.guild.channels.create({
              name: config?.name ?? member.displayName ?? member.user.displayName,
              bitrate: config?.bitrate ?? undefined,
              rtcRegion: config?.region ?? undefined,
              userLimit: config?.limit ?? undefined,
              nsfw: config?.nsfw ?? undefined,
              videoQualityMode: config?.video ?? undefined,
              parent: this.root,
              type: ChannelType.GuildVoice,
              permissionOverwrites: [
                {
                  id: member.id,
                  allow: ['ManageChannels', 'MoveMembers', 'ManageMessages']
                },
                ...blocks.map(
                  id => ({
                    id,
                    deny: ['Connect', 'SendMessages']
                  } as OverwriteData)
                )
              ]
            });

            if (!channel.messages.cache.size)
              await channel.send({
                content: member.toString(),
                embeds: [
                  new EmbedBuilder()
                    .setTitle("Ваш голосовой канал создан.")
                    .setURL("https://github.com/vicimpa/hellcord-private")
                    .setDescription("**Вы можете блокировать неугодных пользователей.**\n\n- `!ban [user]` - Перманентная блокировка пользователя.\n- `!block [user]` - Блокировка пользователя до пересоздания комнаты.\n- `!revoke [user]` - Разблокировать пользователя.\n- `!list` - Вывести список пользователей в блокировке.")
                    .setColor("#00b0f4")
                    .setTimestamp()
                ]
              });

            return channel;
          }
        )();
        await member.voice.setChannel(channel);
        this.addVoice(channel, member, blocks);
      }
    }

    for (const voice of this.voices)
      await voice.loop();
  }
}