import { afterAll, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CategoryChannel, ChannelType, Collection, type Client, type VoiceChannel } from 'discord.js';
import { PRIVATES } from '../config';

const directory = mkdtempSync(join(tmpdir(), 'private-bot-trash-test-'));
const previousDirectory = process.cwd();
let groupLibrary: typeof import('./PrivateGroup');
let stateLibrary: typeof import('./PrivateState');
try {
  process.chdir(directory);
  groupLibrary = await import('./PrivateGroup');
  stateLibrary = await import('./PrivateState');
} finally {
  process.chdir(previousDirectory);
}
const { trashStore } = groupLibrary;
const { PrivateState } = stateLibrary;

const config = PRIVATES.find(config => config.trash && config.trashTime !== undefined)!;

function setup() {
  const cache = new Collection();
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

  const bot = { guilds: { cache: new Collection([[guild.id, guild]]) }, isReady: () => true };
  const restart = () => new PrivateState(bot as unknown as Client);
  const state = restart();
  const group = [...state.groups][0]!;
  const voice = group.addVoice(channel as unknown as VoiceChannel, 'owner', new Set(), new Set());
  voice.time = performance.now() - group.deleteTimeout - 1;

  return { channel, group, restart, root, state, trash, voice };
}

afterAll(() => {
  process.once('exit', () => rmSync(directory, { recursive: true, force: true }));
});

test('archives a room and deletes it after its saved deadline once it is empty', async () => {
  const { channel, group, restart, state, trash, voice } = setup();
  const startedAt = Date.now();
  await state.loop();

  expect(channel.setParent).toHaveBeenCalledWith(trash, { lockPermissions: true });
  expect(group.voices.has(voice)).toBe(false);
  expect(channel.delete).not.toHaveBeenCalled();
  const entry = trashStore.get(channel.id)!;
  expect(entry.expiresAt).toBeGreaterThanOrEqual(startedAt + config.trashTime!);

  await restart().loop();
  expect(channel.delete).not.toHaveBeenCalled();

  await trashStore.put(channel.id, { ...entry, expiresAt: Date.now() - 1 });
  channel.members.set('member', {});
  await restart().loop();
  expect(channel.delete).not.toHaveBeenCalled();

  channel.members.clear();
  await restart().loop();
  expect(channel.delete).toHaveBeenCalledTimes(1);
  expect(trashStore.get(channel.id)).toBeUndefined();
});

test('leaves rooms that have been moved out of the trash category alone', async () => {
  const { channel, restart, root, state } = setup();
  await state.loop();
  const entry = trashStore.get(channel.id)!;
  await trashStore.put(channel.id, { ...entry, expiresAt: Date.now() - 1 });
  channel.parentId = root.id;

  await restart().loop();
  expect(channel.delete).not.toHaveBeenCalled();
  expect(trashStore.get(channel.id)).toBeUndefined();
});

test('still deletes empty rooms directly when trash is disabled', async () => {
  const { channel, group, voice } = setup();
  group.trash = undefined;

  await voice.loop();
  expect(channel.setParent).not.toHaveBeenCalled();
  expect(channel.delete).toHaveBeenCalledTimes(1);
});
