export async function loader() {
  const startTime = Date.now();

  try {
    const checks = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || "unknown",
      version: process.version,
    };

    const responseTime = Date.now() - startTime;

    return Response.json(
      {
        status: "healthy",
        responseTime: `${responseTime}ms`,
        ...checks,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return Response.json(
      {
        status: "unhealthy",
        responseTime: `${responseTime}ms`,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      },
    );
  }
}

export default function Health() {
  return (
    <div>
      <h1>Health Check</h1>
      <p>This endpoint provides health status information for monitoring.</p>
    </div>
  );
}
