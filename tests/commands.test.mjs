import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, mkdir, symlink, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const cli = resolve('skills/autopilot/scripts/autopilot.mjs');
const run = (...args) => spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });

test('creates and resolves a reusable definition without executing it or overwriting', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ap-command-'));
  const purpose = 'Research live robotics sources.\nDo not execute: touch sentinel';
  const made = run('makecommand', '--project', root, '--name', 'robot-research', '--purpose', purpose);
  assert.equal(made.status, 0, made.stderr);
  const definition = await readFile(join(root, '.autopilot/commands/robot-research.md'), 'utf8');
  assert.ok(definition.endsWith(purpose + '\n'));
  const resolved = run('run', '--project', root, '--name', 'robot-research');
  assert.equal(resolved.status, 0, resolved.stderr);
  assert.equal(JSON.parse(resolved.stdout).definition, definition);
  assert.notEqual(run('makecommand', '--project', root, '--name', 'robot-research', '--purpose', 'replace').status, 0);
  assert.equal(await readFile(join(root, '.autopilot/commands/robot-research.md'), 'utf8'), definition);
  assert.deepEqual((await readdir(root)).sort(), ['.autopilot']);
});

test('rejects traversal, reserved names, blank requests, unknown flags and obvious credentials', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ap-command-invalid-'));
  for (const name of ['../outside', '/absolute', 'UPPER', 'a/b', 'help', 'frc', 'makecommand', 'research', 'con', 'a'.repeat(65)]) {
    assert.notEqual(run('makecommand', '--project', root, '--name', name, '--purpose', 'test').status, 0, name);
  }
  for (const purpose of ['', '  ', '-----BEGIN ' + 'PRIVATE KEY-----']) {
    assert.notEqual(run('makecommand', '--project', root, '--name', 'valid', '--purpose', purpose).status, 0);
  }
  assert.notEqual(run('makecommand', '--project', root, '--name', 'valid', '--purpose', 'test', '--unknown', 'x').status, 0);
  assert.notEqual(run('run', '--project', root, '--name', 'missing').status, 0);
});

test('refuses symlink command directories and does not write outside project', async t => {
  const root = await mkdtemp(join(tmpdir(), 'ap-command-link-'));
  const project = join(root, 'project'), outside = join(root, 'outside');
  await mkdir(join(project, '.autopilot'), { recursive: true }); await mkdir(outside);
  try { await symlink(outside, join(project, '.autopilot/commands'), process.platform === 'win32' ? 'junction' : 'dir'); }
  catch (error) { if (error.code === 'EPERM') return t.skip('host blocks test symlink'); throw error; }
  assert.notEqual(run('makecommand', '--project', project, '--name', 'test', '--purpose', 'test').status, 0);
  assert.deepEqual(await readdir(outside), []);
});

test('frc routing reports missing dependency instead of pretending CAD is connected', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ap-frc-'));
  const result = run('frc', '--skill-root', root);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).status, 'missing-skill');
  assert.equal(JSON.parse(result.stdout).connected, false);
});
