import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Server,
  Database,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/frontend/components/ui/card";
import { Badge } from "@/frontend/components/ui/badge";
import { Button } from "@/frontend/components/ui/button";

export const Route = createFileRoute("/_authenticated/monitoring")({
  component: MonitoringDashboardPage,
});

export default function MonitoringDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/monitoring/metrics");
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setLastRefreshed(new Date());
      }
    } catch (err) {
      console.warn("Failed to fetch monitoring metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    if (!autoRefresh) return;
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const api = data?.api || {};
  const db = data?.database || {};
  const redis = data?.redis || {};
  const system = data?.system || {};
  const alerts = data?.alerts || [];
  const errors = data?.recentErrors || [];
  const health = data?.overallHealth || "healthy";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 md:p-8 space-y-6">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              <Activity className="h-6 w-6 text-emerald-400" />
              Backend Observability & System Health
            </h1>
            <Badge
              variant={
                health === "healthy"
                  ? "default"
                  : health === "degraded"
                    ? "secondary"
                    : "destructive"
              }
              className="text-xs uppercase font-semibold"
            >
              {health}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            GlucoLab v1.6 • Env: <span className="font-mono text-slate-200">{system.environment || "production"}</span> • Last updated: {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="text-xs border-slate-700 hover:bg-slate-800 text-slate-300"
          >
            {autoRefresh ? "Auto-refresh: ON (10s)" : "Auto-refresh: PAUSED"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={fetchMetrics}
            disabled={loading}
            className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Active Alerts Banner */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`p-3.5 rounded-lg border flex items-start gap-3 text-sm ${
                alert.severity === "CRITICAL"
                  ? "bg-rose-950/60 border-rose-800 text-rose-200"
                  : "bg-amber-950/60 border-amber-800 text-amber-200"
              }`}
            >
              <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{alert.name}</span>
                  <span className="text-xs font-mono opacity-80">{alert.triggeredAt?.slice(11, 19)}</span>
                </div>
                <p className="text-xs mt-0.5 opacity-90">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total API Requests */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              API Requests
              <Server className="h-4 w-4 text-sky-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{api.totalRequests || 0}</div>
            <p className="text-xs text-slate-400 mt-1">
              Error Rate:{" "}
              <span className={`font-semibold ${api.errorRatePercent > 5 ? "text-rose-400" : "text-emerald-400"}`}>
                {api.errorRatePercent || 0}%
              </span>
            </p>
          </CardContent>
        </Card>

        {/* API Latency p95 */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              p95 Latency
              <Clock className="h-4 w-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{api.p95LatencyMs || 0} ms</div>
            <p className="text-xs text-slate-400 mt-1">
              p50: <span className="text-slate-200">{api.p50LatencyMs || 0}ms</span> • p99:{" "}
              <span className="text-slate-200">{api.p99LatencyMs || 0}ms</span>
            </p>
          </CardContent>
        </Card>

        {/* Redis Cache Hit Ratio */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              Redis Hit Ratio
              <Zap className="h-4 w-4 text-amber-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{redis.hitRatio || 0}%</div>
            <p className="text-xs text-slate-400 mt-1">
              {redis.hits || 0} hits • {redis.misses || 0} misses • {redis.fallbacksToDb || 0} fallbacks
            </p>
          </CardContent>
        </Card>

        {/* Database Queries */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center justify-between">
              DB Execution
              <Database className="h-4 w-4 text-purple-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-bold">{db.averageDurationMs || 0} ms</div>
            <p className="text-xs text-slate-400 mt-1">
              {db.totalQueries || 0} queries • {db.slowQueries || 0} slow (&gt;100ms)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Grid: Endpoints + Redis & DB Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Endpoints Performance Table */}
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader className="p-4 border-b border-slate-800">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Server className="h-4 w-4 text-sky-400" />
              API Endpoints Performance
            </CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Response time percentiles and traffic volume per monitored route
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5">Endpoint</th>
                    <th className="px-3 py-2.5 text-right">Requests</th>
                    <th className="px-3 py-2.5 text-right">p50</th>
                    <th className="px-3 py-2.5 text-right">p95</th>
                    <th className="px-3 py-2.5 text-right">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono">
                  {(api.endpoints || []).length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-slate-500 font-sans">
                        No API requests recorded yet in current cycle
                      </td>
                    </tr>
                  ) : (
                    api.endpoints.map((ep: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-800/50">
                        <td className="px-4 py-2.5 font-medium text-slate-200">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 mr-1.5 font-sans">
                            {ep.method}
                          </span>
                          {ep.route}
                        </td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{ep.totalRequests}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300">{ep.p50LatencyMs}ms</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-emerald-400">
                          {ep.p95LatencyMs}ms
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {ep.clientErrorCount + ep.serverErrorCount > 0 ? (
                            <span className="text-rose-400 font-bold">
                              {ep.clientErrorCount + ep.serverErrorCount}
                            </span>
                          ) : (
                            <span className="text-slate-500">0</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Subsystems Status Panel */}
        <div className="space-y-4">
          {/* Redis Status */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="p-4 pb-2 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  Redis Cache Health
                </span>
                {redis.isRedisConnected ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <XCircle className="h-4 w-4 text-amber-400" />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Provider:</span>
                <span className="font-mono text-slate-200">{redis.provider || "in-memory-fallback"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Avg Latency:</span>
                <span className="font-mono text-slate-200">{redis.averageLatencyMs || 0} ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Circuit Breaker:</span>
                <span className={`font-semibold ${redis.isRedisConnected ? "text-emerald-400" : "text-amber-400"}`}>
                  {redis.isRedisConnected ? "CLOSED (Healthy)" : "OPEN (Fallback Active)"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Cached In-Memory Keys:</span>
                <span className="font-mono text-slate-200">{redis.cachedKeysCount || 0}</span>
              </div>
            </CardContent>
          </Card>

          {/* Runtime & Memory Status */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader className="p-4 pb-2 border-b border-slate-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="h-4 w-4 text-violet-400" />
                System Resources
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Heap Memory Used:</span>
                <span className="font-mono text-slate-200">{system.memoryMb?.heapUsed || 0} MB</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Total Heap:</span>
                <span className="font-mono text-slate-200">{system.memoryMb?.heapTotal || 0} MB</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">RSS Footprint:</span>
                <span className="font-mono text-slate-200">{system.memoryMb?.rss || 0} MB</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-400">Uptime:</span>
                <span className="font-mono text-slate-200">{system.uptimeSeconds || 0}s</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Scrubbed Incident & Error Log */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader className="p-4 border-b border-slate-800">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Scrubbed Incident & Error Feed (Zero PHI / HIPAA Compliant)
            </span>
            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
              Max 50 Grouped
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Deduplicated by fingerprint. All patient identifiers, auth tokens, and glucose/insulin values are scrubbed before ingestion.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Endpoint</th>
                  <th className="px-4 py-2.5">Message</th>
                  <th className="px-3 py-2.5 text-center">Occurrences</th>
                  <th className="px-4 py-2.5 text-right">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {errors.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500 font-sans">
                      No errors or incidents detected. All subsystems operational.
                    </td>
                  </tr>
                ) : (
                  errors.map((err: any) => (
                    <tr key={err.id} className="hover:bg-slate-800/50">
                      <td className="px-4 py-2.5">
                        <span className="px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-950 text-rose-400 border border-rose-900">
                          {err.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-300">
                        {err.method ? `${err.method} ` : ""}
                        {err.endpoint || "system"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-300 max-w-xs truncate" title={err.message}>
                        {err.message}
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-200">
                        {err.count}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-400">
                        {err.timestamp?.slice(11, 19)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

