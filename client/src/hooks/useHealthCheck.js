import { useState, useEffect, useCallback } from 'react';
import { healthService } from '../services/api.js';

export const useHealthCheck = (pollingInterval = null) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkHealth = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await healthService.check();
      setData(res.data);
    } catch (err) {
      setError(err);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    if (pollingInterval && pollingInterval > 0) {
      const timer = setInterval(checkHealth, pollingInterval);
      return () => clearInterval(timer);
    }
  }, [checkHealth, pollingInterval]);

  return {
    data,
    loading,
    error,
    refetch: checkHealth,
    isConnected: !loading && !error && data?.status === 'healthy',
  };
};

export default useHealthCheck;
