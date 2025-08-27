import { ArgumentsParser } from "./ArgumentsParser";
import { PrivateCommands } from "./PrivateCommands";
import { configStore, type PrivateGroup } from "./PrivateGroup";
import { EmbedBuilder, Guild, GuildMember, Message, type OverwriteData, type PermissionResolvable, type VoiceChannel } from "discord.js";

export type VoiceConfig = ReturnType<PrivateVoice['saveConfig']>;

export class PrivateVoice {
  work = true;
  time = 0;

  get id() {
    return this.group.getId(this.ownerId);
  }

  get owner() {
    return this.voice.guild.members.cache.get(this.ownerId);
  }

  get count() {
    return this.voice.members.size;
  }

  constructor(
    public group: PrivateGroup,
    public voice: VoiceChannel,
    public ownerId: string,
    public deleteTimeout: number,
    public blocks: Set<string>,
    public mutes: Set<string>
  ) { }

  async transfer(newOwner: GuildMember) {
    this.ownerId = newOwner.id;

    const store = configStore.get(this.id);

    this.blocks = new Set(store?.blocks ?? []);
    this.mutes = new Set(store?.mutes ?? []);

    const config = await PrivateVoice.getConfig(
      this.id,
      this.ownerId,
      newOwner.displayName,
      this.voice.guild
    )

    console.log('Start edit')
    await this.voice.edit(config)
    console.log('End edit')
  }

  async delete(ignore = false) {
    if (!this.work) return;
    this.work = false;
    this.group.voices.delete(this);
    if (ignore) return;
    let attempts = 3;
    while (attempts--) {
      try {
        await this.voice.delete();
        return;
      } catch (e) {
        console.log(e, { attempts });
      }
    }
  }

  saveConfig() {
    return {
      name: this.voice.name,
      bitrate: this.voice.bitrate,
      limit: this.voice.userLimit,
      region: this.voice.rtcRegion,
      nsfw: this.voice.nsfw,
      video: this.voice.videoQualityMode,
      blocks: [...this.blocks],
      mutes: [...this.mutes]
    };
  }

  getBlockList() {
    return this.voice.permissionOverwrites.cache.filter(user => {
      return user.deny.has('Connect');
    }).map(user => user.id);
  }

  async runCommand(message: Message, owner: boolean) {
    const parser = new ArgumentsParser(message);
    const command = parser.command();
    try {
      const cmd = PrivateCommands[command];
      if (!cmd)
        throw new Error(`Введенная команда не существует`);

      if (!owner && !cmd.forModerator)
        throw new Error('Эта команда только для владельцев канала');

      const content = await cmd?.exec(this, parser);
      if (content) await message.reply(content);
    } catch (e) {
      await message.reply(`Error: ${e instanceof Error ? e.message : `${e}`}`);
    }
  }

  async updateConfig() {
    await configStore.put(this.id, this.saveConfig());
  }

  async checkBlock(member: GuildMember) {
    if (this.blocks.has(member.id))
      await this.block(member);
    if (this.mutes.has(member.id))
      await this.mute(member);
  }

  async block(user: GuildMember) {
    await this.voice.permissionOverwrites.edit(user, {
      Connect: false,
      SendMessages: false
    });
    if (user.voice.channel === this.voice)
      await user.voice.disconnect();
  }

  async unblock(user: GuildMember | string) {
    await this.voice.permissionOverwrites.edit(user, {
      Connect: null,
      SendMessages: null
    });
  }

  async mute(user: GuildMember | string) {
    await this.voice.permissionOverwrites.edit(user, {
      Speak: false
    });
  }

  async unmute(user: GuildMember | string) {
    await this.voice.permissionOverwrites.edit(user, {
      Speak: null
    });
  }


  async reset() {
    await this.voice.permissionOverwrites.set([
      ...await PrivateVoice.getDefaultPermissions(this.ownerId, [...this.blocks], [...this.mutes], this.voice.guild)
    ]);
  }

  async welcomeMessage() {
    const commands = Object.keys(PrivateCommands).map(key => {
      const cmd = PrivateCommands[key];
      const a = cmd.args?.map(e => ` [${e}]`).join('') ?? '';
      const m = cmd.forModerator ? ' 💥' : '';
      return `- \`!${key}${a}\`${m} - ${cmd.title}`;
    }).join('\n');

    await this.voice.send({
      embeds: [
        new EmbedBuilder()
          .setTitle("Ваш голосовой канал создан.")
          .setURL("https://github.com/vicimpa/hellcord-private")
          .setDescription(`**Вы можете блокировать неугодных пользователей.**\n\n${commands}`)
          .setColor("#00b0f4")
          .setTimestamp()
      ]
    });
  }

  async loop() {
    if (!this.work)
      return;

    if (!this.time && !this.count)
      this.time = performance.now();
    if (this.time && this.count)
      this.time = 0;

    if (!this.time)
      return;

    const timeout = performance.now() - this.time;

    if (timeout > this.deleteTimeout) {
      await this.delete();
    }
  }

  static async getConfig(id: string, ownerId: string, defaultName: string, guild: Guild) {
    const config = configStore.get(id);
    const blocks = config?.blocks ?? [];
    const mutes = config?.mutes ?? [];

    return {
      name: config?.name ?? defaultName,
      // bitrate: config?.bitrate ?? undefined,
      rtcRegion: config?.region ?? undefined,
      userLimit: config?.limit ?? undefined,
      nsfw: config?.nsfw ?? undefined,
      videoQualityMode: config?.video ?? undefined,
      permissionOverwrites: await PrivateVoice.getDefaultPermissions(ownerId, blocks, mutes, guild)
    };
  }

  static async getDefaultPermissions(ownerId: string, blocks: string[], mutes: string[], guild: Guild): Promise<OverwriteData[]> {
    const allblocks = [...blocks, ...mutes].filter((e, i, d) => d.indexOf(e) === i);
    const users = await guild.members.fetch({ user: allblocks });

    return [
      {
        id: ownerId,
        allow: [
          'ManageChannels',
          'MoveMembers',
          'ManageMessages',
          'UseEmbeddedActivities',
          'UseExternalApps',
          'MuteMembers'
        ]
      },
      ...allblocks
        .filter(id => users.has(id))
        .map<OverwriteData>(
          id => ({
            id,
            deny: [
              ...(blocks.includes(id) ? ['Connect', 'SendMessages', 'ViewChannel'] : []) as PermissionResolvable[],
              ...(mutes.includes(id) ? ['Speak'] : []) as PermissionResolvable[]
            ]
          })
        )
    ];
  }
}