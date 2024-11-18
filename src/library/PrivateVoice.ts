import { ArgumentsParser } from "./ArgumentsParser";
import { PrivateCommands } from "./PrivateCommands";
import { configStore, type PrivateGroup } from "./PrivateGroup";
import { EmbedBuilder, GuildMember, Message, type OverwriteData, type VoiceChannel } from "discord.js";

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
    public blocks: string[] = []
  ) { }

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
      blocks: this.blocks
    };
  }

  ban(id: string) {
    const index = this.blocks.indexOf(id);
    if (index === -1)
      this.blocks.push(id);
  }

  unban(id: string) {
    const index = this.blocks.indexOf(id);
    if (index !== -1)
      this.blocks.splice(index, 1);
  }

  async runCommand(message: Message) {
    const parser = new ArgumentsParser(message);
    const command = parser.command();
    try {
      const content = await PrivateCommands[command]?.exec(this, parser);
      if (content) await message.reply(content);
    } catch (e) {
      await message.reply(`Error: ${e instanceof Error ? e.message : `${e}`}`);
    }
  }

  getBlockUsersIds() {
    return this.voice.permissionOverwrites.cache
      .filter(perm => {
        return perm.deny.has('Connect') && perm.deny.has('SendMessages');
      })
      .map(perm => {
        return perm.id;
      });
  }

  async updateConfig() {
    await configStore.put(this.id, this.saveConfig());
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

  async unblockall() {
    await this.voice.permissionOverwrites.set([
      ...PrivateVoice.getDefaultPermissions(this.ownerId, [])
    ]);
  }

  async welcomeMessage() {
    const commands = Object.keys(PrivateCommands).map(key => {
      const cmd = PrivateCommands[key];
      return `- \`!${key}${cmd.args?.map(e => ` [${e}]`).join('') ?? ''}\` - ${cmd.title}`;
    }).join('\n');

    await this.voice.send({
      content: `<@${this.ownerId}>`,
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

  static getDefaultPermissions(ownerId: string, blocks: string[] = []): OverwriteData[] {
    return [
      {
        id: ownerId,
        allow: ['ManageChannels', 'MoveMembers', 'ManageMessages']
      },
      ...blocks.map(
        id => ({
          id,
          deny: ['Connect', 'SendMessages']
        } as OverwriteData)
      )
    ];
  }
}