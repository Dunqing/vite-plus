import { setTimeout } from 'node:timers/promises';

// Poll only this workflow run. Conditional requests avoid charging unchanged
// responses against the repository token's REST API rate limit.
export async function waitForCiArtifacts({
  github,
  context,
  artifactNames,
  producerNames,
  timeoutMs = 30 * 60 * 1000,
  now = Date.now,
  sleep = setTimeout,
}) {
  if (artifactNames.length === 0 || producerNames.length === 0) {
    throw new Error('Artifact and producer names are required');
  }
  const responses = new Map();
  async function list(resource) {
    const items = [];
    for (let page = 1; ; page++) {
      const key = `${resource}/${page}`;
      const previous = responses.get(key);
      let response;
      try {
        response = await github.request(
          `GET /repos/{owner}/{repo}/actions/runs/{run_id}/${resource}`,
          {
            ...context.repo,
            run_id: context.runId,
            per_page: 100,
            page,
            ...(resource === 'jobs' ? { filter: 'latest' } : {}),
            headers: previous?.headers.etag ? { 'if-none-match': previous.headers.etag } : {},
          },
        );
      } catch (error) {
        if (error.status !== 304 || !previous) {
          throw error;
        }
        response = previous;
      }
      responses.set(key, response);
      items.push(...response.data[resource]);
      if (items.length >= response.data.total_count) {
        return items;
      }
    }
  }

  const deadline = now() + timeoutMs;
  let nextProducerCheck = 0;
  let finishedWithoutArtifactsAt;
  while (now() < deadline) {
    const artifacts = await list('artifacts');
    const selected = artifactNames.map((name) =>
      artifacts.find((artifact) => artifact.name === name && !artifact.expired),
    );
    if (selected.every(Boolean)) {
      return selected.map((artifact) => artifact.id);
    }

    if (now() >= nextProducerCheck) {
      const jobs = await list('jobs');
      const producers = jobs.filter((job) =>
        producerNames.some((name) => job.name === name || job.name.endsWith(` / ${name}`)),
      );
      const failed = producers.find(
        (job) => job.status === 'completed' && job.conclusion !== 'success',
      );
      if (failed) {
        throw new Error(`Artifact producer ${failed.name} finished with ${failed.conclusion}`);
      }
      if (
        producerNames.every((name) =>
          producers.some(
            (job) =>
              (job.name === name || job.name.endsWith(` / ${name}`)) && job.status === 'completed',
          ),
        )
      ) {
        finishedWithoutArtifactsAt ??= now();
        if (now() - finishedWithoutArtifactsAt >= 30_000) {
          throw new Error('Artifact producers succeeded, but required artifacts are missing');
        }
      }
      nextProducerCheck = now() + 30_000;
    }
    await sleep(Math.min(10_000, Math.max(0, deadline - now())));
  }
  throw new Error(`Timed out waiting for CI artifacts: ${artifactNames.join(', ')}`);
}
