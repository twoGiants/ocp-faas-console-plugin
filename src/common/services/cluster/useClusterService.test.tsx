import { render, screen } from '@testing-library/react';
import { useClusterService } from './useClusterService';

const mockUseK8sWatchResource = vi.fn();

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: (...args: unknown[]) => mockUseK8sWatchResource(...args),
}));

const mockKsvc = {
  apiVersion: 'serving.knative.dev/v1',
  kind: 'Service',
  metadata: {
    name: 'my-func',
    namespace: 'demo',
    labels: { 'function.knative.dev/name': 'my-func' },
  },
};

const mockDeployment = {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: {
    name: 'my-func-00001-deployment',
    namespace: 'demo',
    labels: {
      'function.knative.dev/name': 'my-func',
      'serving.knative.dev/revision': 'my-func-00001',
    },
  },
  spec: { replicas: 1 },
  status: { readyReplicas: 1 },
};

function TestConsumer({
  functionNames = [],
  namespace,
}: {
  functionNames?: string[];
  namespace?: string;
}) {
  const { knativeServices, deployments, secrets, configMaps, loaded, error } = useClusterService(
    functionNames,
    namespace,
  );
  return (
    <>
      <span data-testid="loaded">{String(loaded)}</span>
      <span data-testid="error">{String(error)}</span>
      <span data-testid="ksvc-count">{knativeServices.length}</span>
      <span data-testid="dep-count">{deployments.length}</span>
      <span data-testid="secret-names">{secrets.map((s) => s.name).join(',')}</span>
      <span data-testid="secret-keys">
        {secrets.find((s) => s.name === 'db-creds')?.keys.join(',') ?? ''}
      </span>
      <span data-testid="cm-names">{configMaps.map((cm) => cm.name).join(',')}</span>
      <span data-testid="cm-keys">
        {configMaps.find((cm) => cm.name === 'app-config')?.keys.join(',') ?? ''}
      </span>
      {knativeServices.map((s) => (
        <span key={s.metadata?.name} data-testid="ksvc">
          {s.metadata?.name}
        </span>
      ))}
      {deployments.map((d) => (
        <span key={d.metadata?.name} data-testid="deployment">
          {d.metadata?.name}
        </span>
      ))}
    </>
  );
}

describe('useClusterService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes null config when function names are empty and no namespace', () => {
    mockUseK8sWatchResource.mockReturnValue([[], true, null]);

    render(<TestConsumer />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith(null);
    expect(screen.getByTestId('loaded')).toHaveTextContent('true');
    expect(screen.getByTestId('ksvc-count')).toHaveTextContent('0');
    expect(screen.getByTestId('dep-count')).toHaveTextContent('0');
    expect(screen.getByTestId('secret-names')).toHaveTextContent('');
    expect(screen.getByTestId('cm-names')).toHaveTextContent('');
  });

  it('watches Knative Services with In selector for given function names', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[mockKsvc], true, null])
      .mockReturnValue([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith({
      groupVersionKind: { group: 'serving.knative.dev', version: 'v1', kind: 'Service' },
      isList: true,
      selector: {
        matchExpressions: [
          { key: 'function.knative.dev/name', operator: 'In', values: ['my-func'] },
        ],
      },
    });
  });

  it('watches Deployments with In selector for given function names', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[mockDeployment], true, null])
      .mockReturnValue([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith({
      groupVersionKind: { group: 'apps', version: 'v1', kind: 'Deployment' },
      isList: true,
      selector: {
        matchExpressions: [
          { key: 'function.knative.dev/name', operator: 'In', values: ['my-func'] },
        ],
      },
    });
  });

  it('returns empty arrays when not loaded', () => {
    mockUseK8sWatchResource.mockReturnValue([[], false, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('loaded')).toHaveTextContent('false');
    expect(screen.getByTestId('ksvc-count')).toHaveTextContent('0');
    expect(screen.getByTestId('dep-count')).toHaveTextContent('0');
  });

  it('returns empty arrays when no resources match', () => {
    mockUseK8sWatchResource.mockReturnValue([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('loaded')).toHaveTextContent('true');
    expect(screen.getByTestId('ksvc-count')).toHaveTextContent('0');
    expect(screen.getByTestId('dep-count')).toHaveTextContent('0');
  });

  it('returns raw knative services', () => {
    mockUseK8sWatchResource
      .mockReturnValueOnce([[mockKsvc], true, null])
      .mockReturnValue([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    expect(screen.getByTestId('ksvc-count')).toHaveTextContent('1');
    expect(screen.getByTestId('ksvc')).toHaveTextContent('my-func');
  });

  it('watches Secrets in the given namespace', () => {
    const mockSecrets = [
      {
        metadata: { name: 'db-creds', namespace: 'demo' },
        data: { username: 'dXNlcg==', password: 'cGFzcw==' },
      },
      {
        metadata: { name: 'api-key', namespace: 'demo' },
        data: { key: 'c2VjcmV0' },
      },
    ];
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([mockSecrets, true, null])
      .mockReturnValueOnce([[], true, null]);

    render(<TestConsumer namespace="demo" />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith({
      groupVersionKind: { version: 'v1', kind: 'Secret' },
      namespace: 'demo',
      isList: true,
    });
    expect(screen.getByTestId('secret-names')).toHaveTextContent('db-creds,api-key');
  });

  it('returns data keys for secrets', () => {
    const mockSecrets = [
      {
        metadata: { name: 'db-creds', namespace: 'demo' },
        data: { username: 'dXNlcg==', password: 'cGFzcw==' },
      },
    ];
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([mockSecrets, true, null])
      .mockReturnValueOnce([[], true, null]);

    render(<TestConsumer namespace="demo" />);

    expect(screen.getByTestId('secret-keys')).toHaveTextContent('username,password');
  });

  it('watches ConfigMaps in the given namespace', () => {
    const mockCMs = [
      {
        metadata: { name: 'app-config', namespace: 'demo' },
        data: { 'log-level': 'info', region: 'us-east-1' },
      },
    ];
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([mockCMs, true, null]);

    render(<TestConsumer namespace="demo" />);

    expect(mockUseK8sWatchResource).toHaveBeenCalledWith({
      groupVersionKind: { version: 'v1', kind: 'ConfigMap' },
      namespace: 'demo',
      isList: true,
    });
    expect(screen.getByTestId('cm-names')).toHaveTextContent('app-config');
  });

  it('returns data keys for configmaps', () => {
    const mockCMs = [
      {
        metadata: { name: 'app-config', namespace: 'demo' },
        data: { 'log-level': 'info', region: 'us-east-1' },
      },
    ];
    mockUseK8sWatchResource
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([[], true, null])
      .mockReturnValueOnce([mockCMs, true, null]);

    render(<TestConsumer namespace="demo" />);

    expect(screen.getByTestId('cm-keys')).toHaveTextContent('log-level,region');
  });

  it('passes null config for secrets and configmaps when no namespace', () => {
    mockUseK8sWatchResource.mockReturnValue([[], true, null]);

    render(<TestConsumer functionNames={['my-func']} />);

    const calls = mockUseK8sWatchResource.mock.calls;
    expect(calls[2][0]).toBeNull();
    expect(calls[3][0]).toBeNull();
    expect(screen.getByTestId('secret-names')).toHaveTextContent('');
    expect(screen.getByTestId('cm-names')).toHaveTextContent('');
  });
});
