import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useMemo } from 'react';
import { K8sKeyedResource } from '../types';
import { ClusterFunction } from './ClusterFunction';
import { listKnativeClusterFunctions } from './ClusterFunctionKnative';
import { OcpClusterService } from './OcpClusterService';

const instance = new OcpClusterService();

const FUNCTION_NAME_LABEL = 'function.knative.dev/name';

interface ClusterService {
  functions: Map<string, ClusterFunction>;
  knativeServices: K8sResourceKind[];
  deployments: K8sResourceKind[];
  secrets: K8sKeyedResource[];
  configMaps: K8sKeyedResource[];
  loaded: boolean;
  error: unknown;
  generateKubeconfig: (namespace: string) => Promise<string>;
}

export function useClusterService(
  functionNames: string[] = [],
  namespace?: string,
): ClusterService {
  const knSvcConfig = useMemo(
    () =>
      functionNames.length > 0
        ? {
            groupVersionKind: { group: 'serving.knative.dev', version: 'v1', kind: 'Service' },
            isList: true,
            selector: {
              matchExpressions: [
                { key: FUNCTION_NAME_LABEL, operator: 'In', values: functionNames },
              ],
            },
          }
        : null,
    [functionNames],
  );

  const depConfig = useMemo(
    () =>
      functionNames.length > 0
        ? {
            groupVersionKind: { group: 'apps', version: 'v1', kind: 'Deployment' },
            isList: true,
            selector: {
              matchExpressions: [
                { key: FUNCTION_NAME_LABEL, operator: 'In', values: functionNames },
              ],
            },
          }
        : null,
    [functionNames],
  );

  const secretConfig = useMemo(
    () =>
      namespace
        ? {
            groupVersionKind: { version: 'v1', kind: 'Secret' },
            namespace,
            isList: true,
          }
        : null,
    [namespace],
  );

  const configMapConfig = useMemo(
    () =>
      namespace
        ? {
            groupVersionKind: { version: 'v1', kind: 'ConfigMap' },
            namespace,
            isList: true,
          }
        : null,
    [namespace],
  );

  const [knSvcs, knLoaded, knError] = useK8sWatchResource<K8sResourceKind[]>(knSvcConfig);
  const [deps, depLoaded, depError] = useK8sWatchResource<K8sResourceKind[]>(depConfig);
  const [rawSecrets, secretLoaded, secretError] =
    useK8sWatchResource<K8sResourceKind[]>(secretConfig);
  const [rawConfigMaps, cmLoaded, cmError] =
    useK8sWatchResource<K8sResourceKind[]>(configMapConfig);

  const secrets = useMemo(() => toKeyedResources(rawSecrets), [rawSecrets, secretLoaded]);
  const configMaps = useMemo(() => toKeyedResources(rawConfigMaps), [rawConfigMaps, cmLoaded]);

  const knativeServices = useMemo(() => (knLoaded ? (knSvcs ?? []) : []), [knLoaded, knSvcs]);
  const deploymentList = useMemo(() => (depLoaded ? (deps ?? []) : []), [depLoaded, deps]);

  const functions = useMemo(() => {
    const list = listKnativeClusterFunctions(knativeServices, deploymentList);
    return new Map(list.map((cf) => [cf.name, cf]));
  }, [knativeServices, deploymentList]);

  let loaded = knLoaded && depLoaded;
  if (namespace) loaded = loaded && secretLoaded && cmLoaded;

  return {
    functions,
    knativeServices,
    deployments: deploymentList,
    secrets,
    configMaps,
    loaded,
    error: knError || depError || secretError || cmError,
    generateKubeconfig: instance.generateKubeconfig.bind(instance),
  };
}

function toKeyedResources(resources: K8sResourceKind[]): K8sKeyedResource[] {
  return (resources ?? [])
    .filter((r) => r.metadata?.name)
    .map((r) => ({
      name: r.metadata!.name!,
      keys: r.data ? Object.keys(r.data) : [],
    }));
}
