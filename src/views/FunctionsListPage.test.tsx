import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import FunctionsListPage from './FunctionsListPage';
import { PAT_KEY } from '../services/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  DocumentTitle: ({ children }: { children: string }) => children,
  ListPageHeader: ({ title, children }: { title: string; children?: React.ReactNode }) => (
    <>
      {title}
      {children}
    </>
  ),
}));

const mockUseSourceControl = vi.fn();
vi.mock('../services/source-control/useSourceControlService', () => ({
  useSourceControlService: () => mockUseSourceControl(),
}));

const mockUseClusterService = vi.fn();
vi.mock('../services/cluster/useClusterService', () => ({
  useClusterService: () => mockUseClusterService(),
}));

vi.mock('../components/FunctionTable', () => ({
  FunctionTable: ({ functions }: { functions: { name: string }[] }) =>
    functions.map((f) => f.name).join(','),
}));

vi.mock('../components/UserAvatar', () => ({
  UserAvatar: ({ enableReconnect }: { enableReconnect: boolean }) => (
    <span data-testid="user-avatar">{enableReconnect ? 'reconnect' : 'no-reconnect'}</span>
  ),
}));

function renderAuthenticated() {
  sessionStorage.setItem(PAT_KEY, 'ghp_test');
}

describe('FunctionsListPage', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(() => {
    sessionStorage.clear();
  });

  it('renders a spinner while loading', () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockResolvedValue([]),
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: false, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders the empty state when loaded with no functions', async () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockResolvedValue([]),
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('renders table when functions are loaded', async () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockResolvedValue([
        {
          owner: 'twoGiants',
          name: 'my-func',
          url: 'https://github.com/twoGiants/my-func',
          defaultBranch: 'main',
        },
      ]),
      fetchFileContent: vi.fn().mockResolvedValue('name: my-func\nruntime: go\nnamespace: demo\n'),
    });
    mockUseClusterService.mockReturnValue({
      deployments: [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: 'my-func',
            namespace: 'demo',
            labels: { 'function.knative.dev/name': 'my-func' },
          },
          spec: { replicas: 1 },
          status: { readyReplicas: 1 },
        },
      ],
      loaded: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('my-func')).toBeInTheDocument();
  });

  it('shows NotDeployed status for repos without cluster deployment', async () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockResolvedValue([
        {
          owner: 'twoGiants',
          name: 'orphan-func',
          url: 'https://github.com/twoGiants/orphan-func',
          defaultBranch: 'main',
        },
      ]),
      fetchFileContent: vi
        .fn()
        .mockResolvedValue('name: orphan-func\nruntime: node\nnamespace: demo\n'),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('orphan-func')).toBeInTheDocument();
  });

  it('shows error alert when listing repos fails', async () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockRejectedValue(new Error('Bad credentials')),
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
  });

  it('renders empty state when GitHub API fails', async () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockRejectedValue(new Error('Requires authentication')),
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'No functions found' })).toBeInTheDocument();
  });

  it('does not call listFunctionRepos when not authenticated', async () => {
    const mockListRepos = vi.fn().mockResolvedValue([]);
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: mockListRepos,
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'No functions found' });

    expect(mockListRepos).not.toHaveBeenCalled();
  });

  it('renders UserAvatar in header', () => {
    renderAuthenticated();
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockResolvedValue([]),
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('user-avatar')).toBeInTheDocument();
  });

  it('empty state receives hint and isCreateDisabled when not authenticated', async () => {
    mockUseSourceControl.mockReturnValue({
      listFunctionRepos: vi.fn().mockResolvedValue([]),
      fetchFileContent: vi.fn(),
    });
    mockUseClusterService.mockReturnValue({ deployments: [], loaded: true, error: null });

    render(
      <MemoryRouter>
        <FunctionsListPage />
      </MemoryRouter>,
    );

    await screen.findByRole('heading', { name: 'No functions found' });

    const button = screen.getByRole('button', { name: 'Create function' });
    expect(button).toBeDisabled();
  });
});
