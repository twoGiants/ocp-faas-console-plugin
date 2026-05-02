import { http, HttpResponse } from 'msw';
import { server } from '../../../testing/msw/server';
import { GithubService } from './GithubService';
import { FileEntry, RepoMetadata } from '../types';

const GITHUB_API = 'https://api.github.com';
const GH_SEARCH_REPOS = `${GITHUB_API}/search/repositories`;

describe('GithubService', () => {
  describe('listFunctionRepos', () => {
    it('lists function repos tagged with serverless-function topic', async () => {
      setupGithubSearchReposResponse();

      const svc = new GithubService(() => 'pat');
      const repos: RepoMetadata[] = await svc.listFunctionRepos();

      expect(repos).toEqual([
        {
          owner: 'twoGiants',
          name: 'my-func',
          url: 'https://github.com/twoGiants/my-func',
          defaultBranch: 'main',
        },
      ]);

      function setupGithubSearchReposResponse() {
        server.use(
          http.get(GH_SEARCH_REPOS, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('q')).toBe('topic:serverless-function user:twoGiants');
            return HttpResponse.json({
              total_count: 1,
              items: [
                {
                  owner: { login: 'twoGiants' },
                  name: 'my-func',
                  html_url: 'https://github.com/twoGiants/my-func',
                  default_branch: 'main',
                },
              ],
            });
          }),
        );
      }
    });
  });

  describe('fetchFileContent', () => {
    it('fetches file content from a repo', async () => {
      setupFileContentResponse();

      const svc = new GithubService(() => 'pat');
      const content = await svc.fetchFileContent(
        {
          owner: 'twoGiants',
          name: 'my-func',
          url: 'https://github.com/twoGiants/my-func',
          defaultBranch: 'main',
        },
        'func.yaml',
      );

      expect(content).toBe('name: my-func\nruntime: go\n');

      function setupFileContentResponse() {
        server.use(
          http.get(`${GITHUB_API}/repos/twoGiants/my-func/contents/func.yaml`, () =>
            HttpResponse.json({
              content: btoa('name: my-func\nruntime: go\n'),
              encoding: 'base64',
            }),
          ),
        );
      }
    });

    it('throws when path is not a file', async () => {
      setupDirectoryResponse();

      const svc = new GithubService(() => 'pat');

      await expect(
        svc.fetchFileContent(
          { owner: 'twoGiants', name: 'my-func', url: '', defaultBranch: 'main' },
          'src',
        ),
      ).rejects.toThrow('src is not a file');

      function setupDirectoryResponse() {
        server.use(
          http.get(`${GITHUB_API}/repos/twoGiants/my-func/contents/src`, () =>
            HttpResponse.json([{ name: 'index.js', type: 'file' }]),
          ),
        );
      }
    });
  });

  describe('createRepo', () => {
    const repoInfo: RepoMetadata = {
      owner: 'twoGiants',
      name: 'my-func',
      url: '',
      defaultBranch: 'main',
    };
    const files: FileEntry[] = [
      { path: 'func.yaml', mode: '100644', content: 'name: my-func', type: 'blob' },
    ];

    it('throws when repo already exists', async () => {
      setupCreateRepoHandlers();

      const svc = new GithubService(() => 'pat');

      await expect(svc.createRepo(repoInfo, files, 'Initial commit')).rejects.toThrow(
        "repository 'my-func' exists",
      );
    });

    it('creates repo, sets topic, pushes files, does not rename branch when main', async () => {
      const result = setupCreateRepoHandlers({ repoMissing: true });

      const svc = new GithubService(() => 'pat');
      await svc.createRepo(repoInfo, files, 'Initial commit');

      expect(result.repoCreated()).toBe(true);
      expect(result.topicsSet()).toEqual(['serverless-function']);
      expect(result.refUpdated()).toBe(true);
      expect(result.branchRenamed()).toBe(false);
    });

    it('renames branch when defaultBranch is not main', async () => {
      const customBranchRepo = { ...repoInfo, defaultBranch: 'develop' };
      const result = setupCreateRepoHandlers({ repoMissing: true });

      const svc = new GithubService(() => 'pat');
      await svc.createRepo(customBranchRepo, files, 'Initial commit');

      expect(result.branchRenamed()).toBe(true);
      expect(result.renamedTo()).toBe('develop');
    });

    it('throws when the API fails', async () => {
      setupCreateRepoHandlers({ repoMissing: true, treeError: true });

      const svc = new GithubService(() => 'pat');

      await expect(svc.createRepo(repoInfo, files, 'Fail')).rejects.toThrow();
    });

    function setupCreateRepoHandlers({
      treeError = false,
      repoMissing = false,
    }: { treeError?: boolean; repoMissing?: boolean } = {}) {
      let _refUpdated = false;
      let _repoCreated = false;
      let _topicsSet: string[] = [];
      let _branchRenamed = false;
      let _renamedTo = '';

      server.use(
        http.get(`${GITHUB_API}/repos/twoGiants/my-func`, () =>
          repoMissing
            ? HttpResponse.json({ message: 'Not Found' }, { status: 404 })
            : HttpResponse.json({ name: 'my-func' }),
        ),
        http.post(`${GITHUB_API}/user/repos`, () => {
          _repoCreated = true;
          return HttpResponse.json({ name: 'my-func' });
        }),
        http.post(
          `${GITHUB_API}/repos/twoGiants/my-func/branches/main/rename`,
          async ({ request }) => {
            const body = (await request.json()) as { new_name: string };
            _branchRenamed = true;
            _renamedTo = body.new_name;
            return HttpResponse.json({ name: body.new_name });
          },
        ),
        http.put(`${GITHUB_API}/repos/twoGiants/my-func/topics`, async ({ request }) => {
          const body = (await request.json()) as { names: string[] };
          _topicsSet = body.names;
          return HttpResponse.json({ names: body.names });
        }),
        http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs`, () =>
          HttpResponse.json({ sha: 'blob-sha' }),
        ),
        http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/ref/:ref+`, () =>
          HttpResponse.json({ object: { sha: 'head-sha' } }),
        ),
        http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/commits/:sha`, () =>
          HttpResponse.json({ tree: { sha: 'base-tree-sha' } }),
        ),
        http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/trees`, () =>
          treeError
            ? HttpResponse.json({ message: 'Validation Failed' }, { status: 422 })
            : HttpResponse.json({ sha: 'tree-sha' }),
        ),
        http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/commits`, () =>
          HttpResponse.json({ sha: 'commit-sha' }),
        ),
        http.patch(`${GITHUB_API}/repos/twoGiants/my-func/git/refs/:ref+`, () => {
          _refUpdated = true;
          return HttpResponse.json({});
        }),
      );

      return {
        refUpdated: () => _refUpdated,
        repoCreated: () => _repoCreated,
        topicsSet: () => _topicsSet,
        branchRenamed: () => _branchRenamed,
        renamedTo: () => _renamedTo,
      };
    }
  });

  describe('updateRepo', () => {
    const repoInfo: RepoMetadata = {
      owner: 'twoGiants',
      name: 'my-func',
      url: '',
      defaultBranch: 'main',
    };
    const files: FileEntry[] = [
      { path: 'func.yaml', mode: '100644', content: 'name: my-func', type: 'blob' },
    ];

    it('updates existing branch ref first time by loading last commit sha from GitHub', async () => {
      const result = setupUpdateRepoHandlers({ commitSha: 'commit-1' });

      const svc = new GithubService(() => 'pat');
      await svc.updateRepo(repoInfo, files, 'Update');

      expect(result.updateRefSha()).toBe('commit-1');
      expect(result.getRefCalled()).toBe(true);
    });

    it('updates existing branch ref second time by loading last commit sha from cache', async () => {
      let result = setupUpdateRepoHandlers({ commitSha: 'commit-1' });

      const svc = new GithubService(() => 'pat');
      await svc.updateRepo(repoInfo, files, 'First update');

      expect(result.updateRefSha()).toBe('commit-1');
      expect(result.getRefCalled()).toBe(true);

      result = setupUpdateRepoHandlers({ commitSha: 'commit-2' });
      await svc.updateRepo(repoInfo, files, 'Second update');

      expect(result.updateRefSha()).toBe('commit-2');
      expect(result.getRefCalled()).toBe(false);
    });

    it('updates existing branch ref third time by loading last commit sha from cache', async () => {
      let result = setupUpdateRepoHandlers({ commitSha: 'commit-1' });

      const svc = new GithubService(() => 'pat');
      await svc.updateRepo(repoInfo, files, 'First update');

      expect(result.updateRefSha()).toBe('commit-1');
      expect(result.getRefCalled()).toBe(true);

      result = setupUpdateRepoHandlers({ commitSha: 'commit-2' });
      await svc.updateRepo(repoInfo, files, 'Second update');

      expect(result.updateRefSha()).toBe('commit-2');
      expect(result.getRefCalled()).toBe(false);

      result = setupUpdateRepoHandlers({ commitSha: 'commit-3' });
      await svc.updateRepo(repoInfo, files, 'Third update');

      expect(result.updateRefSha()).toBe('commit-3');
      expect(result.getRefCalled()).toBe(false);
    });

    it('fails to update existing branch ref because of a stale sha, cleans cache and throws error', async () => {
      // GIVEN: first commit succeeds
      let result = setupUpdateRepoHandlers({
        commitSha: 'commit-1',
      });
      const svc = new GithubService(() => 'pat');

      // WHEN
      await svc.updateRepo(repoInfo, files, 'First update');

      // THEN
      expect(result.updateRefSha()).toBe('commit-1');
      expect(result.getRefCalled()).toBe(true);

      // GIVEN: second commit fails because of a stale sha => clears cache entry
      result = setupUpdateRepoHandlers({
        commitSha: 'commit-2',
        updateRefError: 'fast forward',
      });

      await expect(
        // WHEN
        svc.updateRepo(repoInfo, files, 'Stale (Second) update'),
        // THEN
      ).rejects.toThrow();
      expect(result.getRefCalled()).toBe(false);
      expect(result.updateRefSha()).toBe('');

      // GIVEN: third commit succeeds and goes through getRef because cache was cleared
      result = setupUpdateRepoHandlers({
        commitSha: 'commit-3',
      });

      // WHEN
      await svc.updateRepo(repoInfo, files, 'Third update');

      // THEN
      expect(result.updateRefSha()).toBe('commit-3');
      expect(result.getRefCalled()).toBe(true);
    });

    it('fails to update existing branch ref because of a network error, does not clean cache and throws error', async () => {
      // GIVEN: first commit succeeds
      let result = setupUpdateRepoHandlers({
        commitSha: 'commit-1',
      });
      const svc = new GithubService(() => 'pat');

      // WHEN
      await svc.updateRepo(repoInfo, files, 'First update');

      // THEN
      expect(result.updateRefSha()).toBe('commit-1');
      expect(result.getRefCalled()).toBe(true);

      // GIVEN: second commit fails because of a network error -> cache NOT cleared
      result = setupUpdateRepoHandlers({
        commitSha: 'commit-2',
        updateRefError: 'network',
      });

      await expect(
        // WHEN
        svc.updateRepo(repoInfo, files, 'Network fail (Second) update'),
        // THEN
      ).rejects.toThrow();
      expect(result.getRefCalled()).toBe(false);
      expect(result.updateRefSha()).toBe('');

      // GIVEN: third commit succeeds and goes through cache
      result = setupUpdateRepoHandlers({
        commitSha: 'commit-3',
      });

      // WHEN
      await svc.updateRepo(repoInfo, files, 'Third update');

      // THEN
      expect(result.updateRefSha()).toBe('commit-3');
      expect(result.getRefCalled()).toBe(false);
    });

    function setupUpdateRepoHandlers({
      commitSha,
      updateRefError,
    }: {
      commitSha: string;
      updateRefError?: string;
    }) {
      let _updateRefSha = '';
      let _getRefCalled = false;

      server.use(
        // createBlob
        http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs`, () =>
          HttpResponse.json({ sha: 'blob-sha' }),
        ),
        // getRef
        http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/ref/:ref+`, () => {
          _getRefCalled = true;
          return HttpResponse.json({ object: { sha: 'head-sha' } });
        }),
        // getCommit
        http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/commits/:sha`, () =>
          HttpResponse.json({ tree: { sha: 'tree-sha' } }),
        ),
        // createTree
        http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/trees`, () =>
          HttpResponse.json({ sha: 'new-tree-sha' }),
        ),
        // createCommit
        http.post(`${GITHUB_API}/repos/twoGiants/my-func/git/commits`, () =>
          HttpResponse.json({ sha: commitSha }),
        ),
        // updateRef
        http.patch(`${GITHUB_API}/repos/twoGiants/my-func/git/refs/:ref+`, async ({ request }) => {
          if (updateRefError === 'fast forward')
            return HttpResponse.json({ message: 'Update is not a fast forward' }, { status: 422 });

          if (updateRefError === 'network')
            return HttpResponse.json({ message: 'Server Error' }, { status: 500 });

          const body = (await request.json()) as { sha: string };
          _updateRefSha = body.sha;

          return HttpResponse.json({});
        }),
      );

      return { getRefCalled: () => _getRefCalled, updateRefSha: () => _updateRefSha };
    }
  });

  describe('fetch', () => {
    const repo: RepoMetadata = {
      owner: 'twoGiants',
      name: 'my-func',
      url: 'https://github.com/twoGiants/my-func',
      defaultBranch: 'main',
    };

    it('fetches all files from a repo', async () => {
      setupRepoTreeAndBlobs();

      const svc = new GithubService(() => 'pat');
      const files = await svc.fetch(repo);

      expect(files).toEqual([
        {
          path: 'func.yaml',
          mode: '100644',
          content: 'name: my-func\nruntime: node',
          type: 'blob',
        },
        { path: 'index.js', mode: '100644', content: 'module.exports = {}', type: 'blob' },
      ]);

      function setupRepoTreeAndBlobs() {
        server.use(
          http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/trees/main`, ({ request }) => {
            const url = new URL(request.url);
            expect(url.searchParams.get('recursive')).toBe('1');
            return HttpResponse.json({
              sha: 'tree-sha',
              tree: [
                { path: 'src', type: 'tree', mode: '040000', sha: 'dir-sha' },
                { path: 'func.yaml', type: 'blob', mode: '100644', sha: 'blob-1' },
                { path: 'index.js', type: 'blob', mode: '100644', sha: 'blob-2' },
              ],
            });
          }),
          http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs/blob-1`, () =>
            HttpResponse.json({
              content: btoa('name: my-func\nruntime: node'),
              encoding: 'base64',
            }),
          ),
          http.get(`${GITHUB_API}/repos/twoGiants/my-func/git/blobs/blob-2`, () =>
            HttpResponse.json({
              content: btoa('module.exports = {}'),
              encoding: 'base64',
            }),
          ),
        );
      }
    });
  });
});
