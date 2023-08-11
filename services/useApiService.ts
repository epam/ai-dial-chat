import { useCallback } from 'react';

import { useFetch } from '@/hooks/useFetch';

const useApiService = () => {
  const fetchService = useFetch();

  // const getModels = useCallback(
  // 	(
  // 		params: GetManagementRoutineInstanceDetailedParams,
  // 		signal?: AbortSignal
  // 	) => {
  // 		return fetchService.get<GetManagementRoutineInstanceDetailed>(
  // 			`/v1/ManagementRoutines/${params.managementRoutineId}/instances/${params.instanceId
  // 			}?sensorGroupIds=${params.sensorGroupId ?? ''}`,
  // 			{
  // 				signal,
  // 			}
  // 		);
  // 	},
  // 	[fetchService]
  // );

  const getModels = useCallback(
    (signal?: AbortSignal) => {
      return fetchService.get(`/api/models`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });
    },
    [fetchService],
  );

  const getAddons = useCallback(
    (signal?: AbortSignal) => {
      return fetchService.get(`/api/addons`, {
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });
    },
    [fetchService],
  );

  return {
    getModels,
    getAddons,
  };
};

export default useApiService;
