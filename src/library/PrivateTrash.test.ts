import { afterAll, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CategoryChannel, ChannelType, Collection, type Client, type VoiceChannel } from 'discord.js';
import { PRIVATES } from '../config';

const directory = mkdtempSync(join(tmpdir(), 'private-bot-trash-test-'));
const previousDirectory = process.cwd();
let stateLibrary: typeof import('./PrivateState');
try {
  process.chdir(directory);
  stateLibrary = await import('./PrivateState');
} finally {
  process.chdir(previousDirectory);
}
const { PrivateState } = stateLibrary;

const config = PRIVATES.find(config => config.trash)!;

function setup() {
  const cache = new Collection<string, { parentId: string | null }>();
  const guild = {
    id: config.guildId, available: true,
    channels: { cache, resolve: (id: string) => cache.get(id) }
  };
  const category = (id: string) => Object.assign(Object.create(CategoryChannel.prototype), {
    id, guild, type: ChannelType.GuildCategory, parentId: null
  }) as CategoryChannel;
  const root = category(config.categoryId);
  const trash = category(config.trash!);
  guild.channels.cache.set(root.id, root).set(trash.id, trash);

  const channel = {
    id: 'private-room',
    guild,
    type: ChannelType.GuildVoice,
    parentId: root.id,
    members: new Collection(),
    setParent: mock(async (parent: CategoryChannel, _options: { lockPermissions: boolean }) => {
      channel.parentId = parent.id;
    }),
    delete: mock(async () => { guild.channels.cache.delete(channel.id); })
  };
  guild.channels.cache.set(channel.id, channel);

  const bot = { guilds: { cache: new Collection([[guild.id, guild]]) } };
  const state = new PrivateState(bot as unknown as Client);
  const group = [...state.groups][0]!;
  const voice = group.addVoice(channel as unknown as VoiceChannel, 'owner', new Set(), new Set());
  voice.time = performance.now() - group.deleteTimeout - 1;

  function archived(createdTimestamp: number, type = ChannelType.GuildVoice) {
    const id = `archived-${createdTimestamp}`;
    const room = {
      id,
      parentId: trash.id,
      type,
      createdTimestamp,
      members: new Collection(),
      delete: mock(async () => { cache.delete(id); })
    };
    cache.set(id, room);
    return room;
  }

  return { archived, channel, group, root, state, trash, voice };
}

afterAll(() => {
  process.once('exit', () => rmSync(directory, { recursive: true, force: true }));
});

test('fills the last archive slot without deleting an existing channel', async () => {
  const { archived, channel, group, state, trash, voice } = setup();
  const oldest = archived(1);
  for (let i = 2; i <= 49; i++) archived(i);
  await state.loop();

  expect(channel.setParent).toHaveBeenCalledWith(trash, { lockPermissions: true });
  expect(group.voices.has(voice)).toBe(false);
  expect(channel.delete).not.toHaveBeenCalled();
  expect(oldest.delete).not.toHaveBeenCalled();
  expect(trash.children.cache.size).toBe(50);
});

test('deletes the oldest empty voice channel before archiving into a full category', async () => {
  const { archived, channel, root, state, trash } = setup();
  const newer = archived(20);
  const oldest = archived(10);
  const occupied = archived(3);
  occupied.members.set('member', {});
  const text = archived(2, ChannelType.GuildText);
  const outside = archived(1);
  outside.parentId = root.id;
  for (let i = 21; i <= 66; i++) archived(i);
  channel.setParent.mockImplementationOnce(async (parent) => {
    expect(trash.children.cache.has(oldest.id)).toBe(false);
    channel.parentId = parent.id;
  });

  await state.loop();

  expect(oldest.delete).toHaveBeenCalledTimes(1);
  expect(newer.delete).not.toHaveBeenCalled();
  expect(occupied.delete).not.toHaveBeenCalled();
  expect(text.delete).not.toHaveBeenCalled();
  expect(outside.delete).not.toHaveBeenCalled();
  expect(channel.setParent).toHaveBeenCalledWith(trash, { lockPermissions: true });
  expect(trash.children.cache.size).toBe(50);
});

test('keeps the incoming room tracked if a full category has no empty voice channels', async () => {
  const { archived, channel, group, state, voice } = setup();
  for (let i = 1; i <= 50; i++) archived(i).members.set('member', {});

  await state.loop();

  expect(channel.setParent).not.toHaveBeenCalled();
  expect(channel.delete).not.toHaveBeenCalled();
  expect(group.voices.has(voice)).toBe(true);
});

test('does not delete another room on retry if a failed move already freed a slot', async () => {
  const { archived, channel, group, trash, voice } = setup();
  const oldest = archived(1);
  const next = archived(2);
  for (let i = 3; i <= 50; i++) archived(i);
  channel.setParent.mockRejectedValueOnce(new Error('Move failed'));

  await expect(group.archiveVoice(voice.voice)).rejects.toThrow('Move failed');
  expect(trash.children.cache.size).toBe(49);
  expect(await group.archiveVoice(voice.voice)).toBe(true);
  expect(oldest.delete).toHaveBeenCalledTimes(1);
  expect(next.delete).not.toHaveBeenCalled();
  expect(trash.children.cache.size).toBe(50);
});

test('still deletes empty rooms directly when trash is disabled', async () => {
  const { channel, group, voice } = setup();
  group.trashCategoryId = undefined;

  await voice.loop();
  expect(channel.setParent).not.toHaveBeenCalled();
  expect(channel.delete).toHaveBeenCalledTimes(1);
});
