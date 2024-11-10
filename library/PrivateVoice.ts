import type { PrivateGroup } from "./PrivateGroup";
import { type VoiceChannel } from "discord.js";

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

  delete(ignore = false) {
    if (!this.work) return;
    this.work = false;
    this.group.voices.delete(this);
    if (ignore) return;
    this.voice.delete()
      .catch(console.log);
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
      this.delete();
    }
  }
}