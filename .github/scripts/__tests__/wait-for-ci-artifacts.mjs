import assert from 'node:assert/strict';
import { test } from 'node:test';

import { waitForCiArtifacts } from '../wait-for-ci-artifacts.mjs';

function fixture() {
  const state = { elapsed: 0, artifacts: [], jobs: [], calls: [], sleeps: 0 };
  const context = { repo: { owner: 'owner', repo: 'repo' }, runId: 123 };
  const github = {
    async request(route, params) {
      assert.equal(params.owner, 'owner');
      assert.equal(params.repo, 'repo');
      assert.equal(params.run_id, 123);
      const resource = route.split('/').at(-1);
      const items = state[resource];
      const page = items.slice((params.page - 1) * 100, params.page * 100);
      const data = { total_count: items.length, [resource]: page };
      const etag = JSON.stringify(data);
      state.calls.push({ resource, params });
      if (params.headers['if-none-match'] === etag) {
        throw Object.assign(new Error('Not modified'), { status: 304 });
      }
      return { data, headers: { etag } };
    },
  };
  const options = {
    github,
    context,
    artifactNames: ['native', 'snapshots'],
    producerNames: ['Build native', 'Build snapshots'],
    timeoutMs: 60_000,
    now: () => state.elapsed,
    async sleep(ms) {
      state.elapsed += ms;
      state.sleeps++;
      state.onSleep?.();
    },
  };
  return { state, options };
}

test('waits for both non-expired artifacts from the current run', async () => {
  const { state, options } = fixture();
  state.artifacts = [
    { name: 'native', id: 1 },
    { name: 'snapshots', id: 2, expired: true },
  ];
  state.onSleep = () => {
    if (state.sleeps === 2) {
      state.artifacts.push({ name: 'snapshots', id: 3 });
    }
  };
  assert.deepEqual(await waitForCiArtifacts(options), [1, 3]);
  assert.equal(state.elapsed, 20_000);
  assert.ok(state.calls.some((call) => call.params.headers['if-none-match']));
});

test('finds artifacts on later pages and reuses available artifacts on a retry', async () => {
  const { state, options } = fixture();
  state.artifacts = Array.from({ length: 100 }, (_, id) => ({ name: `other-${id}`, id }));
  state.artifacts.push({ name: 'snapshots', id: 101 }, { name: 'native', id: 102 });
  assert.deepEqual(await waitForCiArtifacts(options), [102, 101]);
  assert.equal(state.elapsed, 0);
  assert.equal(state.calls.length, 2);
  assert.ok(state.calls.every((call) => call.resource === 'artifacts'));
});

for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out']) {
  test(`stops when a producer is ${conclusion}`, async () => {
    const { state, options } = fixture();
    state.jobs = [{ name: 'after / Build native', status: 'completed', conclusion }];
    await assert.rejects(waitForCiArtifacts(options), new RegExp(`finished with ${conclusion}`));
    assert.equal(state.sleeps, 0);
  });
}

test('ignores unrelated failed jobs while the selected producers run', async () => {
  const { state, options } = fixture();
  state.jobs = [{ name: 'Build something else', status: 'completed', conclusion: 'failure' }];
  state.onSleep = () => {
    state.artifacts = [
      { name: 'native', id: 1 },
      { name: 'snapshots', id: 2 },
    ];
  };
  assert.deepEqual(await waitForCiArtifacts(options), [1, 2]);
});

test('bounds the wait when a producer is missing or queued', async () => {
  const { state, options } = fixture();
  options.timeoutMs = 25_000;
  state.jobs = [{ name: 'Build native', status: 'queued', conclusion: null }];
  await assert.rejects(waitForCiArtifacts(options), /Timed out waiting/);
  assert.equal(state.elapsed, 25_000);
});

test('allows artifact visibility to catch up after successful producers', async () => {
  const { state, options } = fixture();
  state.jobs = options.producerNames.map((name) => ({
    name,
    status: 'completed',
    conclusion: 'success',
  }));
  state.onSleep = () => {
    state.artifacts = [
      { name: 'native', id: 1 },
      { name: 'snapshots', id: 2 },
    ];
  };
  assert.deepEqual(await waitForCiArtifacts(options), [1, 2]);
});

test('fails if successful producers did not publish their artifacts', async () => {
  const { state, options } = fixture();
  state.jobs = options.producerNames.map((name) => ({
    name,
    status: 'completed',
    conclusion: 'success',
  }));
  await assert.rejects(waitForCiArtifacts(options), /required artifacts are missing/);
  assert.equal(state.elapsed, 30_000);
});

test('propagates API errors instead of silently using stale data', async () => {
  const { options } = fixture();
  const error = Object.assign(new Error('Forbidden'), { status: 403 });
  options.github.request = async () => {
    throw error;
  };
  await assert.rejects(waitForCiArtifacts(options), error);
});

test('rejects empty artifact or producer lists', async () => {
  for (const key of ['artifactNames', 'producerNames']) {
    const { options } = fixture();
    options[key] = [];
    await assert.rejects(waitForCiArtifacts(options), /names are required/);
  }
});
